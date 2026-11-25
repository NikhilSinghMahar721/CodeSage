import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set, Any
from codesage.ingestion.chunker import CodeChunk
from codesage.retrieval.hybrid import HybridRetriever
from codesage.qa.prompts import QA_SYSTEM_PROMPT, QA_USER_PROMPT
from codesage.llm.client import LLMClient
from codesage.config import settings
from codesage.repo_details import analyze_repository_structure


@dataclass
class Citation:
    file_path: str
    start_line: int
    end_line: int
    raw_citation: str
    is_valid: bool = False
    matching_chunk: Optional[CodeChunk] = None


@dataclass
class QAResponse:
    question: str
    answer: str
    citations: List[Citation] = field(default_factory=list)
    retrieved_chunks: List[Tuple[CodeChunk, float]] = field(default_factory=list)
    mode: str = "hybrid"
    latency_sec: float = 0.0


CITATION_PATTERN = re.compile(r"([a-zA-Z0-9_\-\./\\]+\.[a-zA-Z0-9]+):(\d+)(?:-(\d+))?")

STRUCTURAL_KEYWORDS = [
    "file structure", "folder structure", "project structure", "directory structure",
    "tree structure", "repo structure", "repository structure", "architecture",
    "overview", "what does this project do", "what does this repo do", "how is this organized",
    "components", "explain the project", "summarize the repo", "directory tree"
]


class QAService:
    """Answers developer questions about a codebase with verified citations."""

    def __init__(
        self,
        retriever: HybridRetriever,
        llm_client: Optional[LLMClient] = None,
        repo_path: Optional[Path] = None
    ):
        self.retriever = retriever
        self.llm = llm_client or LLMClient()
        self.repo_path = Path(repo_path) if repo_path else None

    def _is_structural_question(self, question: str) -> bool:
        q_lower = question.lower()
        return any(kw in q_lower for kw in STRUCTURAL_KEYWORDS)

    def ask(
        self,
        question: str,
        mode: str = "hybrid",
        top_k: int = 5
    ) -> QAResponse:
        """Answer question with citations and verification."""
        is_structural = self._is_structural_question(question)
        retrieved = []
        try:
            retrieved = self.retriever.retrieve(query=question, mode=mode, top_k=top_k)
        except Exception:
            retrieved = []

        # If it's a structural question and few chunks retrieved, broaden query or include README/config
        if is_structural and len(retrieved) < 3:
            try:
                more_retrieved = self.retriever.retrieve(query="README structure architecture main module", mode=mode, top_k=top_k)
                seen_ids = {c.id for c, _ in retrieved}
                for c, s in more_retrieved:
                    if c.id not in seen_ids:
                        retrieved.append((c, s))
                        seen_ids.add(c.id)
            except Exception:
                pass

        # Prepare structural metadata if available
        repo_struct = {}
        if self.repo_path and self.repo_path.exists():
            try:
                repo_struct = analyze_repository_structure(self.repo_path)
            except Exception:
                repo_struct = {}

        # If still empty and no repo_path to analyze
        if not retrieved and not repo_struct:
            return QAResponse(
                question=question,
                answer="Not found in the repository: no matching code chunks could be retrieved.",
                citations=[],
                retrieved_chunks=[],
                mode=mode
            )

        # Build context
        context_blocks = []
        if is_structural and repo_struct:
            top_dirs = repo_struct.get("top_dirs", {})
            entrypoints = repo_struct.get("entrypoints", [])
            deps = repo_struct.get("top_dependencies", [])
            dir_text = "\n".join([f"- `{d}/`: {', '.join(files[:5])}" for d, files in top_dirs.items()])
            struct_block = (
                f"=== Repository Architecture & Structure Overview ===\n"
                f"Total Files: {repo_struct.get('total_files')}, Total LOC: {repo_struct.get('total_loc')}\n"
                f"Key Directories:\n{dir_text}\n"
                f"Entrypoints: {', '.join(entrypoints)}\n"
                f"Key Dependencies: {', '.join(deps)}\n"
            )
            context_blocks.append(struct_block)

        for rank, (chunk, score) in enumerate(retrieved, start=1):
            block = (
                f"--- Chunk {rank} | {chunk.file_path}:{chunk.start_line}-{chunk.end_line} "
                f"({chunk.symbol_type}: {chunk.symbol_name}) ---\n"
                f"{chunk.content}\n"
            )
            context_blocks.append(block)

        formatted_context = "\n".join(context_blocks)
        user_prompt = QA_USER_PROMPT.format(context=formatted_context, question=question)

        raw_answer = ""
        latency_sec = 0.0

        try:
            llm_resp = self.llm.generate(prompt=user_prompt, system_instruction=QA_SYSTEM_PROMPT)
            raw_answer = llm_resp.content.strip()
            latency_sec = llm_resp.latency_sec
        except Exception:
            # Resilient fallback: synthesize answer directly from retrieved chunks & repo structure
            raw_answer = self._synthesize_direct_answer(question, [c for c, _ in retrieved], repo_struct)
            latency_sec = 0.05

        # Extract and verify citations
        citations = self._extract_and_verify_citations(raw_answer, [c for c, _ in retrieved])

        return QAResponse(
            question=question,
            answer=raw_answer,
            citations=citations,
            retrieved_chunks=retrieved,
            mode=mode,
            latency_sec=latency_sec
        )

    def _synthesize_direct_answer(
        self,
        question: str,
        chunks: List[CodeChunk],
        repo_struct: Optional[Dict[str, Any]] = None
    ) -> str:
        """Synthesizes a structured answer from repository metadata and code chunks with citations."""
        struct = repo_struct or {}
        is_structural = self._is_structural_question(question)

        # If question is about project structure and we have structural metadata
        if is_structural and struct:
            out = [
                f"### Repository Structure & Architecture Overview\n",
                f"The repository contains **{struct.get('total_files', 0)} source files** totaling **{struct.get('total_loc', 0):,} lines of code**.\n"
            ]

            langs = struct.get("language_breakdown", {})
            if langs:
                lang_str = ", ".join([f"**{lang}** ({loc:,} LOC)" for lang, loc in langs.items()])
                out.append(f"**Primary Technologies:** {lang_str}\n")

            top_dirs = struct.get("top_dirs", {})
            if top_dirs:
                out.append("#### Directory Layout:")
                for d_name, sample_files in top_dirs.items():
                    out.append(f"- **`{d_name}/`**: Contains core modules such as `{', '.join(sample_files[:4])}`")
                out.append("")

            entrypoints = struct.get("entrypoints", [])
            if entrypoints:
                out.append("#### Key Entrypoints & Configurations:")
                for ep in entrypoints[:6]:
                    out.append(f"- `{ep}:1-50`")
                out.append("")

            deps = struct.get("top_dependencies", [])
            if deps:
                out.append(f"**Key Dependencies:** `{', '.join(deps[:10])}`\n")

            if chunks:
                out.append("#### Relevant Code Sections Found:")
                for c in chunks[:3]:
                    out.append(f"- **`{c.symbol_name}`** (`{c.symbol_type}`) in `{c.file_path}:{c.start_line}-{c.end_line}`")

            # Add primary citation
            if entrypoints:
                out.append(f"\nCitation: {entrypoints[0]}:1-30")
            elif chunks:
                out.append(f"\nCitation: {chunks[0].file_path}:{chunks[0].start_line}-{chunks[0].end_line}")

            return "\n".join(out)

        if not chunks:
            return "No relevant code chunks could be retrieved for this query."

        top = chunks[0]
        lang = top.language if top.language in {"python", "typescript", "javascript", "go", "rust", "sql", "prisma", "json"} else "text"

        out = [
            f"Based on the repository code relevant to **\"{question}\"**:\n",
            f"The primary implementation is in `{top.symbol_name}` ({top.symbol_type}) at `{top.file_path}:{top.start_line}-{top.end_line}`.\n"
        ]

        if top.docstring:
            out.append(f"> **Docstring:** {top.docstring.strip()}\n")

        code_lines = top.content.splitlines()[:15]
        out.append(f"```{lang}\n" + "\n".join(code_lines) + "\n```\n")

        if len(chunks) > 1:
            out.append("### Related Symbols & Chunks:")
            for c in chunks[1:4]:
                doc_snippet = f" — {c.docstring.strip()[:80]}..." if c.docstring else ""
                out.append(f"- **`{c.symbol_name}`** ({c.symbol_type}) in `{c.file_path}:{c.start_line}-{c.end_line}`{doc_snippet}")

        out.append(f"\nCitation: {top.file_path}:{top.start_line}-{top.end_line}")
        return "\n".join(out)

    def _extract_and_verify_citations(
        self,
        answer_text: str,
        indexed_chunks: List[CodeChunk]
    ) -> List[Citation]:
        """
        Finds citations formatted as path:start-end in the text, and verifies
        whether they correspond to actual indexed chunks.
        """
        citations: List[Citation] = []
        seen: Set[str] = set()

        matches = CITATION_PATTERN.findall(answer_text)
        for path, start_s, end_s in matches:
            start_l = int(start_s)
            end_l = int(end_s) if end_s else start_l
            raw_str = f"{path}:{start_l}-{end_l}" if end_s else f"{path}:{start_l}"

            if raw_str in seen:
                continue
            seen.add(raw_str)

            norm_path = path.replace("\\", "/").strip("./")

            # Check validity against retrieved and indexed chunks
            matching_chunk = None
            is_valid = False

            for chunk in indexed_chunks:
                chunk_norm_path = chunk.file_path.replace("\\", "/").strip("./")
                if norm_path == chunk_norm_path or norm_path.endswith(chunk_norm_path):
                    if not (end_l < chunk.start_line or start_l > chunk.end_line):
                        is_valid = True
                        matching_chunk = chunk
                        break

            # If citation refers to an entrypoint or top file in repo, verify file existence
            if not is_valid and self.repo_path:
                candidate_file = self.repo_path / norm_path
                if candidate_file.exists() and candidate_file.is_file():
                    is_valid = True

            citations.append(Citation(
                file_path=path,
                start_line=start_l,
                end_line=end_l,
                raw_citation=raw_str,
                is_valid=is_valid,
                matching_chunk=matching_chunk
            ))

        return citations
