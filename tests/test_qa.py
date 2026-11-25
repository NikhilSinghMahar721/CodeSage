import pytest
from codesage.ingestion.chunker import CodeChunk
from codesage.qa.service import QAService
from codesage.retrieval.hybrid import HybridRetriever
from codesage.llm.client import LLMClient

def test_qa_service_with_citations():
    chunk = CodeChunk(
        id="c1",
        file_path="sample.py",
        language="python",
        symbol_name="handle_request",
        symbol_type="function",
        start_line=10,
        end_line=25,
        content="def handle_request():\n    pass"
    )

    class MockRetriever:
        def retrieve(self, query, mode="hybrid", top_k=5):
            return [(chunk, 0.95)]

    mock_llm = LLMClient(provider="mock")
    qa = QAService(retriever=MockRetriever(), llm_client=mock_llm)

    resp = qa.ask("How does sample.py handle requests?")
    assert resp.question == "How does sample.py handle requests?"
    assert len(resp.citations) >= 1
    assert resp.citations[0].is_valid is True
    assert resp.citations[0].raw_citation == "sample.py:10-25"
