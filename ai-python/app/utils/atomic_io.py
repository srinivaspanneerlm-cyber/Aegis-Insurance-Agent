"""
Crash-safe, cross-process-safe file writes for the Layer-3 memory stores
(Phase 8.3a).

The memory stores persist JSON with a plain truncate-then-write, which is unsafe
two ways: a reader can catch a half-written file, and two uvicorn workers writing
the same customer's file can corrupt it or lose an update. This module provides
the two primitives that close the first hazard entirely and the second for the
append case:

  - ``atomic_write_text`` — write to a temp file in the same directory, fsync,
    then ``os.replace`` (atomic on POSIX). A reader therefore always sees either
    the complete old file or the complete new one, never a torn one — even if the
    process crashes mid-write.

  - ``file_lock`` — an exclusive advisory lock (``fcntl.flock``) keyed on a stable
    sidecar ``.lock`` file, so a read-modify-write cycle can be serialised across
    processes. The sidecar is used rather than locking the data file itself
    because ``os.replace`` swaps the data file's inode out from under any lock
    held on it.

``fcntl`` is POSIX; the AI engine runs on Linux in every deployed environment. On
a platform without it (e.g. a Windows dev box) the lock degrades to a no-op —
i.e. exactly today's single-process behaviour — rather than failing to import.
"""
from __future__ import annotations

import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Union

from app.utils.logger import logger

try:
    import fcntl
    _HAVE_FCNTL = True
except ImportError:  # pragma: no cover - non-POSIX dev only
    _HAVE_FCNTL = False


def atomic_write_text(path: Union[str, Path], text: str, encoding: str = "utf-8") -> None:
    """Write ``text`` to ``path`` atomically via a same-directory temp file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=path.suffix)
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)  # atomic rename on POSIX
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def file_sig(path: Union[str, Path]):
    """A cheap change-signature ``(mtime_ns, size)`` for mtime-aware caches, or
    ``None`` if the file is absent.

    The memory stores reuse a cached value only while this signature is unchanged,
    so one worker's write is seen by another on its next read (8.3b). Size is
    included alongside mtime so an update that lands within the same mtime
    granularity as the cached read is still detected via the size change.
    """
    try:
        st = Path(path).stat()
        return (st.st_mtime_ns, st.st_size)
    except OSError:
        return None


@contextmanager
def file_lock(path: Union[str, Path]) -> Iterator[None]:
    """Hold an exclusive advisory lock scoped to ``path`` for the block's body.

    Serialises a read-modify-write on ``path`` across processes. No-op (yields
    immediately) where ``fcntl`` is unavailable.
    """
    if not _HAVE_FCNTL:
        yield
        return

    lock_path = Path(str(path) + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)
