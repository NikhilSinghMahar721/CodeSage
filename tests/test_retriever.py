import pytest
from codesage.ingestion.chunker import CodeChunk
from codesage.retrieval.hybrid import reciprocal_rank_fusion, HybridRetriever

def test_reciprocal_rank_fusion():
    c1 = CodeChunk(id="c1", file_path="a.py", language="python", symbol_name="fn1", symbol_type="function", start_line=1, end_line=5, content="")
    c2 = CodeChunk(id="c2", file_path="b.py", language="python", symbol_name="fn2", symbol_type="function", start_line=1, end_line=5, content="")
    c3 = CodeChunk(id="c3", file_path="c.py", language="python", symbol_name="fn3", symbol_type="function", start_line=1, end_line=5, content="")

    vec_results = [(c1, 0.9), (c2, 0.7)]
    bm25_results = [(c2, 5.0), (c3, 3.0)]

    fused = reciprocal_rank_fusion(vec_results, bm25_results, rrf_k=60, top_k=3)
    assert len(fused) == 3
    # c2 was present in both, so it should rank higher
    top_chunk, _ = fused[0]
    assert top_chunk.id == "c2"

def test_hybrid_retriever_modes():
    class MockStore:
        def query(self, q, top_k=5):
            c = CodeChunk(id="m1", file_path="m.py", language="python", symbol_name="mock", symbol_type="function", start_line=1, end_line=2, content="mock")
            return [(c, 0.95)]

    retriever = HybridRetriever(vector_store=MockStore(), bm25_index=MockStore())
    res_vec = retriever.retrieve("query", mode="vector")
    assert len(res_vec) == 1

    res_bm25 = retriever.retrieve("query", mode="bm25")
    assert len(res_bm25) == 1

    res_hybrid = retriever.retrieve("query", mode="hybrid")
    assert len(res_hybrid) == 1
