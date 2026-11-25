import subprocess
import sys
import pytest

def test_cli_help():
    cmd = [sys.executable, "-m", "codesage.cli", "--help"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    assert res.returncode == 0
    assert "CodeSage CLI: AI Code Review & Repo Q&A" in res.stdout
    assert "index" in res.stdout
    assert "search" in res.stdout
    assert "ask" in res.stdout
    assert "review" in res.stdout
