#!/usr/bin/env bash
# Linux VPS system packages for the audiobook backend.
# Piper runs via Python: pip install -r backend/requirements.txt (includes piper-tts from
# https://github.com/OHF-Voice/piper1-gpl — embeds espeak-ng; no separate piper binary).
#
# Usage:
#   sudo ./install-piper-vps.sh
# Optional:
#   SKIP_SYSTEM_PKGS=1 ./install-piper-vps.sh

set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This script targets Linux VPS only." >&2
  exit 1
fi

SUDO=""
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  SUDO="sudo"
fi

install_system_packages() {
  if [[ "${SKIP_SYSTEM_PKGS:-0}" == "1" ]]; then
    echo "SKIP_SYSTEM_PKGS=1 — skipping apt/dnf package install."
    return 0
  fi
  echo "Installing ffmpeg + Python venv support (for piper-tts & MP3 encoding)…"
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq ffmpeg
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y ffmpeg
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y ffmpeg
  elif command -v apk >/dev/null 2>&1; then
    $SUDO apk add --no-cache ffmpeg
  else
    echo "No apt-get/dnf/yum/apk found. Install ffmpeg." >&2
    exit 1
  fi
}

install_system_packages

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found." >&2
  exit 1
fi

echo
echo "Done. Next on the server:"
echo "  python3 -m venv .venv && source .venv/bin/activate"
echo "  pip install -r requirements.txt"
echo "First uvicorn start downloads 10 voices (EN-US, EN-GB, Kiswahili) into app/static/.../voices/ — slow, needs disk + network."
echo "Docs: https://github.com/OHF-Voice/piper1-gpl"
