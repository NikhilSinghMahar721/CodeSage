import pytest
from codesage.indexing.embedder import Embedder

def test_fallback_embedder():
    embedder = Embedder()
    vec = embedder._fallback_embed("hello world test", dim=128)
    assert len(vec) == 128
    # Assert vector is normalized (unit length approximately 1.0)
    norm = sum(x**2 for x in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-4

def test_embed_query_and_texts():
    embedder = Embedder()
    embedder._model = "fallback"
    vectors = embedder.embed_texts(["function add(a, b)", "class User"])
    assert len(vectors) == 2
    assert len(vectors[0]) == 384

    q_vec = embedder.embed_query("search query")
    assert len(q_vec) == 384
