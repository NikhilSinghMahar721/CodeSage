import pytest
from pathlib import Path
from codesage.indexing.bm25_store import BM25Index, code_tokenize
from codesage.ingestion.chunker import CodeChunk

def test_code_tokenize():
    tokens = code_tokenize("getUserById(userId: int) -> UserProfile")
    assert "get" in tokens
    assert "user" in tokens
    assert "id" in tokens
    assert "userprofile" in tokens or "profile" in tokens

    snake_tokens = code_tokenize("parse_unified_diff_hunk")
    assert "parse" in snake_tokens
    assert "unified" in snake_tokens
    assert "diff" in snake_tokens
    assert "hunk" in snake_tokens

def test_bm25_build_and_query(tmp_path: Path):
    chunks = [
        CodeChunk(
            id="c1",
            file_path="auth/jwt.py",
            language="python",
            symbol_name="verify_jwt_token",
            symbol_type="function",
            start_line=1,
            end_line=15,
            content="def verify_jwt_token(token: str):\n    # decode jwt signature\n    pass",
            docstring="Decode and verify JWT access token.",
            imports=["jwt", "time"]
        ),
        CodeChunk(
            id="c2",
            file_path="db/users.py",
            language="python",
            symbol_name="get_user_by_email",
            symbol_type="function",
            start_line=1,
            end_line=20,
            content="def get_user_by_email(email: str):\n    return db.query(User).filter_by(email=email).first()",
            docstring="Fetch user entity by email.",
            imports=["sqlalchemy"]
        )
    ]

    index = BM25Index()
    index.build(chunks)

    # Query matching c1
    results = index.query("jwt token verify", top_k=2)
    assert len(results) >= 1
    assert results[0][0].id == "c1"

    # Query matching c2
    results_user = index.query("query user email", top_k=2)
    assert len(results_user) >= 1
    assert results_user[0][0].id == "c2"

    # Test save and load
    save_path = tmp_path / "bm25.pkl"
    index.save(save_path)
    assert save_path.exists()

    loaded_index = BM25Index.load(save_path)
    loaded_results = loaded_index.query("jwt token", top_k=1)
    assert len(loaded_results) == 1
    assert loaded_results[0][0].id == "c1"
