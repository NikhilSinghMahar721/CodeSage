# CodeSage

**AI-powered Code Review & Repository Intelligence Platform**

CodeSage combines semantic AST-aware chunking, hybrid retrieval (dense vector embeddings via ChromaDB and sparse lexical search via BM25+), and multi-provider LLM intelligence (Google Gemini, OpenAI, Ollama, and Mock) with a **modern React single-page frontend** and a **high-performance Python FastAPI backend**.

---

## Architecture

- **Frontend (`frontend/`)**: React 18, Vite, Lucide-react, cyber dark developer UI with real-time stats, interactive AST symbol breakdowns, live hybrid search, unified diff PR reviews, and codebase Q&A with verified citations.
- **Backend (`codesage/server.py`)**: FastAPI REST API serving endpoints for indexing, hybrid search, automated reviews, Q&A, and serving the compiled production React SPA.
- **Core Engine (`codesage/`)**:
  - `codesage/ingestion`: AST Python chunker and Git cloner.
  - `codesage/indexing`: ChromaDB vector store, MiniLM embedder, and BM25+ index.
  - `codesage/retrieval`: Reciprocal Rank Fusion (RRF) hybrid retriever.
  - `codesage/review`: Diff parser, AST context enrichment, and Pydantic findings schema.
  - `codesage/qa`: Line-level verified citation extractor and question answering.
  - `codesage/llm`: Resilient multi-provider client with retry logic (Gemini, OpenAI, Ollama, Mock).

---

## Quickstart

### 1. Prerequisites
- Python 3.10+ (Python 3.11 installed in `.venv`)
- Node.js 18+ (Node.js 22 installed)

### 2. Activate the Environment
In PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Start the Web Application

To launch both the Python backend and the React UI on `http://127.0.0.1:8000`:
```powershell
codesage serve --port 8000
```
Open your browser at [http://127.0.0.1:8000](http://127.0.0.1:8000).

*(For React hot-reloading development mode)*:
```powershell
# Terminal 1: Backend
codesage serve --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

---

## CLI Usage

CodeSage also provides a full CLI interface:

- **Index repository**:
  ```powershell
  codesage index .
  ```
- **Hybrid search**:
  ```powershell
  codesage search "reciprocal rank fusion" --mode hybrid --top-k 5
  ```
- **Review code changes**:
  ```powershell
  codesage review examples/sample_pr.diff
  ```
- **Ask codebase questions**:
  ```powershell
  codesage ask "How does the hybrid retriever work?"
  ```

---

## Running Tests

Run the full 20-test verification suite:
```powershell
pytest -v
```
