"""Download Piper voice ONNX assets on startup if missing (public Hugging Face URLs).

Compatible with piper-tts / https://github.com/OHF-Voice/piper1-gpl (PiperVoice.load).
"""

from __future__ import annotations

import logging
import urllib.error
import urllib.request
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# en_US-ryan-high (see https://huggingface.co/rhasspy/piper-voices )
_ONNX_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
    "en/en_US/ryan/high/en_US-ryan-high.onnx"
)
_JSON_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
    "en/en_US/ryan/high/en_US-ryan-high.onnx.json"
)

_MIN_ONNX_BYTES = 500_000
_CHUNK = 1024 * 1024
_USER_AGENT = "audiobook-backend/1.0 (Piper voice fetch; +https://github.com/rhasspy/piper)"


def _download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            with part.open("wb") as out:
                while True:
                    chunk = resp.read(_CHUNK)
                    if not chunk:
                        break
                    out.write(chunk)
        part.replace(dest)
    except Exception:
        part.unlink(missing_ok=True)
        raise


def _needs_onnx(path: Path) -> bool:
    if not path.is_file():
        return True
    try:
        return path.stat().st_size < _MIN_ONNX_BYTES
    except OSError:
        return True


def _needs_json(path: Path | None) -> bool:
    if path is None:
        return False
    if not path.is_file():
        return True
    try:
        return path.stat().st_size < 50
    except OSError:
        return True


def ensure_piper_voice_files() -> None:
    """
    Ensure ONNX + JSON exist next to configured paths. Downloads if missing or truncated.
    """
    model = settings.piper_model_path.resolve()
    cfg = settings.piper_config_path.resolve() if settings.piper_config_path else None

    need_onnx = _needs_onnx(model)
    need_json = _needs_json(cfg)

    if not need_onnx and not need_json:
        logger.info("Piper voice files already present at %s", model.parent)
        return

    if need_onnx:
        logger.info("Downloading Piper voice ONNX (en_US-ryan-high)...")
        try:
            _download_file(_ONNX_URL, model)
        except PermissionError as e:
            raise RuntimeError(
                f"Cannot write Piper model to {model.parent}. "
                "Unset PIPER_MODEL_PATH / PIPER_CONFIG_PATH in .env to use "
                "~/.cache/audiobook-piper, or set them to a writable directory."
            ) from e
        except urllib.error.HTTPError as e:
            raise RuntimeError(
                f"Failed to download Piper ONNX ({e.code}): {_ONNX_URL}"
            ) from e
        except Exception as e:
            raise RuntimeError(
                f"Failed to download Piper ONNX: {e}. Check network / disk space."
            ) from e
        if _needs_onnx(model):
            raise RuntimeError("Piper ONNX download incomplete or corrupt.")

    if cfg is not None and need_json:
        logger.info("Downloading Piper voice config JSON...")
        try:
            _download_file(_JSON_URL, cfg)
        except PermissionError as e:
            raise RuntimeError(
                f"Cannot write Piper config to {cfg.parent}. "
                "Use a writable PIPER_CONFIG_PATH or the default cache directory."
            ) from e
        except Exception as e:
            logger.warning(
                "Piper JSON config download failed (%s); Piper may still find .onnx.json beside model.",
                e,
            )

    logger.info("Piper voice ready: %s", model)
