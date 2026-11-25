import pytest
from fastapi.testclient import TestClient
from codesage.config import settings

# Configure mock provider for fast and offline test suite
settings.llm_provider = "mock"

from codesage.server import app

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_stats_endpoint():
    res = client.get("/api/stats?repo_path=.")
    assert res.status_code == 200
    data = res.json()
    assert "total_chunks" in data
    assert "symbol_breakdown" in data

def test_load_repo_endpoint():
    res = client.post("/api/repo/load", json={
        "repo_url_or_path": ".",
        "auto_index": False
    })
    assert res.status_code == 200
    data = res.json()
    assert "path" in data
    assert "structure" in data
    assert data["structure"]["total_loc"] > 0

def test_recent_repos_endpoint():
    res = client.get("/api/repo/recent")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_search_endpoint():
    res = client.post("/api/search", json={
        "query": "reciprocal rank fusion",
        "mode": "hybrid",
        "top_k": 3,
        "repo_path": "."
    })
    assert res.status_code == 200
    results = res.json()
    assert isinstance(results, list)
    assert len(results) > 0
    assert "symbol_name" in results[0]
    assert "score" in results[0]

def test_qa_endpoint():
    res = client.post("/api/qa", json={
        "question": "Where is the hybrid retriever implemented?",
        "mode": "hybrid",
        "top_k": 3,
        "repo_path": "."
    })
    assert res.status_code == 200
    data = res.json()
    assert "answer" in data
    assert "citations" in data

def test_review_endpoint():
    sample_diff = """diff --git a/app/db.py b/app/db.py
--- a/app/db.py
+++ b/app/db.py
@@ -1,3 +1,3 @@
-cursor.execute('SELECT * FROM users WHERE email = %s', (email,))
+cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")
"""
    res = client.post("/api/review", json={
        "diff_text": sample_diff,
        "min_confidence": 0.0
    })
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "findings" in data

def test_frontend_static_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "<!doctype html>" in res.text.lower()
    assert "codesage" in res.text.lower()
