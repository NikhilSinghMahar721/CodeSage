import pytest
from pathlib import Path
from codesage.repo_details import parse_github_url, analyze_repository_structure

def test_parse_github_url():
    assert parse_github_url("https://github.com/psf/requests") == ("psf", "requests")
    assert parse_github_url("https://github.com/pallets/flask.git") == ("pallets", "flask")
    assert parse_github_url("github.com/tiangolo/fastapi") == ("tiangolo", "fastapi")
    assert parse_github_url("pallets/click") == ("pallets", "click")
    assert parse_github_url(".") is None
    assert parse_github_url("C:/local/path") is None

def test_analyze_repository_structure(tmp_path: Path):
    # Create sample repo layout
    sub = tmp_path / "pkg"
    sub.mkdir()
    py_file = sub / "app.py"
    py_file.write_text("import requests\nfrom pydantic import BaseModel\n\nx = 1\n", encoding="utf-8")

    stats = analyze_repository_structure(tmp_path)
    assert stats["total_files"] == 1
    assert stats["total_loc"] == 4
    assert ".py" in stats["extension_breakdown"]
    assert "requests" in stats["top_dependencies"]
    assert "pydantic" in stats["top_dependencies"]
