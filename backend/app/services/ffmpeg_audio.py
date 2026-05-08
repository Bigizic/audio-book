import shutil
import subprocess
import tempfile
from pathlib import Path

from app.config import settings


def concat_wavs(wav_paths: list[Path], out_wav: Path) -> None:
    if not wav_paths:
        raise ValueError("No WAV segments")
    if len(wav_paths) == 1:
        shutil.copy2(wav_paths[0], out_wav)
        return
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        for p in wav_paths:
            safe = str(p.resolve()).replace("'", "'\\''")
            f.write(f"file '{safe}'\n")
        list_path = Path(f.name)
    try:
        subprocess.run(
            [
                settings.ffmpeg_binary,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_path),
                "-c",
                "copy",
                str(out_wav),
            ],
            check=True,
            capture_output=True,
            timeout=600,
        )
    finally:
        list_path.unlink(missing_ok=True)


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        [
            settings.ffmpeg_binary,
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "128k",
            str(mp3_path),
        ],
        check=True,
        capture_output=True,
        timeout=600,
    )
