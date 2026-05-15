"""GitHub push webhook: verify HMAC signature, run deploy script in background."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


def load_webhook_secret(
    secret_plain: Optional[str], secret_file: Optional[Path]
) -> Optional[str]:
    if secret_plain and secret_plain.strip():
        return secret_plain.strip()
    if secret_file is not None and secret_file.is_file():
        try:
            data: dict[str, Any] = json.loads(secret_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("Could not read GITHUB_WEBHOOK_SECRET_FILE: %s", e)
            return None
        s = data.get("secret")
        if isinstance(s, str) and s.strip():
            return s.strip()
    return None


def verify_github_signature(
    body: bytes, signature_header: Optional[str], secret: str
) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    received = signature_header[7:]
    return hmac.compare_digest(received, expected)


def run_pull_and_update(deploy_root: Path, script_path: Path) -> tuple[bool, str]:
    env = {**os.environ, "DEPLOY_ROOT": str(deploy_root.resolve())}
    try:
        proc = subprocess.run(
            ["sudo", "-n", str(script_path.resolve())],
            capture_output=True,
            text=True,
            timeout=900,
            env=env,
        )
    except subprocess.TimeoutExpired:
        return False, "deploy script timed out"
    except FileNotFoundError:
        return False, "sudo or deploy script not found"
    except Exception as e:
        return False, str(e)
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0:
        return False, out.strip() or f"exit {proc.returncode}"
    return True, out.strip()


def post_notify(url: str, deploy_ok: bool, message: str) -> None:
    body = json.dumps(
        {"deploy_ok": deploy_ok, "message": message[:8000]},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.URLError as e:
        logger.warning("Deploy notify POST failed: %s", e)
