"""Shared helpers for API models."""

from pydantic import ConfigDict


def to_camel(string: str) -> str:
    """Convert snake_case strings to camelCase."""
    components = string.split("_")
    return components[0] + "".join(part.title() for part in components[1:])


CAMEL_MODEL_CONFIG: ConfigDict = ConfigDict(populate_by_name=True, alias_generator=to_camel)


__all__ = ["CAMEL_MODEL_CONFIG", "to_camel"]
