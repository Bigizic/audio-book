"""Piper voices: English (US) and English (GB) — paths from rhasspy/piper-voices voices.json."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings

# Display order for languages in API / UI
LANGUAGE_ORDER: dict[str, int] = {
    "en_US": 0,
    "en_GB": 1,
}

PREVIEW_TEXT_EN = (
    "Here is a short preview of this voice — warm pages, quiet corners, and stories read aloud."
)


@dataclass(frozen=True)
class PiperVoiceEntry:
    voice_id: str
    language_code: str  # en_US, en_GB
    language_label: str
    label: str
    hf_onnx: str
    hf_json: str
    preview_text: str


def _use_high_voice_models() -> bool:
    return settings.piper_voice_quality.strip().lower() == "high"


def get_voices() -> tuple[PiperVoiceEntry, ...]:
    """Ryan, LJSpeech, Cori use medium or high per ``settings.piper_voice_quality``; southern stays low."""
    high = _use_high_voice_models()
    return (
        PiperVoiceEntry(
            "en_US-ryan-high" if high else "en_US-ryan-medium",
            "en_US",
            "English (US)",
            "Ryan · high" if high else "Ryan · medium",
            (
                "en/en_US/ryan/high/en_US-ryan-high.onnx"
                if high
                else "en/en_US/ryan/medium/en_US-ryan-medium.onnx"
            ),
            (
                "en/en_US/ryan/high/en_US-ryan-high.onnx.json"
                if high
                else "en/en_US/ryan/medium/en_US-ryan-medium.onnx.json"
            ),
            PREVIEW_TEXT_EN,
        ),
        PiperVoiceEntry(
            "en_US-ljspeech-high" if high else "en_US-ljspeech-medium",
            "en_US",
            "English (US)",
            "LJSpeech · high" if high else "LJSpeech · medium",
            (
                "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx"
                if high
                else "en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx"
            ),
            (
                "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx.json"
                if high
                else "en/en_US/ljspeech/medium/en_US-ljspeech-medium.onnx.json"
            ),
            PREVIEW_TEXT_EN,
        ),
        PiperVoiceEntry(
            "en_GB-cori-high" if high else "en_GB-cori-medium",
            "en_GB",
            "English (GB)",
            "Cori · high" if high else "Cori · medium",
            (
                "en/en_GB/cori/high/en_GB-cori-high.onnx"
                if high
                else "en/en_GB/cori/medium/en_GB-cori-medium.onnx"
            ),
            (
                "en/en_GB/cori/high/en_GB-cori-high.onnx.json"
                if high
                else "en/en_GB/cori/medium/en_GB-cori-medium.onnx.json"
            ),
            PREVIEW_TEXT_EN,
        ),
        PiperVoiceEntry(
            "en_GB-southern_english_female-low",
            "en_GB",
            "English (GB)",
            "Southern English female · low",
            "en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx",
            "en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx.json",
            PREVIEW_TEXT_EN,
        ),
    )


def voice_by_id() -> dict[str, PiperVoiceEntry]:
    return {v.voice_id: v for v in get_voices()}


def voice_ids() -> frozenset[str]:
    return frozenset(voice_by_id())


HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"


def sorted_voices() -> list[PiperVoiceEntry]:
    return sorted(
        get_voices(),
        key=lambda v: (
            LANGUAGE_ORDER.get(v.language_code, 99),
            v.language_label,
            v.label,
        ),
    )
