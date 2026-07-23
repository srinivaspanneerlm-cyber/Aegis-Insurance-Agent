"""
Tests for the crash-safe / cross-process-safe file primitives (Phase 8.3a).
"""
import os

from app.utils.atomic_io import atomic_write_text, file_lock


def test_atomic_write_creates_complete_file(tmp_path):
    p = tmp_path / "a.json"
    atomic_write_text(p, '{"x": 1}')
    assert p.read_text(encoding="utf-8") == '{"x": 1}'


def test_atomic_write_overwrites_existing(tmp_path):
    p = tmp_path / "a.json"
    atomic_write_text(p, "old")
    atomic_write_text(p, "new")
    assert p.read_text(encoding="utf-8") == "new"


def test_atomic_write_leaves_no_temp_files(tmp_path):
    atomic_write_text(tmp_path / "a.json", "data")
    assert [f for f in os.listdir(tmp_path) if f.startswith(".tmp-")] == []


def test_atomic_write_preserves_original_on_replace_failure(tmp_path, monkeypatch):
    p = tmp_path / "a.json"
    p.write_text("original", encoding="utf-8")

    import app.utils.atomic_io as aio

    def boom(src, dst):
        raise OSError("replace failed")

    monkeypatch.setattr(aio.os, "replace", boom)
    try:
        atomic_write_text(p, "new")
    except OSError:
        pass

    # A failed replace must leave the original intact and drop the temp file.
    assert p.read_text(encoding="utf-8") == "original"
    assert [f for f in os.listdir(tmp_path) if f.startswith(".tmp-")] == []


def test_file_lock_reacquires_across_sequential_blocks(tmp_path):
    p = tmp_path / "a.json"
    with file_lock(p):
        pass
    with file_lock(p):  # must not deadlock or raise
        atomic_write_text(p, "ok")
    assert p.read_text(encoding="utf-8") == "ok"
