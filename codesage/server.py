import os
import time
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from codesage.config import settings, BASE_DIR
from codesage.indexing.indexer import RepoIndexer
from codesage.retrieval.hybrid import HybridRetriever
from codesage.qa.service import QAService
from codesage.review.service import ReviewService, fetch_github_pr_diff
from codesage.review.schemas import ReviewOutput, FindingSeverity
from codesage.llm.client import LLMClient
from codesage.ingestion.cloner import Cloner, walk_code_files
from codesage.repo_details import (
    parse_github_url,
    fetch_github_api_metadata,
    analyze_repository_structure,
    save_recent_repo,
    get_recent_repos
)

app = FastAPI(
    title="CodeSage API",
    description="Backend API for AI-powered Code Review and Repository Q&A",
    version="0.1.0"
)

# Enable CORS for local React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server error: {str(exc)}"}
    )

# Active repository state
_indexer: Optional[RepoIndexer] = None
_active_repo_info: Dict[str, Any] = {}

def get_current_repo_path() -> str:
    global _active_repo_info
    return _active_repo_info.get("path") or "."

def get_indexer(repo_path: Optional[str] = None) -> RepoIndexer:
    global _indexer, _active_repo_info
    target = repo_path or get_current_repo_path()

    if _indexer is None or str(_indexer.repo_path) != str(Path(target).resolve()):
        _indexer = RepoIndexer(target)
        _indexer.load_existing_index()
    return _indexer

# --- Request/Response Models ---

class LoadRepoRequest(BaseModel):
    repo_url_or_path: str = Field(..., description="GitHub URL or local repository path")
    auto_index: bool = Field(default=True, description="Whether to index the repository immediately")

class IndexRequest(BaseModel):
    repo_path: Optional[str] = Field(default=None, description="Local directory path or git URL")

class SearchRequest(BaseModel):
    query: str
    mode: str = Field(default="hybrid", description="hybrid | vector | bm25")
    top_k: int = Field(default=5, ge=1, le=50)
    repo_path: Optional[str] = None

class SearchResultItem(BaseModel):
    id: str
    file_path: str
    language: str
    symbol_name: str
    symbol_type: str
    start_line: int
    end_line: int
    content: str
    imports: List[str]
    docstring: Optional[str]
    score: float

class QARequest(BaseModel):
    question: str
    mode: str = Field(default="hybrid", description="hybrid | vector | bm25")
    top_k: int = Field(default=5, ge=1, le=20)
    repo_path: Optional[str] = None

class ReviewRequest(BaseModel):
    diff_text: Optional[str] = None
    pr_url: Optional[str] = None
    severity: Optional[str] = None
    min_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    repo_path: Optional[str] = None

class SettingsUpdate(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    retrieval_mode: Optional[str] = None
    top_k: Optional[int] = None

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "provider": settings.llm_provider,
        "model": settings.llm_model,
        "retrieval_mode": settings.retrieval_mode,
        "base_dir": str(BASE_DIR)
    }

@app.post("/api/repo/load")
def load_repository(req: LoadRepoRequest):
    """
    Generalized GitHub & Local Repository Ingestion:
    1. Parse GitHub URL or resolve local path
    2. Clone if remote git URL
    3. Extract GitHub API metadata (stars, forks, open issues, description, topics, license)
    4. Analyze structure (LOC, file extensions, top dependencies, entrypoints, git commits)
    5. Optionally index or load existing vector/BM25 store
    """
    global _indexer, _active_repo_info

    input_target = req.repo_url_or_path.strip()
    cloner = Cloner()

    # Check if input is GitHub URL or shorthand
    gh_match = parse_github_url(input_target)
    is_github = gh_match is not None

    github_meta = {}
    if is_github:
        owner, repo_name = gh_match
        github_meta = fetch_github_api_metadata(owner, repo_name)
        # Ensure it has https:// URL for cloner
        clone_url = f"https://github.com/{owner}/{repo_name}.git"
        try:
            resolved_path = cloner.resolve_repo_path(clone_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        try:
            resolved_path = cloner.resolve_repo_path(input_target)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to resolve repository path: {str(e)}")

    # Inspect repository structure & code metrics
    try:
        structure = analyze_repository_structure(resolved_path)
    except Exception:
        structure = {
            "total_files": 0,
            "total_loc": 0,
            "language_breakdown": {},
            "extension_breakdown": {},
            "top_dependencies": [],
            "entrypoints": [],
            "last_commit": None,
            "readme_snippet": "",
            "top_dirs": {}
        }

    # Initialize indexer
    indexer = None
    is_indexed = False
    index_stats = None
    chunks_count = 0

    try:
        indexer = RepoIndexer(str(resolved_path))
        _indexer = indexer
        is_indexed = indexer.load_existing_index()
        chunks_count = len(indexer.chunks)

        if req.auto_index and (not is_indexed or chunks_count == 0):
            try:
                index_stats = indexer.index()
                is_indexed = True
                chunks_count = len(indexer.chunks)
            except Exception as idx_err:
                index_stats = {"error": str(idx_err)}
    except Exception as e:
        index_stats = {"error": str(e)}

    # Assemble comprehensive repository details
    repo_info = {
        "input_target": input_target,
        "path": str(resolved_path),
        "name": github_meta.get("name") or resolved_path.name,
        "full_name": github_meta.get("full_name") or resolved_path.name,
        "is_github": is_github,
        "github": github_meta,
        "structure": structure,
        "total_files": structure.get("total_files", 0),
        "total_loc": structure.get("total_loc", 0),
        "total_chunks": chunks_count,
        "is_indexed": is_indexed,
        "index_stats": index_stats,
        "last_accessed": time.time()
    }

    _active_repo_info = repo_info
    save_recent_repo(repo_info)

    return repo_info

@app.get("/api/repo/current")
def get_current_repo():
    global _active_repo_info
    if not _active_repo_info:
        # Load local repo as default
        return load_repository(LoadRepoRequest(repo_url_or_path=".", auto_index=False))
    return _active_repo_info

@app.get("/api/repo/recent")
def list_recent_repositories():
    return get_recent_repos()

@app.get("/api/stats")
def get_stats(repo_path: Optional[str] = None):
    try:
        target = repo_path or get_current_repo_path()
        indexer = get_indexer(target)
        total_chunks = len(indexer.chunks)
        vector_count = 0
        try:
            vector_count = indexer.vector_store.collection.count()
        except Exception:
            pass

        # Gather symbol type distribution
        symbol_types: Dict[str, int] = {}
        files_set = set()
        for c in indexer.chunks:
            symbol_types[c.symbol_type] = symbol_types.get(c.symbol_type, 0) + 1
            files_set.add(c.file_path)

        structure = _active_repo_info.get("structure", {}) if _active_repo_info else {}
        total_loc = structure.get("total_loc", 0)

        return {
            "repo_name": indexer.repo_name,
            "repo_path": str(indexer.repo_path),
            "total_files": len(files_set) or structure.get("total_files", 0),
            "total_loc": total_loc,
            "total_chunks": total_chunks,
            "vector_store_chunks": vector_count,
            "symbol_breakdown": symbol_types,
            "is_indexed": total_chunks > 0 or vector_count > 0,
            "active_repo": _active_repo_info,
            "settings": {
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "embedding_model": settings.embedding_model,
                "retrieval_mode": settings.retrieval_mode,
                "has_gemini_key": bool(settings.gemini_api_key),
                "has_openai_key": bool(settings.openai_api_key),
            }
        }
    except Exception as e:
        return {
            "repo_name": "repository",
            "repo_path": target if "target" in locals() else ".",
            "total_files": 0,
            "total_loc": 0,
            "total_chunks": 0,
            "vector_store_chunks": 0,
            "symbol_breakdown": {},
            "is_indexed": False,
            "active_repo": _active_repo_info,
            "settings": {
                "provider": settings.llm_provider,
                "model": settings.llm_model,
                "embedding_model": settings.embedding_model,
                "retrieval_mode": settings.retrieval_mode,
                "has_gemini_key": bool(settings.gemini_api_key),
                "has_openai_key": bool(settings.openai_api_key),
            }
        }

@app.post("/api/index")
def index_repo(req: IndexRequest):
    global _indexer
    target = req.repo_path or get_current_repo_path()
    indexer = RepoIndexer(target)
    _indexer = indexer

    stats = indexer.index()
    if _active_repo_info and _active_repo_info.get("path") == str(indexer.repo_path):
        _active_repo_info["is_indexed"] = True
        _active_repo_info["total_chunks"] = len(indexer.chunks)
        _active_repo_info["index_stats"] = stats

    return {
        "success": True,
        "stats": stats
    }

@app.post("/api/search")
def search_code(req: SearchRequest) -> List[SearchResultItem]:
    try:
        target = req.repo_path or get_current_repo_path()
        indexer = get_indexer(target)
        if not indexer.chunks and not indexer.load_existing_index():
            try:
                indexer.index()
            except Exception:
                pass

        retriever = HybridRetriever(indexer.vector_store, indexer.bm25_index)
        results = retriever.retrieve(req.query, mode=req.mode, top_k=req.top_k)

        items = []
        for chunk, score in results:
            items.append(SearchResultItem(
                id=chunk.id,
                file_path=chunk.file_path,
                language=chunk.language,
                symbol_name=chunk.symbol_name,
                symbol_type=chunk.symbol_type,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                content=chunk.content,
                imports=chunk.imports,
                docstring=chunk.docstring,
                score=round(float(score), 4)
            ))
        return items
    except Exception:
        return []

@app.post("/api/qa")
def ask_question(req: QARequest):
    try:
        target = req.repo_path or get_current_repo_path()
        indexer = get_indexer(target)
        if not indexer.chunks and not indexer.load_existing_index():
            try:
                indexer.index()
            except Exception:
                pass

        retriever = HybridRetriever(indexer.vector_store, indexer.bm25_index)
        qa = QAService(retriever, repo_path=indexer.repo_path)
        resp = qa.ask(req.question, mode=req.mode, top_k=req.top_k)

        return {
            "question": resp.question,
            "answer": resp.answer,
            "citations": [
                {
                    "file_path": c.file_path,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "raw_citation": c.raw_citation,
                    "is_valid": c.is_valid
                }
                for c in resp.citations
            ],
            "retrieved_chunks": [
                {
                    "id": c.id,
                    "file_path": c.file_path,
                    "symbol_name": c.symbol_name,
                    "symbol_type": c.symbol_type,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "score": round(float(s), 4),
                    "content": c.content
                }
                for c, s in resp.retrieved_chunks
            ],
            "latency_sec": round(resp.latency_sec, 3),
            "mode": resp.mode
        }
    except Exception as e:
        return {
            "question": req.question,
            "answer": f"Unable to retrieve answer: {str(e)}",
            "citations": [],
            "retrieved_chunks": [],
            "latency_sec": 0.0,
            "mode": req.mode
        }

@app.post("/api/review")
def review_diff(req: ReviewRequest):
    diff_text = req.diff_text

    if not diff_text and req.pr_url:
        try:
            diff_text = fetch_github_pr_diff(req.pr_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch PR diff: {e}")

    if not diff_text:
        raise HTTPException(status_code=400, detail="Either diff_text or pr_url must be provided.")

    target = req.repo_path or get_current_repo_path()
    repo_p = Path(target) if target else None
    reviewer = ReviewService(repo_path=repo_p)

    try:
        review = reviewer.review_diff(
            diff_text,
            severity_filter=req.severity,
            min_confidence=req.min_confidence
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Review failed: {e}")

    return {
        "summary": review.summary,
        "findings": [
            {
                "file": f.file,
                "line": f.line,
                "category": f.category.value,
                "severity": f.severity.value,
                "confidence": round(f.confidence, 2),
                "issue": f.issue,
                "suggestion": f.suggestion
            }
            for f in review.findings
        ]
    }

@app.get("/api/files")
def list_files(repo_path: Optional[str] = None):
    target = repo_path or get_current_repo_path()
    p = Path(target).resolve()
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    file_list = []
    for abs_path, rel_path in walk_code_files(p):
        try:
            size = abs_path.stat().st_size
        except OSError:
            size = 0
        file_list.append({
            "path": rel_path,
            "name": abs_path.name,
            "size_bytes": size
        })
    return sorted(file_list, key=lambda x: x["path"])

@app.get("/api/file-content")
def get_file_content(file_path: str, repo_path: Optional[str] = None):
    target = repo_path or get_current_repo_path()
    p = (Path(target) / file_path).resolve()
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail=f"File '{file_path}' not found")

    try:
        content = p.read_text(encoding="utf-8", errors="replace")
        return {
            "file_path": file_path,
            "content": content,
            "lines": len(content.splitlines())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/settings")
def get_settings():
    return {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "has_gemini_key": bool(settings.gemini_api_key),
        "has_openai_key": bool(settings.openai_api_key),
        "has_anthropic_key": bool(settings.anthropic_api_key),
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
        "embedding_model": settings.embedding_model,
        "retrieval_mode": settings.retrieval_mode,
        "top_k": settings.top_k,
    }

@app.post("/api/settings")
def update_settings(update: SettingsUpdate):
    if update.llm_provider is not None:
        settings.llm_provider = update.llm_provider.lower()
    if update.llm_model is not None:
        settings.llm_model = update.llm_model
    if update.gemini_api_key is not None:
        settings.gemini_api_key = update.gemini_api_key
    if update.openai_api_key is not None:
        settings.openai_api_key = update.openai_api_key
    if update.anthropic_api_key is not None:
        settings.anthropic_api_key = update.anthropic_api_key
    if update.ollama_base_url is not None:
        settings.ollama_base_url = update.ollama_base_url
    if update.ollama_model is not None:
        settings.ollama_model = update.ollama_model
    if update.retrieval_mode is not None:
        settings.retrieval_mode = update.retrieval_mode.lower()
    if update.top_k is not None:
        settings.top_k = update.top_k

    return {"success": True, "settings": get_settings()}

# Mount frontend build if it exists
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
