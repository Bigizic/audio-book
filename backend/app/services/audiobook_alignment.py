"""Build word-level timing manifest for audiobook playback.

Strategy:
- The TTS engine (Piper) writes one WAV per text chunk.
- Each WAV has leading & trailing silence baked in. If we proportionally split
  the chunk's *full* duration across words, the highlighter drifts ahead of the
  audio because the first word starts at t=0 while audio is still silent.
- We measure leading/trailing silence per chunk and only spread the speech
  window across words. We also weight words by char count + a pause bonus for
  trailing punctuation so periods/commas absorb the natural pause that Piper
  inserts after them.
"""

from __future__ import annotations

import array
import json
import wave
from collections import defaultdict
from contextlib import closing
from pathlib import Path

ALIGNMENT_FILENAME = "alignment.json"

_SILENCE_WINDOW_MS = 10
_SILENCE_THRESHOLD_RATIO = 0.025
_MAX_LEAD_TRIM_MS = 600.0
_MAX_TRAIL_TRIM_MS = 600.0


def wav_duration_ms(path: Path) -> float:
    with closing(wave.open(str(path), "rb")) as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        if rate <= 0:
            return 0.0
        return 1000.0 * frames / float(rate)


def measure_chunk_silence_ms(path: Path) -> tuple[float, float]:
    """Return (lead_silence_ms, trail_silence_ms) for a 16-bit PCM WAV."""
    try:
        with closing(wave.open(str(path), "rb")) as wf:
            sr = wf.getframerate()
            nch = wf.getnchannels()
            sw = wf.getsampwidth()
            nframes = wf.getnframes()
            if sw != 2 or nch < 1 or sr <= 0 or nframes <= 0:
                return 0.0, 0.0
            raw = wf.readframes(nframes)
    except (wave.Error, OSError):
        return 0.0, 0.0

    samples = array.array("h")
    samples.frombytes(raw)
    if nch > 1:
        downmixed = array.array("h", [0] * (len(samples) // nch))
        for i in range(len(downmixed)):
            acc = 0
            base = i * nch
            for c in range(nch):
                acc += samples[base + c]
            downmixed[i] = acc // nch
        samples = downmixed

    n = len(samples)
    if n == 0:
        return 0.0, 0.0

    win = max(1, int(_SILENCE_WINDOW_MS * sr / 1000))
    n_windows = n // win
    if n_windows <= 0:
        return 0.0, 0.0

    win_peaks: list[int] = []
    peak_global = 0
    for w in range(n_windows):
        start = w * win
        end = start + win
        local_peak = 0
        for j in range(start, end):
            v = samples[j]
            if v < 0:
                v = -v
            if v > local_peak:
                local_peak = v
        win_peaks.append(local_peak)
        if local_peak > peak_global:
            peak_global = local_peak

    if peak_global <= 0:
        return 0.0, 0.0

    threshold = peak_global * _SILENCE_THRESHOLD_RATIO

    lead_w = 0
    while lead_w < n_windows and win_peaks[lead_w] < threshold:
        lead_w += 1
    trail_w = n_windows - 1
    while trail_w > lead_w and win_peaks[trail_w] < threshold:
        trail_w -= 1

    lead_ms = lead_w * _SILENCE_WINDOW_MS
    trail_ms = (n_windows - 1 - trail_w) * _SILENCE_WINDOW_MS

    lead_ms = min(lead_ms, _MAX_LEAD_TRIM_MS)
    trail_ms = min(trail_ms, _MAX_TRAIL_TRIM_MS)
    return float(lead_ms), float(trail_ms)


def _word_weight(word: str) -> float:
    base = max(1.0, float(len(word)))
    if not word:
        return base
    last = word[-1]
    if last in ".!?":
        base += 4.0
    elif last in ":;":
        base += 2.0
    elif last in ",":
        base += 1.2
    elif last in '"”’)':
        base += 0.4
    return base


def build_alignment_manifest(
    job_id: str,
    segments: list[dict],
) -> dict:
    """
    segments: ordered list of:
      {
        "page": int,
        "text": str,
        "duration_ms": float,
        "lead_silence_ms"?: float,
        "trail_silence_ms"?: float,
      }
    """
    spans: list[dict] = []
    cumulative = 0.0
    page_next_idx: dict[int, int] = {}

    for seg in segments:
        page = int(seg["page"])
        text = (seg.get("text") or "").strip()
        d = float(seg["duration_ms"])
        lead = float(seg.get("lead_silence_ms") or 0.0)
        trail = float(seg.get("trail_silence_ms") or 0.0)
        words = text.split()
        if not words:
            cumulative += d
            continue

        speech_ms = max(0.0, d - lead - trail)
        if speech_ms <= 0.0:
            # Degenerate WAV — fall back to full duration so we don't divide by zero.
            speech_ms = d
            lead = 0.0
            trail = max(0.0, d - speech_ms)

        weights = [_word_weight(w) for w in words]
        tw = sum(weights) or 1.0

        t = cumulative + lead
        for wi, w in enumerate(words):
            idx = page_next_idx.get(page, 0)
            dt = speech_ms * weights[wi] / tw
            t1 = t + dt
            if wi == len(words) - 1:
                t1 = cumulative + lead + speech_ms
            spans.append(
                {
                    "t0": round(t, 2),
                    "t1": round(t1, 2),
                    "page": page,
                    "idx": idx,
                    "word": w,
                }
            )
            t = t1
            page_next_idx[page] = idx + 1
        cumulative += d

    by_page: dict[int, list[str]] = defaultdict(list)
    for s in sorted(spans, key=lambda x: (x["page"], x["idx"])):
        by_page[int(s["page"])].append(str(s["word"]))

    pages = {str(p): {"words": ws} for p, ws in sorted(by_page.items())}

    return {
        "version": 1,
        "job_id": job_id,
        "duration_ms": round(cumulative, 2),
        "spans": spans,
        "pages": pages,
    }


def write_alignment_file(work_dir: Path, job_id: str, segments: list[dict]) -> Path:
    path = work_dir / ALIGNMENT_FILENAME
    manifest = build_alignment_manifest(job_id, segments)
    path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    return path
