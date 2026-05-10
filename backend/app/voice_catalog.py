"""Piper voices: English (US) and English (GB) — paths from rhasspy/piper-voices voices.json."""

from __future__ import annotations

from dataclasses import dataclass

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


# 2 US + 2 GB — https://huggingface.co/rhasspy/piper-voices
VOICES: tuple[PiperVoiceEntry, ...] = (
    PiperVoiceEntry(
        "en_US-ryan-high",
        "en_US",
        "English (US)",
        "Ryan · high",
        "en/en_US/ryan/high/en_US-ryan-high.onnx",
        "en/en_US/ryan/high/en_US-ryan-high.onnx.json",
        PREVIEW_TEXT_EN,
    ),
    PiperVoiceEntry(
        "en_US-ljspeech-high",
        "en_US",
        "English (US)",
        "LJSpeech · high",
        "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx",
        "en/en_US/ljspeech/high/en_US-ljspeech-high.onnx.json",
        PREVIEW_TEXT_EN,
    ),
    PiperVoiceEntry(
        "en_GB-cori-high",
        "en_GB",
        "English (GB)",
        "Cori · high",
        "en/en_GB/cori/high/en_GB-cori-high.onnx",
        "en/en_GB/cori/high/en_GB-cori-high.onnx.json",
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

VOICE_IDS: frozenset[str] = frozenset(v.voice_id for v in VOICES)
VOICE_BY_ID: dict[str, PiperVoiceEntry] = {v.voice_id: v for v in VOICES}

HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"


def sorted_voices() -> list[PiperVoiceEntry]:
    return sorted(
        VOICES,
        key=lambda v: (
            LANGUAGE_ORDER.get(v.language_code, 99),
            v.language_label,
            v.label,
        ),
    )
