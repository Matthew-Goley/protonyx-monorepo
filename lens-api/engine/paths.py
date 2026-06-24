from __future__ import annotations

import os
import sys
from pathlib import Path


def _is_pyinstaller() -> bool:
    return hasattr(sys, "_MEIPASS")


def _is_nuitka() -> bool:
    if getattr(sys, "frozen", False) and not _is_pyinstaller():
        return True
    return "__compiled__" in globals()


def is_frozen() -> bool:
    return _is_pyinstaller() or _is_nuitka()


def _bundle_root() -> Path:
    if _is_pyinstaller():
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    if _is_nuitka():
        return Path(sys.executable).parent
    # Dev / server: repo root relative to this file (lens-api/engine/paths.py → lens-api/)
    return Path(__file__).resolve().parent.parent


def resource_path(*parts: str) -> Path:
    return _bundle_root().joinpath(*parts)


def user_data_dir() -> Path:
    """Return the writable data directory.

    Priority:
      1. LENS_DATA_DIR env var — use this on Railway / Docker.
      2. %LOCALAPPDATA%/Protonyx/Vector — Windows desktop fallback.
      3. ~/Vector/data — Linux/macOS fallback.
    """
    env_override = os.environ.get("LENS_DATA_DIR")
    if env_override:
        path = Path(env_override)
    else:
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            path = Path(local_app_data) / "Protonyx" / "Vector"
        else:
            path = Path.home() / "Vector" / "data"

    path.mkdir(parents=True, exist_ok=True)
    return path


def user_file(*parts: str) -> Path:
    return user_data_dir().joinpath(*parts)
