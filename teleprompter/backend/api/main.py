"""FastAPI application with WebSocket support for teleprompter sync."""

import asyncio
import json
import logging
import math
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import get_settings
from .models import (
    NTPRequestPayload,
    NTPResponsePayload,
    PlaySchedulePayload,
    SpeechProfile,
    StateUpdate,
    TeleprompterState,
)

logger = logging.getLogger("teleprompter.backend")

app = FastAPI(title="Teleprompter Sync API", version="1.0.0")

# CORS middleware — local recording tool, allow all origins (LAN access from phone)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# User-scoped state storage
# Key: user_id (str), Value: TeleprompterState
user_states: dict[str, TeleprompterState] = {}

# User-scoped WebSocket connections
# Key: user_id (str), Value: list of WebSocket connections
user_connections: dict[str, list[WebSocket]] = {}


@dataclass
class ConnectionMetadata:
    """Runtime metadata for each active WebSocket connection."""

    websocket: WebSocket
    round_trip_ms: float = 0.0
    last_ntp_response_ms: float = 0.0


# Connection metadata keyed by WebSocket instance
connection_metadata: dict[WebSocket, ConnectionMetadata] = {}


ROUND_TRIP_SMOOTHING_ALPHA = 0.2
MIN_SCHEDULE_DELAY_MS = 400.0
SCHEDULE_JITTER_BUFFER_MS = 200.0
SCHEDULE_DELAY_CAP_MS = 3000.0
DEFAULT_COUNTDOWN_SECONDS = 3

DEFAULT_PLAYBACK_RATE = 1.0
DEFAULT_SPEECH_PROFILE = SpeechProfile(
    per_length_durations={str(i): round(0.25 + 0.15 * math.log(i), 3) for i in range(1, 31)},
    punctuation_pauses={"comma": 0.2, "sentence": 0.4},
    source="fallback",
    updated_at="static",
)


def estimate_wpm_from_profile(profile: SpeechProfile, playback_rate: float = 1.0) -> float:
    """Estimate words per minute for compatibility with legacy clients."""
    sample_lengths = [3, 4, 5, 6, 7]
    base_profile = DEFAULT_SPEECH_PROFILE
    durations = []
    for length in sample_lengths:
        key = str(length)
        durations.append(profile.per_length_durations.get(key, base_profile.per_length_durations[key]))
    average_duration = sum(durations) / len(durations)
    effective_duration = average_duration / playback_rate if playback_rate > 0 else average_duration
    return max(1.0, round(60 / max(effective_duration, 0.05)))


def epoch_now_ms() -> float:
    """Return the current epoch time in milliseconds."""
    return time.time() * 1000.0


def calculate_schedule_delay_ms(max_rtt_ms: float) -> float:
    """Calculate the buffered schedule delay based on observed RTT."""
    dynamic_delay = max(MIN_SCHEDULE_DELAY_MS, max_rtt_ms * 1.5 + SCHEDULE_JITTER_BUFFER_MS)
    return min(dynamic_delay, SCHEDULE_DELAY_CAP_MS)


def register_connection(user_id: str, websocket: WebSocket) -> None:
    """Track a newly connected WebSocket."""
    if user_id not in user_connections:
        user_connections[user_id] = []
    user_connections[user_id].append(websocket)
    connection_metadata[websocket] = ConnectionMetadata(
        websocket=websocket,
        last_ntp_response_ms=epoch_now_ms(),
    )


def remove_connection(user_id: str, websocket: WebSocket) -> None:
    """Remove WebSocket from tracking structures."""
    if user_id in user_connections and websocket in user_connections[user_id]:
        user_connections[user_id].remove(websocket)
    connection_metadata.pop(websocket, None)


def get_user_max_rtt(user_id: str) -> float:
    """Return the maximum observed RTT across all active connections for a user."""
    max_rtt = 0.0
    for ws in user_connections.get(user_id, []):
        metadata = connection_metadata.get(ws)
        if metadata and metadata.round_trip_ms > max_rtt:
            max_rtt = metadata.round_trip_ms
    return max_rtt


async def broadcast_message(user_id: str, message: str) -> None:
    """Broadcast message to all connected clients concurrently."""
    for client in list(user_connections.get(user_id, [])):
        asyncio.create_task(_send_message_to_client(user_id, client, message))


async def _send_message_to_client(user_id: str, client: WebSocket, message: str) -> None:
    """Send a message to a single client and prune it on failure."""
    try:
        await client.send_text(message)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Removing connection for user %s after send failure: %s", user_id[:8], exc
        )
        remove_connection(user_id, client)


def build_state_sync_message(state: TeleprompterState) -> str:
    """Serialize the Teleprompter state."""
    return json.dumps({"type": "state:sync", "data": state.model_dump(by_alias=True)})


async def broadcast_state(user_id: str) -> None:
    """Broadcast the latest state to all connected clients for a user."""
    state = user_states[user_id]
    message = build_state_sync_message(state)

    await broadcast_message(user_id, message)


def get_default_state() -> TeleprompterState:
    """Create default teleprompter state for new users."""
    profile = deepcopy(DEFAULT_SPEECH_PROFILE)
    return TeleprompterState(
        content="",
        is_playing=False,
        is_presenting=False,
        playback_rate=DEFAULT_PLAYBACK_RATE,
        wpm=estimate_wpm_from_profile(profile, DEFAULT_PLAYBACK_RATE),
        position=0.0,
        font_size_vh=4.5,  # Default: 4.5% of viewport height
        background_color="#000000",
        text_color="#ffffff",
        countdown_seconds=DEFAULT_COUNTDOWN_SECONDS,
        speech_profile=profile,
    )


def get_user_state(user_id: str) -> TeleprompterState:
    """Get or create state for a user."""
    if user_id not in user_states:
        user_states[user_id] = get_default_state()
    return user_states[user_id]


@app.get("/")
async def root() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "message": "Teleprompter Sync API"}


# --- Content API ---

LOCAL_USER_ID = "local-shared"


class ContentUpdateRequest(BaseModel):
    """Request body for POST /api/content."""

    content: str = Field(..., min_length=1, description="New teleprompter content")


class ContentUpdateResponse(BaseModel):
    """Response body for POST /api/content."""

    success: bool
    message: str


@app.post("/api/content", response_model=ContentUpdateResponse)
async def update_content(
    request: ContentUpdateRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
) -> ContentUpdateResponse:
    """Update teleprompter content via REST API.

    Requires X-API-Key header matching CONTENT_API_KEY env var.

    Behavior:
    - Updates content for the local-shared user
    - Resets position to 0
    - Pauses playback (isPlaying: false)
    - Maintains presentation mode if active (isPresenting unchanged)
    - Broadcasts to all connected WebSocket clients
    """
    settings = get_settings()

    # Validate API key
    if not settings.content_api_key:
        raise HTTPException(status_code=503, detail="Content API not configured")

    if x_api_key != settings.content_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Use LOCAL_USER_ID for local mode
    user_id = LOCAL_USER_ID

    # Get or create user state
    user_state = get_user_state(user_id)

    # Update state
    user_state.content = request.content
    user_state.position = 0.0  # Reset to beginning
    user_state.is_playing = False  # Pause

    logger.info("Content updated via API. Length: %d chars", len(request.content))

    # Broadcast to all connected clients
    await broadcast_state(user_id)

    return ContentUpdateResponse(
        success=True,
        message=f"Content updated. {len(request.content)} characters. Position reset to 0.",
    )


# --- WebSocket ---


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time state synchronization.

    Local recording tool: no authentication, all clients share the same state.
    """
    user_id: str = LOCAL_USER_ID

    # Accept WebSocket connection
    await websocket.accept()

    # Add to user's connection list
    register_connection(user_id, websocket)

    logger.info(
        "User %s connected. Total connections: %d",
        user_id[:8],
        len(user_connections[user_id]),
    )

    try:
        # Get or create user state
        user_state: TeleprompterState = get_user_state(user_id)

        # Send current state to newly connected client
        await websocket.send_text(build_state_sync_message(user_state))
    except WebSocketDisconnect:
        remove_connection(user_id, websocket)
        logger.info("User %s disconnected immediately.", user_id[:8])
        return

    try:
        while True:
            # Receive updates from controller
            data: str = await websocket.receive_text()
            message: dict[str, Any] = json.loads(data)
            message_type = message.get("type")
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "Received message type '%s' from user %s", message_type, user_id[:8]
                )
            payload = message.get("data", {}) or {}
            if message_type == "state:update":
                # Update user-specific state
                update = StateUpdate(**payload)
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug("Parsed state update for user %s: %s", user_id[:8], update)

                # Apply partial updates to user's state
                profile_updated = False
                playback_rate_updated = False
                if update.content is not None:
                    user_state.content = update.content
                if update.is_playing is not None:
                    user_state.is_playing = update.is_playing
                if update.is_presenting is not None:
                    user_state.is_presenting = update.is_presenting
                if update.position is not None and not user_state.is_playing:
                    user_state.position = update.position
                if update.font_size_vh is not None:
                    user_state.font_size_vh = update.font_size_vh
                if update.background_color is not None:
                    user_state.background_color = update.background_color
                if update.text_color is not None:
                    user_state.text_color = update.text_color
                if update.playback_rate is not None:
                    user_state.playback_rate = update.playback_rate
                    playback_rate_updated = True
                if update.speech_profile is not None:
                    user_state.speech_profile = update.speech_profile
                    profile_updated = True
                if update.wpm is not None:
                    user_state.wpm = update.wpm
                elif profile_updated or playback_rate_updated:
                    profile = user_state.speech_profile or DEFAULT_SPEECH_PROFILE
                    user_state.wpm = estimate_wpm_from_profile(profile, user_state.playback_rate)
                if update.countdown_seconds is not None:
                    user_state.countdown_seconds = int(update.countdown_seconds)

                await broadcast_state(user_id)

            elif message_type == "ntp:request":
                ntp_request = NTPRequestPayload(**payload)

                metadata = connection_metadata.get(websocket)
                if metadata:
                    metadata.last_ntp_response_ms = epoch_now_ms()
                    if ntp_request.client_rtt is not None and ntp_request.client_rtt > 0:
                        if metadata.round_trip_ms > 0:
                            metadata.round_trip_ms = (
                                metadata.round_trip_ms * (1 - ROUND_TRIP_SMOOTHING_ALPHA)
                                + ntp_request.client_rtt * ROUND_TRIP_SMOOTHING_ALPHA
                            )
                        else:
                            metadata.round_trip_ms = ntp_request.client_rtt

                t1 = epoch_now_ms()
                response = NTPResponsePayload(t0=ntp_request.t0, t1=t1, t2=epoch_now_ms())
                response_message = json.dumps(
                    {"type": "ntp:response", "data": response.model_dump(by_alias=True)}
                )
                await websocket.send_text(response_message)

            elif message_type == "play:start":
                # Position is controlled locally once playback begins.
                if "playback_rate" in payload and payload["playback_rate"] is not None:
                    user_state.playback_rate = float(payload["playback_rate"])
                if "wpm" in payload and payload["wpm"] is not None:
                    user_state.wpm = float(payload["wpm"])
                else:
                    profile = user_state.speech_profile or DEFAULT_SPEECH_PROFILE
                    user_state.wpm = estimate_wpm_from_profile(profile, user_state.playback_rate)

                if "position" in payload and payload["position"] is not None:
                    user_state.position = float(payload["position"])

                desired_start_ms: float | None = None
                if "desired_start_ms" in payload and payload["desired_start_ms"] is not None:
                    try:
                        desired_start_ms = float(payload["desired_start_ms"])
                    except (TypeError, ValueError):
                        desired_start_ms = None

                user_state.is_playing = True

                await broadcast_state(user_id)

                max_rtt_ms = get_user_max_rtt(user_id)
                schedule_delay_ms = calculate_schedule_delay_ms(max_rtt_ms)
                now_ms = epoch_now_ms()

                if desired_start_ms is not None:
                    requested_delay_ms = max(0.0, desired_start_ms - now_ms)
                    schedule_delay_ms = max(schedule_delay_ms, requested_delay_ms)

                server_time_to_execute = now_ms + schedule_delay_ms

                logger.info(
                    "Scheduling play for user %s in %.1f ms (max RTT: %.1f ms)",
                    user_id[:8],
                    schedule_delay_ms,
                    max_rtt_ms,
                )

                schedule_payload = PlaySchedulePayload(
                    server_time_to_execute=server_time_to_execute,
                    position=user_state.position,
                    playback_rate=user_state.playback_rate,
                    wpm=user_state.wpm,
                )
                schedule_message = json.dumps(
                    {"type": "play:schedule", "data": schedule_payload.model_dump(by_alias=True)}
                )
                await broadcast_message(user_id, schedule_message)

            elif message_type == "play:pause":
                if "position" in payload and payload["position"] is not None:
                    user_state.position = float(payload["position"])

                user_state.is_playing = False

                await broadcast_state(user_id)

            elif message_type == "play:reset":
                user_state.position = 0.0
                user_state.is_playing = False

                await broadcast_state(user_id)

            else:
                logger.warning("Unknown message type received: %s", message_type)
                continue

    except WebSocketDisconnect:
        remove_connection(user_id, websocket)
        logger.info(
            "User %s disconnected. %d connections remaining.",
            user_id[:8],
            len(user_connections[user_id]),
        )


# Export for Vercel
handler = app
