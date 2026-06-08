"""Pydantic models exposed by the teleprompter API package."""

from .base import CAMEL_MODEL_CONFIG, to_camel
from .teleprompter import (
    NTPRequestPayload,
    NTPResponsePayload,
    PlaySchedulePayload,
    SpeechProfile,
    StateUpdate,
    TeleprompterState,
)

__all__ = (
    "CAMEL_MODEL_CONFIG",
    "NTPRequestPayload",
    "NTPResponsePayload",
    "PlaySchedulePayload",
    "SpeechProfile",
    "StateUpdate",
    "TeleprompterState",
    "to_camel",
)
