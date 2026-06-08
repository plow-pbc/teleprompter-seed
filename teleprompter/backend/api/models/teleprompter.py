"""Pydantic models describing teleprompter state and payloads."""

from typing import Literal

from pydantic import BaseModel

from .base import CAMEL_MODEL_CONFIG


class SpeechProfile(BaseModel):
    """Speech profile derived from calibration or fallback."""

    model_config = CAMEL_MODEL_CONFIG

    per_length_durations: dict[str, float]
    punctuation_pauses: dict[str, float]
    source: Literal["stt", "fallback"] | None = None
    updated_at: str | None = None
    transcription: str | None = None


class TeleprompterState(BaseModel):
    """Complete state of the teleprompter."""

    model_config = CAMEL_MODEL_CONFIG

    content: str
    is_playing: bool
    is_presenting: bool
    playback_rate: float
    wpm: float  # Retained for backwards compatibility / analytics
    position: float  # Word index (not pixels)
    font_size_vh: float  # Font size as viewport height percentage (2.5-8.0)
    background_color: str
    text_color: str
    countdown_seconds: int
    speech_profile: SpeechProfile | None = None


class StateUpdate(BaseModel):
    """Partial state update from controller."""

    model_config = CAMEL_MODEL_CONFIG

    content: str | None = None
    is_playing: bool | None = None
    is_presenting: bool | None = None
    playback_rate: float | None = None
    wpm: float | None = None  # Words per minute
    position: float | None = None  # Word index
    font_size_vh: float | None = None  # Font size as viewport height percentage
    background_color: str | None = None
    text_color: str | None = None
    countdown_seconds: int | None = None
    speech_profile: SpeechProfile | None = None


class NTPRequestPayload(BaseModel):
    """NTP-style time sync request payload."""

    model_config = CAMEL_MODEL_CONFIG

    t0: float
    client_rtt: float | None = None


class NTPResponsePayload(BaseModel):
    """Response payload for NTP sync."""

    model_config = CAMEL_MODEL_CONFIG

    t0: float
    t1: float
    t2: float


class PlaySchedulePayload(BaseModel):
    """Scheduled playback notification payload."""

    model_config = CAMEL_MODEL_CONFIG

    server_time_to_execute: float
    position: float
    playback_rate: float
    wpm: float | None = None
