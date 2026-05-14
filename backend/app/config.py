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
    piper_voice_quality: str = Field(
        default="Medium",
        description="High or Medium (case-insensitive). Ryan, LJSpeech, Cori use that tier; startup downloads if missing.",
    )
    cors_origins: str = "http://localhost:3000"
    job_ttl_seconds: int = 30 * 60
    cleanup_interval_minutes: int = 15
    """Max words per Piper call; a whole page under this limit is one chunk."""
    tts_max_words_per_chunk: int = 1000
    """If True, each Piper chunk is concatenated into one ``merged.wav`` as synthesis runs. If False, separate segment WAVs are written and merged only at the end (previous behavior)."""
    tts_append_wav_to_output: bool = True
    """When True, GET /status/{job_id}/stream emits Server-Sent Events."""
    job_sse_enabled: bool = True
    ffmpeg_binary: str = "ffmpeg"
    # --- GitHub deploy webhook (optional) ---
    """Plain secret; overrides file if both set. Same value as GitHub webhook "Secret"."""
    github_webhook_secret: str | None = None
    """JSON file: {\"secret\": \"...\"}. Gitignored on VPS; copy from github-webhook-secret.example.json."""
    github_webhook_secret_file: Path | None = None
    """Repo root on the VPS (git checkout)."""
    deploy_root: Path = Path("/opt/audiobook")
    """If set, run this script via sudo -n after git pull; default deploy_root/deploy/vps-pull-and-update.sh."""
    deploy_pull_script: Path | None = None
    """Optional POST after deploy (e.g. https://ntfy.sh/your-topic) with JSON {deploy_ok, message}."""
    deploy_notify_url: str | None = None
    """When True, log current process RSS (MiB) at PDF read and Piper TTS (requires psutil)."""
    memory_usage_debug: bool = False


settings = Settings()
