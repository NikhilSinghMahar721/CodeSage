import pytest
from codesage.review.diff_parser import parse_unified_diff

SAMPLE_DIFF = """diff --git a/app/search.py b/app/search.py
index e69de29..b70e7e1 100644
--- a/app/search.py
+++ b/app/search.py
@@ -5,6 +5,8 @@ def binary_search(arr, target):
     low = 0
-    high = len(arr)
+    high = len(arr) - 1
+    iterations = 0
     while low <= high:
         mid = (low + high) // 2
"""

def test_parse_unified_diff():
    diffs = parse_unified_diff(SAMPLE_DIFF)
    assert len(diffs) == 1

    fd = diffs[0]
    assert fd.old_path == "app/search.py"
    assert fd.new_path == "app/search.py"
    assert len(fd.hunks) == 1

    hunk = fd.hunks[0]
    assert hunk.old_start == 5
    assert hunk.new_start == 5
    assert len(hunk.added_lines) == 2
    assert len(hunk.deleted_lines) == 1
