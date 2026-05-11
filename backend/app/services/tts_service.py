import threading
import wave
from pathlib import Path

from piper import PiperVoice

from app.services.memory_debug import log_process_rss
from app.services.voice_assets import model_paths
from app.voice_catalog import voice_by_id

_voices: dict[str, PiperVoice] = {}
_init_lock = threading.Lock()
_synth_lock = threading.Lock()


def _get_voice(voice_id: str) -> PiperVoice:
    if voice_id not in voice_by_id():
        raise ValueError(f"Unknown voice: {voice_id}")
    if voice_id in _voices:
        return _voices[voice_id]
    with _init_lock:
        if voice_id not in _voices:
            onnx_path, json_path = model_paths(voice_id)
            if not onnx_path.is_file():
                raise RuntimeError(
                    f"Model missing for {voice_id} at {onnx_path}. "
                    "Restart the server to download voices or check disk space."
                )
            _voices[voice_id] = PiperVoice.load(
                str(onnx_path),
                config_path=str(json_path),
            )
            log_process_rss("tts.model_load", f"voice={voice_id}")
    return _voices[voice_id]


def run_piper_wav(text: str, out_wav: Path, voice_id: str) -> None:
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    voice = _get_voice(voice_id)
    log_process_rss(
        "tts.piper_synthesize",
        f"before voice={voice_id} chars={len(text)}",
    )
    with _synth_lock:
        with wave.open(str(out_wav), "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)
    log_process_rss("tts.piper_synthesize", f"after voice={voice_id}")


__all__ = ["run_piper_wav"]
