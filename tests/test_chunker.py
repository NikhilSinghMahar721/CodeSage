import pytest
from pathlib import Path
from codesage.ingestion.chunker import chunk_file, chunk_python_code, CodeChunk

SAMPLE_CODE = """import os
import sys

GLOBAL_VAR = "hello"

def helper_func(x: int) -> int:
    \"\"\"Calculates square.\"\"\"
    return x * x

class Calculator:
    \"\"\"A simple calculator class.\"\"\"

    def __init__(self, base: int = 0):
        self.base = base

    def add(self, val: int) -> int:
        return self.base + val

# Top level execution
result = helper_func(5)
"""

def test_chunk_python_code_extracts_symbols():
    chunks = chunk_python_code(SAMPLE_CODE, rel_path="sample.py")
    assert len(chunks) >= 3

    symbols = {c.symbol_name: c for c in chunks}
    assert "helper_func" in symbols
    assert "Calculator" in symbols

    func_chunk = symbols["helper_func"]
    assert func_chunk.symbol_type == "function"
    assert "Calculates square." in (func_chunk.docstring or "")
    assert "os" in func_chunk.imports
    assert "sys" in func_chunk.imports

    class_chunk = symbols["Calculator"]
    assert class_chunk.symbol_type == "class"
    assert "A simple calculator class." in (class_chunk.docstring or "")

def test_chunk_file(tmp_path: Path):
    f = tmp_path / "test_module.py"
    f.write_text(SAMPLE_CODE, encoding="utf-8")

    chunks = chunk_file(f, rel_path="test_module.py")
    assert len(chunks) > 0
    assert all(c.file_path == "test_module.py" for c in chunks)
    assert all(c.language == "python" for c in chunks)

def test_chunk_syntax_error_fallback(tmp_path: Path):
    bad_code = "def broken_syntax(:\n    return None\n"
    f = tmp_path / "broken.py"
    f.write_text(bad_code, encoding="utf-8")

    chunks = chunk_file(f, rel_path="broken.py")
    # Should fallback to line-based chunking without raising an exception
    assert len(chunks) >= 1
    assert chunks[0].symbol_type == "window"
