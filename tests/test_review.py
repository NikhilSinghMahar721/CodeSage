import pytest
from codesage.llm.client import LLMClient
from codesage.review.service import ReviewService
from codesage.review.schemas import FindingSeverity

DIFF_WITH_SQLI = """diff --git a/app/db/users.py b/app/db/users.py
--- a/app/db/users.py
+++ b/app/db/users.py
@@ -10,6 +10,7 @@ def find_user(email):
+    query = f"SELECT * FROM users WHERE email = '{email}'"
+    cursor.execute(query)
"""

def test_review_service_mock_detects_sqli():
    mock_llm = LLMClient(provider="mock")
    reviewer = ReviewService(llm_client=mock_llm)

    review = reviewer.review_diff(DIFF_WITH_SQLI)
    assert len(review.findings) >= 1

    sqli_finding = review.findings[0]
    assert sqli_finding.severity == FindingSeverity.HIGH
    assert "SQL injection" in sqli_finding.issue
    assert "parameterized" in sqli_finding.suggestion.lower()

def test_review_service_filtering():
    mock_llm = LLMClient(provider="mock")
    reviewer = ReviewService(llm_client=mock_llm)

    # Filter with min_confidence higher than finding confidence
    review = reviewer.review_diff(DIFF_WITH_SQLI, min_confidence=0.999)
    assert len(review.findings) == 0
