"""Piper voices: English (US), English (GB), Kiswahili — paths from rhasspy/piper-voices voices.json."""

from __future__ import annotations

from dataclasses import dataclass

# Display order for languages in API / UI
LANGUAGE_ORDER: dict[str, int] = {
    "en_US": 0,
    "en_GB": 1,
    "sw": 2,
}

PREVIEW_TEXT_EN = (
    "Here is a short preview of this voice — warm pages, quiet corners, and stories read aloud."
)
PREVIEW_TEXT_SW = (
    "Habari, hiki ni mfano wa sauti hii. Karibu kusikiliza hadithi zilizosomwa kwa upole."
)


@dataclass(frozen=True)
class PiperVoiceEntry:
    voice_id: str
    language_code: str  # BCP-style cluster: en_US, en_GB, sw
    language_label: str
    label: str
    hf_onnx: str
    hf_json: str
    preview_text: str


# 5 US (includes original Lessac) + 4 GB + 1 Kiswahili = 10
# https://huggingface.co/rhasspy/piper-voices
VOICES: tuple[PiperVoiceEntry, ...] = (
    # English (US)
    PiperVoiceEntry(
        "en_US-lessac-medium",
        "en_US",
        "English (US)",
        "Lessac · medium",
        "en/en_US/lessac/medium/en_US-lessac-medium.onnx",
        "en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
        PREVIEW_TEXT_EN,
    ),
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
        "en_US-amy-medium",
        "en_US",
        "English (US)",
        "Amy · medium",
        "en/en_US/amy/medium/en_US-amy-medium.onnx",
        "en/en_US/amy/medium/en_US-amy-medium.onnx.json",
        PREVIEW_TEXT_EN,
    ),
    PiperVoiceEntry(
        "en_US-joe-medium",
        "en_US",
        "English (US)",
        "Joe · medium",
        "en/en_US/joe/medium/en_US-joe-medium.onnx",
        "en/en_US/joe/medium/en_US-joe-medium.onnx.json",
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
    # English (GB)
    PiperVoiceEntry(
        "en_GB-alan-medium",
        "en_GB",
        "English (GB)",
        "Alan · medium",
        "en/en_GB/alan/medium/en_GB-alan-medium.onnx",
        "en/en_GB/alan/medium/en_GB-alan-medium.onnx.json",
        PREVIEW_TEXT_EN,
    ),
    PiperVoiceEntry(
        "en_GB-alba-medium",
        "en_GB",
        "English (GB)",
        "Alba · medium",
        "en/en_GB/alba/medium/en_GB-alba-medium.onnx",
        "en/en_GB/alba/medium/en_GB-alba-medium.onnx.json",
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
    # Kiswahili (Piper: sw_CD-lanfrica-medium)
    PiperVoiceEntry(
        "sw_CD-lanfrica-medium",
        "sw",
        "Kiswahili",
        "Lanfrica · medium (Congo)",
        "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium.onnx",
        "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium.onnx.json",
        PREVIEW_TEXT_SW,
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
