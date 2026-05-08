"""Download Piper voices into app/static/.../voices/<id>/ and build sample.mp3 per voice."""

from __future__ import annotations

import logging
import urllib.error
import urllib.request
import wave
from pathlib import Path

from piper import PiperVoice

from app.config import settings
from app.services.ffmpeg_audio import wav_to_mp3
from app.voice_catalog import HF_BASE, VOICES, VOICE_BY_ID

logger = logging.getLogger(__name__)

_CHUNK = 1024 * 1024
_USER_AGENT = "audiobook-backend/1.0 (Piper voice fetch)"
_MIN_ONNX_BYTES = 500_000


def _hf_url(relative_path: str) -> str:
    return f"{HF_BASE}{relative_path}"


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


def voice_dir(voice_id: str) -> Path:
    return settings.voices_base_dir / voice_id


def model_paths(voice_id: str) -> tuple[Path, Path]:
    d = voice_dir(voice_id)
    return d / f"{voice_id}.onnx", d / f"{voice_id}.onnx.json"


def sample_mp3_path(voice_id: str) -> Path:
    return voice_dir(voice_id) / "sample.mp3"


def ensure_voice_files(voice_id: str) -> None:
    entry = VOICE_BY_ID[voice_id]
    d = voice_dir(voice_id)
    d.mkdir(parents=True, exist_ok=True)
    onnx_path, json_path = model_paths(voice_id)

    need_onnx = not onnx_path.is_file() or onnx_path.stat().st_size < _MIN_ONNX_BYTES
    need_json = not json_path.is_file() or json_path.stat().st_size < 50

    if need_onnx:
        logger.info("Downloading ONNX for %s", voice_id)
        _download_file(_hf_url(entry.hf_onnx), onnx_path)
    if need_json:
        logger.info("Downloading JSON for %s", voice_id)
        try:
            _download_file(_hf_url(entry.hf_json), json_path)
        except urllib.error.HTTPError as e:
            logger.warning("JSON download failed for %s: %s", voice_id, e)


def ensure_voice_sample_mp3(voice_id: str) -> Path:
    """Synthesize sample.mp3 inside the voice directory."""
    out = sample_mp3_path(voice_id)
    if out.is_file() and out.stat().st_size > 0:
        return out
    onnx_path, json_path = model_paths(voice_id)
    if not onnx_path.is_file():
        raise FileNotFoundError(onnx_path)
    voice = PiperVoice.load(str(onnx_path), config_path=str(json_path))
    wav_path = voice_dir(voice_id) / "_sample_build.wav"
    entry = VOICE_BY_ID[voice_id]
    try:
        with wave.open(str(wav_path), "wb") as wf:
            voice.synthesize_wav(entry.preview_text, wf)
        wav_to_mp3(wav_path, out)
    finally:
        wav_path.unlink(missing_ok=True)
    return out


def ensure_all_voices() -> None:
    settings.voices_base_dir.mkdir(parents=True, exist_ok=True)
    for entry in VOICES:
        vid = entry.voice_id
        try:
            ensure_voice_files(vid)
            ensure_voice_sample_mp3(vid)
            logger.info("Voice ready: %s", vid)
        except Exception as e:
            logger.exception("Failed to prepare voice %s: %s", vid, e)
            raise RuntimeError(f"Voice setup failed for {vid}: {e}") from e


def is_voice_ready(voice_id: str) -> bool:
    if voice_id not in VOICE_BY_ID:
        return False
    onnx_path, json_path = model_paths(voice_id)
    sp = sample_mp3_path(voice_id)
    return (
        onnx_path.is_file()
        and onnx_path.stat().st_size >= _MIN_ONNX_BYTES
        and json_path.is_file()
        and sp.is_file()
        and sp.stat().st_size > 0
    )
