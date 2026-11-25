import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Set
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

@dataclass
class Settings:
    # LLM Settings
    llm_provider: str = os.getenv("LLM_PROVIDER", "gemini").lower()
    llm_model: str = os.getenv("LLM_MODEL", "gemini-3-flash-preview")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "codellama")

    # GitHub
    github_token: str = os.getenv("GITHUB_TOKEN", "")

    # Retrieval & Indexing
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    retrieval_mode: str = os.getenv("RETRIEVAL_MODE", "hybrid").lower()  # vector | bm25 | hybrid
    top_k: int = int(os.getenv("TOP_K", "5"))
    rrf_k: int = 60  # Standard RRF constant

    # Storage Paths
    chroma_persist_dir: Path = BASE_DIR / os.getenv("CHROMA_PERSIST_DIR", ".chroma_db")
    repos_cache_dir: Path = BASE_DIR / os.getenv("REPOS_CACHE_DIR", ".repos")

    # File Ingestion Constraints
    max_file_size_bytes: int = 250 * 1024  # 250 KB max per file
    ignored_dirs: Set[str] = field(default_factory=lambda: {
        ".git", ".github", ".venv", "venv", "env", "ENV",
        "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
        "node_modules", "bower_components", "dist", "build", "eggs",
        ".eggs", "*.egg-info", "site-packages", ".idea", ".vscode",
        ".chroma_db", ".repos", "cloned_repos", ".next", ".turbo",
        "coverage", ".coverage", "out", ".nuxt", ".svelte-kit",
        "target", "bin", "obj"
    })
    ignored_extensions: Set[str] = field(default_factory=lambda: {
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
        ".pdf", ".zip", ".tar", ".gz", ".7z", ".rar",
        ".exe", ".dll", ".so", ".dylib", ".bin",
        ".pyc", ".pyo", ".pyd", ".db", ".sqlite", ".sqlite3",
        ".lock", ".log", ".min.js", ".min.css", ".map"
    })
    supported_extensions: Set[str] = field(default_factory=lambda: {
        # Python
        ".py", ".pyw",
        # JavaScript & TypeScript
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        # Web & Styles
        ".html", ".htm", ".css", ".scss", ".sass", ".less",
        # Systems & Backend
        ".go", ".rs", ".java", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".cs", ".php", ".rb", ".swift", ".kt", ".scala",
        # Schemas & Databases
        ".prisma", ".sql", ".graphql", ".gql",
        # Config & Data
        ".json", ".yaml", ".yml", ".toml", ".xml",
        # Documentation & Shell
        ".md", ".markdown", ".sh", ".bash", ".zsh", ".bat", ".ps1"
    })

settings = Settings()
