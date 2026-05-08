import shutil
import time
from pathlib import Path

from app.config import settings
from app.models.schemas import JobStatus
from app.services.job_store import job_store
from app.services.pdf_service import chunk_text, extract_text_range
from app.services.ffmpeg_audio import concat_wavs, wav_to_mp3
from app.services.tts_service import run_piper_wav


def _estimate_eta_seconds(char_count: int, num_chunks: int) -> int:
    # Rough heuristic: ~400 chars/s synthesis + ffmpeg overhead
    base = 15 + num_chunks * 8
    return int(base + max(0, char_count) / 400)


def process_conversion(job_id: str, start_page: int, end_page: int, voice_id: str) -> None:
    data = job_store.get(job_id)
    if not data:
        return
    pdf_path = Path(data["pdf_path"])
    work = settings.storage_root / job_id
    work.mkdir(parents=True, exist_ok=True)

    try:
        job_store.update(
            job_id,
            status=JobStatus.extracting.value,
            message="Extracting text from PDF...",
            progress_percent=5.0,
        )

        text, _pages_used = extract_text_range(pdf_path, start_page, end_page)
        if not text.strip():
            raise ValueError("No extractable text in the selected page range.")

        chunks = chunk_text(text, settings.max_chunk_chars)
        char_count = len(text)
        eta = _estimate_eta_seconds(char_count, len(chunks))

        job_store.update(
            job_id,
            status=JobStatus.processing.value,
            message="Generating audio...",
            progress_percent=20.0,
            char_count=char_count,
            eta_seconds=eta,
        )

        wav_segments: list[Path] = []
        n = len(chunks)
        for i, chunk in enumerate(chunks):
            out = work / f"seg_{i:04d}.wav"
            run_piper_wav(chunk, out, voice_id)
            wav_segments.append(out)
            done = i + 1
            pct = 20.0 + (70.0 * done / n)
            remaining = n - done
            job_store.update(
                job_id,
                progress_percent=pct,
                message="Generating audio...",
                eta_seconds=max(5, int(eta * remaining / n)) if n else 0,
            )

        ordered = wav_segments

        merged = work / "merged.wav"
        concat_wavs(ordered, merged)
        for p in ordered:
            p.unlink(missing_ok=True)

        mp3_path = work / "output.mp3"
        job_store.update(
            job_id,
            message="Encoding MP3...",
            progress_percent=92.0,
        )
        wav_to_mp3(merged, mp3_path)
        merged.unlink(missing_ok=True)

        size = mp3_path.stat().st_size
        job_store.update(
            job_id,
            status=JobStatus.complete.value,
            message="Ready to download.",
            progress_percent=100.0,
            mp3_path=str(mp3_path),
            eta_seconds=0,
            mp3_size_bytes=size,
        )
    except Exception as e:
        job_store.update(
            job_id,
            status=JobStatus.failed.value,
            message=str(e),
            error=str(e),
            eta_seconds=None,
        )
    finally:
        job_store.touch_ttl(job_id)


def cleanup_old_files() -> None:
    root = settings.storage_root
    if not root.exists():
        return
    cutoff = time.time() - settings.job_ttl_seconds
    for p in root.iterdir():
        if not p.is_dir():
            continue
        try:
            mtime = p.stat().st_mtime
        except OSError:
            continue
        if mtime < cutoff:
            shutil.rmtree(p, ignore_errors=True)
            job_store.delete(p.name)
