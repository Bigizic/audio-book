from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_voices_base() -> Path:
    return (
        Path(__file__).resolve().parent
        / "static"
        / "voices"
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    storage_root: Path = Path("/tmp/audiobooks")
    voices_base_dir: Path = Field(default_factory=_default_voices_base)
    cors_origins: str = "http://localhost:3000"
    job_ttl_seconds: int = 30 * 60
    cleanup_interval_minutes: int = 15
    """Max words per Piper call; a whole page under this limit is one chunk."""
    tts_max_words_per_chunk: int = 1500
    """When True, GET /status/{job_id}/stream emits Server-Sent Events."""
    job_sse_enabled: bool = True
    ffmpeg_binary: str = "ffmpeg"


settings = Settings()
