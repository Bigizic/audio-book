import shutil
import time
from pathlib import Path

import fitz

from app.config import settings
from app.models.schemas import JobStatus
from app.services.job_store import job_store
from app.services.pdf_service import split_page_for_tts
from app.services.ffmpeg_audio import concat_wavs, wav_to_mp3
from app.services.tts_service import run_piper_wav


def _estimate_eta_seconds(char_count: int, num_segments: int) -> int:
    base = 15 + num_segments * 8
    return int(base + max(0, char_count) / 400)


def process_conversion(job_id: str, start_page: int, end_page: int, voice_id: str) -> None:
    data = job_store.get(job_id)
    if not data:
        return
    pdf_path = Path(data["pdf_path"])
    work = settings.storage_root / job_id
    work.mkdir(parents=True, exist_ok=True)
    max_words = settings.tts_max_words_per_chunk

    try:
        pages_in_job = end_page - start_page + 1
        words_done = 0
        total_chars = 0
        wav_segments: list[Path] = []
        seg_idx = 0
        pages_completed = 0

        job_store.update(
            job_id,
            status=JobStatus.extracting.value,
            progress_phase="reading",
            message="Opening PDF…",
            progress_percent=2.0,
            pages_in_job=pages_in_job,
            pages_done=0,
            words_done=0,
            words_total=None,
            current_page=start_page,
            tts_chunk_index=None,
            tts_chunks_on_page=None,
        )

        with fitz.open(pdf_path) as doc:
            n_doc = len(doc)
            if start_page > n_doc:
                raise ValueError("Start page is past the end of the document.")

            last_page_idx = min(end_page, n_doc)
            for p_idx in range(start_page - 1, last_page_idx):
                page_num = p_idx + 1
                rel = page_num - start_page

                job_store.update(
                    job_id,
                    status=JobStatus.extracting.value,
                    progress_phase="reading",
                    current_page=page_num,
                    pages_in_job=pages_in_job,
                    pages_done=pages_completed,
                    words_done=words_done,
                    message=f"Reading page {page_num} of {n_doc}…",
                    progress_percent=2.0 + 10.0 * rel / max(1, pages_in_job),
                )

                text = (doc[p_idx].get_text() or "").strip()
                page_words = len(text.split()) if text else 0
                words_done += page_words
                total_chars += len(text)
                job_store.update(job_id, words_done=words_done)
                if page_num == last_page_idx:
                    job_store.update(job_id, words_total=words_done)

                subchunks = split_page_for_tts(text, max_words)

                job_store.update(
                    job_id,
                    status=JobStatus.processing.value,
                    progress_phase="synthesizing",
                    current_page=page_num,
                    pages_in_job=pages_in_job,
                    pages_done=pages_completed,
                    words_done=words_done,
                    tts_chunks_on_page=len(subchunks) if subchunks else 0,
                    tts_chunk_index=0,
                    message=(
                        f"Synthesizing page {page_num}…"
                        if subchunks
                        else f"No text on page {page_num}, skipping."
                    ),
                    progress_percent=12.0 + 75.0 * rel / max(1, pages_in_job),
                    char_count=total_chars,
                    eta_seconds=max(10, int(35 * (pages_in_job - pages_completed))),
                )

                if not subchunks:
                    pages_completed += 1
                    continue

                k = len(subchunks)
                rough_segments = seg_idx + k + max(1, pages_in_job - pages_completed) * 2
                eta_base = _estimate_eta_seconds(total_chars, rough_segments)

                for j, chunk in enumerate(subchunks):
                    out = work / f"seg_{seg_idx:04d}.wav"
                    run_piper_wav(chunk, out, voice_id)
                    wav_segments.append(out)
                    seg_idx += 1
                    done_sub = j + 1
                    frac_page = done_sub / k
                    pct = 12.0 + 75.0 * ((pages_completed + frac_page) / max(1, pages_in_job))
                    remaining_pages = pages_in_job - pages_completed - frac_page
                    job_store.update(
                        job_id,
                        progress_percent=min(91.0, pct),
                        tts_chunk_index=done_sub,
                        tts_chunks_on_page=k,
                        message=f"Synthesizing page {page_num}, part {done_sub}/{k}…",
                        eta_seconds=max(
                            5,
                            int(eta_base * remaining_pages / max(1, pages_in_job)),
                        ),
                    )

                pages_completed += 1

        if not wav_segments:
            raise ValueError("No extractable text in the selected page range.")

        merged = work / "merged.wav"
        concat_wavs(wav_segments, merged)
        for p in wav_segments:
            p.unlink(missing_ok=True)

        mp3_path = work / "output.mp3"
        job_store.update(
            job_id,
            progress_phase="encoding",
            message="Encoding MP3…",
            progress_percent=92.0,
            tts_chunk_index=None,
            tts_chunks_on_page=None,
        )
        wav_to_mp3(merged, mp3_path)
        merged.unlink(missing_ok=True)

        size = mp3_path.stat().st_size
        job_store.update(
            job_id,
            status=JobStatus.complete.value,
            progress_phase=None,
            message="Ready to download.",
            progress_percent=100.0,
            mp3_path=str(mp3_path),
            eta_seconds=0,
            mp3_size_bytes=size,
            current_page=None,
        )
    except Exception as e:
        job_store.update(
            job_id,
            status=JobStatus.failed.value,
            progress_phase=None,
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
