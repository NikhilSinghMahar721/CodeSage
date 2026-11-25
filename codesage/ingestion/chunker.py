import ast
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any, Set, Tuple


@dataclass
class CodeChunk:
    id: str  # e.g. "path/to/file.ts::AiService.generate:57_60"
    file_path: str  # Relative path in repo
    language: str  # "python" | "typescript" | "javascript" | "markdown" | etc.
    symbol_name: str  # Name of function, method, class, section, or chunk
    symbol_type: str  # "function" | "method" | "class" | "interface" | "section" | "model" | "window"
    start_line: int  # 1-indexed
    end_line: int  # 1-indexed
    content: str  # Source code of the chunk
    imports: List[str] = field(default_factory=list)
    docstring: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _get_start_line(node: ast.AST) -> int:
    """Return start line including decorator lines if any."""
    start = getattr(node, "lineno", 1)
    if hasattr(node, "decorator_list") and node.decorator_list:
        decorator_lines = [d.lineno for d in node.decorator_list if hasattr(d, "lineno")]
        if decorator_lines:
            start = min(start, min(decorator_lines))
    return start


def _get_end_line(node: ast.AST, default: int) -> int:
    """Return end line of AST node."""
    return getattr(node, "end_lineno", default)


def _extract_imports(tree: ast.AST) -> List[str]:
    """Collect imported module and symbol names from Python AST."""
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            for alias in node.names:
                imports.append(f"{mod}.{alias.name}" if mod else alias.name)
    return sorted(list(set(imports)))


def _chunk_by_line_window(
    file_content: str,
    rel_path: str,
    language: str = "text",
    window_size: int = 50,
    overlap: int = 10
) -> List[CodeChunk]:
    """Fallback chunker for unparsable or flat config/data files."""
    lines = file_content.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return []

    chunks: List[CodeChunk] = []
    step = max(1, window_size - overlap)

    for start_idx in range(0, total_lines, step):
        end_idx = min(start_idx + window_size, total_lines)
        chunk_lines = lines[start_idx:end_idx]
        chunk_content = "\n".join(chunk_lines)

        start_line = start_idx + 1
        end_line = end_idx
        chunk_id = f"{rel_path}::lines_{start_line}_{end_line}"

        chunks.append(CodeChunk(
            id=chunk_id,
            file_path=rel_path,
            language=language,
            symbol_name=f"lines_{start_line}_{end_line}",
            symbol_type="window",
            start_line=start_line,
            end_line=end_line,
            content=chunk_content,
            imports=[],
            docstring=None
        ))
        if end_idx >= total_lines:
            break

    return chunks


def chunk_python_code(file_content: str, rel_path: str) -> List[CodeChunk]:
    """
    Parse Python code into function, method, and class chunks with metadata using ast.
    Falls back to line-window chunking if syntax error occurs.
    """
    if not file_content.strip():
        return []

    lines = file_content.splitlines()
    total_lines = len(lines)

    try:
        tree = ast.parse(file_content, filename=rel_path)
    except Exception:
        return _chunk_by_line_window(file_content, rel_path, language="python")

    global_imports = _extract_imports(tree)
    chunks: List[CodeChunk] = []
    seen_ids: Set[str] = set()

    def make_unique_id(base_id: str) -> str:
        cid = base_id
        counter = 1
        while cid in seen_ids:
            cid = f"{base_id}_{counter}"
            counter += 1
        seen_ids.add(cid)
        return cid

    class CodeVisitor(ast.NodeVisitor):
        def __init__(self):
            self.current_class: Optional[str] = None

        def visit_ClassDef(self, node: ast.ClassDef):
            start = _get_start_line(node)
            end = _get_end_line(node, total_lines)
            class_name = node.name

            chunk_content = "\n".join(lines[start - 1:end])
            docstring = ast.get_docstring(node)

            chunk_id = make_unique_id(f"{rel_path}::{class_name}:{start}_{end}")
            chunks.append(CodeChunk(
                id=chunk_id,
                file_path=rel_path,
                language="python",
                symbol_name=class_name,
                symbol_type="class",
                start_line=start,
                end_line=end,
                content=chunk_content,
                imports=global_imports,
                docstring=docstring
            ))

            prev_class = self.current_class
            self.current_class = class_name
            self.generic_visit(node)
            self.current_class = prev_class

        def visit_FunctionDef(self, node: ast.FunctionDef):
            self._handle_function(node, is_async=False)

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
            self._handle_function(node, is_async=True)

        def _handle_function(self, node: ast.AST, is_async: bool):
            start = _get_start_line(node)
            end = _get_end_line(node, total_lines)
            func_name = getattr(node, "name", "anonymous")
            docstring = ast.get_docstring(node)

            if self.current_class:
                symbol_type = "method"
                full_symbol = f"{self.current_class}.{func_name}"
            else:
                symbol_type = "function"
                full_symbol = func_name

            chunk_content = "\n".join(lines[start - 1:end])
            chunk_id = make_unique_id(f"{rel_path}::{full_symbol}:{start}_{end}")

            chunks.append(CodeChunk(
                id=chunk_id,
                file_path=rel_path,
                language="python",
                symbol_name=full_symbol,
                symbol_type=symbol_type,
                start_line=start,
                end_line=end,
                content=chunk_content,
                imports=global_imports,
                docstring=docstring
            ))

            self.generic_visit(node)

    visitor = CodeVisitor()
    visitor.visit(tree)

    if not chunks:
        return _chunk_by_line_window(file_content, rel_path, language="python")

    return chunks


def _find_matching_brace(lines: List[str], start_line_0: int) -> int:
    """Given lines and a 0-indexed start line, find 0-indexed line where braces balance."""
    brace_depth = 0
    found_first_brace = False

    for idx in range(start_line_0, len(lines)):
        line = lines[idx]
        # Skip string literals and comments roughly
        cleaned = re.sub(r"/\*.*?\*/|//.*$|'.*?'|\".*?\"|`.*?`", "", line)
        for char in cleaned:
            if char == "{":
                brace_depth += 1
                found_first_brace = True
            elif char == "}":
                brace_depth -= 1
                if found_first_brace and brace_depth <= 0:
                    return idx

    # If unmatched or single-line
    return min(start_line_0 + 30, len(lines) - 1)


def chunk_js_ts_code(file_content: str, rel_path: str, ext: str) -> List[CodeChunk]:
    """
    Parse TypeScript / JavaScript code into classes, methods, functions, interfaces,
    and type declarations with JSDoc and line coordinates.
    """
    if not file_content.strip():
        return []

    language = "typescript" if ext in {".ts", ".tsx"} else "javascript"
    lines = file_content.splitlines()
    total_lines = len(lines)
    chunks: List[CodeChunk] = []
    seen_ids: Set[str] = set()

    def make_unique_id(base_id: str) -> str:
        cid = base_id
        counter = 1
        while cid in seen_ids:
            cid = f"{base_id}_{counter}"
            counter += 1
        seen_ids.add(cid)
        return cid

    # Extract imports
    imports: List[str] = []
    for line in lines:
        m_imp = re.match(r"^\s*import\s+(?:.*?from\s+)?['\"]([^'\"]+)['\"]", line)
        if m_imp:
            imports.append(m_imp.group(1))
        m_req = re.search(r"require\(['\"]([^'\"]+)['\"]\)", line)
        if m_req:
            imports.append(m_req.group(1))
    imports = sorted(list(set(imports)))

    # Track line ranges covered by structured symbols
    covered_lines: Set[int] = set()

    # Helper to extract preceding JSDoc
    def get_jsdoc(start_0: int) -> Optional[str]:
        if start_0 <= 0:
            return None
        doc_lines = []
        idx = start_0 - 1
        # Skip decorators
        while idx >= 0 and lines[idx].strip().startswith("@"):
            idx -= 1
        if idx >= 0 and lines[idx].strip().endswith("*/"):
            while idx >= 0:
                doc_lines.insert(0, lines[idx].strip())
                if lines[idx].strip().startswith("/*"):
                    break
                idx -= 1
            return "\n".join(doc_lines) if doc_lines else None
        return None

    # 1. Classes & NestJS/Angular Decorators
    class_pattern = re.compile(
        r"^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends|\s+implements|\s*\{|\s*$)"
    )

    for i, line in enumerate(lines):
        clean_line = line.strip()
        m_class = class_pattern.search(clean_line)
        if m_class:
            class_name = m_class.group(1)
            # Find class decorators if any
            start_0 = i
            while start_0 > 0 and lines[start_0 - 1].strip().startswith("@"):
                start_0 -= 1

            end_0 = _find_matching_brace(lines, i)
            start_line = start_0 + 1
            end_line = end_0 + 1
            chunk_content = "\n".join(lines[start_0:end_0 + 1])
            doc = get_jsdoc(start_0)

            chunk_id = make_unique_id(f"{rel_path}::{class_name}:{start_line}_{end_line}")
            chunks.append(CodeChunk(
                id=chunk_id,
                file_path=rel_path,
                language=language,
                symbol_name=class_name,
                symbol_type="class",
                start_line=start_line,
                end_line=end_line,
                content=chunk_content,
                imports=imports,
                docstring=doc
            ))

            for l_num in range(start_line, end_line + 1):
                covered_lines.add(l_num)

            # Extract methods inside this class
            method_pattern = re.compile(
                r"^\s*(?:public|private|protected|static|async|\*)*\s*(?:(?:async|get|set)\s+)?([A-Za-z0-9_]+)\s*\([^)]*\)(?::\s*[^\{]+)?\s*\{"
            )
            for m_idx in range(i + 1, end_0):
                m_line = lines[m_idx].strip()
                if m_line.startswith("//") or m_line.startswith("*"):
                    continue
                match_method = method_pattern.search(m_line)
                if match_method:
                    method_name = match_method.group(1)
                    if method_name not in {"if", "for", "while", "switch", "catch"}:
                        m_start_0 = m_idx
                        while m_start_0 > i + 1 and lines[m_start_0 - 1].strip().startswith("@"):
                            m_start_0 -= 1
                        m_end_0 = _find_matching_brace(lines, m_idx)
                        if m_end_0 <= end_0:
                            m_start = m_start_0 + 1
                            m_end = m_end_0 + 1
                            m_chunk_id = make_unique_id(f"{rel_path}::{class_name}.{method_name}:{m_start}_{m_end}")
                            chunks.append(CodeChunk(
                                id=m_chunk_id,
                                file_path=rel_path,
                                language=language,
                                symbol_name=f"{class_name}.{method_name}",
                                symbol_type="method",
                                start_line=m_start,
                                end_line=m_end,
                                content="\n".join(lines[m_start_0:m_end_0 + 1]),
                                imports=imports,
                                docstring=get_jsdoc(m_start_0)
                            ))

    # 2. Standalone Functions (Regular, Async, Arrow functions)
    func_pattern = re.compile(
        r"^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*|\s+)([A-Za-z0-9_]+)\s*\("
    )
    arrow_pattern = re.compile(
        r"^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*(?::\s*[^=]+)?=>"
    )

    for i, line in enumerate(lines):
        if (i + 1) in covered_lines:
            continue
        clean_line = line.strip()

        func_name = None
        if func_pattern.search(clean_line):
            func_name = func_pattern.search(clean_line).group(1)
        elif arrow_pattern.search(clean_line):
            func_name = arrow_pattern.search(clean_line).group(1)

        if func_name and func_name not in {"if", "for", "while", "switch"}:
            start_0 = i
            while start_0 > 0 and lines[start_0 - 1].strip().startswith("@"):
                start_0 -= 1
            end_0 = _find_matching_brace(lines, i)
            start_line = start_0 + 1
            end_line = end_0 + 1
            chunk_content = "\n".join(lines[start_0:end_0 + 1])
            doc = get_jsdoc(start_0)

            chunk_id = make_unique_id(f"{rel_path}::{func_name}:{start_line}_{end_line}")
            chunks.append(CodeChunk(
                id=chunk_id,
                file_path=rel_path,
                language=language,
                symbol_name=func_name,
                symbol_type="function",
                start_line=start_line,
                end_line=end_line,
                content=chunk_content,
                imports=imports,
                docstring=doc
            ))
            for l_num in range(start_line, end_line + 1):
                covered_lines.add(l_num)

    # 3. Interfaces & Types (TypeScript)
    interface_pattern = re.compile(
        r"^(?:export\s+)?interface\s+([A-Za-z0-9_]+)(?:\s+extends|\s*\{|\s*$)"
    )
    for i, line in enumerate(lines):
        if (i + 1) in covered_lines:
            continue
        m_iface = interface_pattern.search(line.strip())
        if m_iface:
            iface_name = m_iface.group(1)
            start_0 = i
            end_0 = _find_matching_brace(lines, i)
            start_line = start_0 + 1
            end_line = end_0 + 1
            chunk_id = make_unique_id(f"{rel_path}::{iface_name}:{start_line}_{end_line}")
            chunks.append(CodeChunk(
                id=chunk_id,
                file_path=rel_path,
                language=language,
                symbol_name=iface_name,
                symbol_type="interface",
                start_line=start_line,
                end_line=end_line,
                content="\n".join(lines[start_0:end_0 + 1]),
                imports=imports,
                docstring=get_jsdoc(start_0)
            ))
            for l_num in range(start_line, end_line + 1):
                covered_lines.add(l_num)

    # 4. If nothing was parsed or significant lines are uncovered, create window chunks
    if not chunks or len(covered_lines) < (total_lines * 0.4):
        window_chunks = _chunk_by_line_window(file_content, rel_path, language=language)
        if not chunks:
            return window_chunks
        # Add module overview chunk of the file head (imports + config)
        top_lines = lines[:min(40, total_lines)]
        chunks.insert(0, CodeChunk(
            id=make_unique_id(f"{rel_path}::module_header:1_{len(top_lines)}"),
            file_path=rel_path,
            language=language,
            symbol_name="module_header",
            symbol_type="module",
            start_line=1,
            end_line=len(top_lines),
            content="\n".join(top_lines),
            imports=imports,
            docstring=None
        ))

    return chunks


def chunk_markdown_file(file_content: str, rel_path: str) -> List[CodeChunk]:
    """Parse Markdown file by headers into sections."""
    lines = file_content.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return []

    sections: List[Tuple[int, str, int]] = []  # (start_line_1, heading_title, level)
    for idx, line in enumerate(lines, start=1):
        m = re.match(r"^(#{1,4})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            sections.append((idx, title, level))

    if not sections:
        return _chunk_by_line_window(file_content, rel_path, language="markdown")

    chunks: List[CodeChunk] = []
    seen_ids: Set[str] = set()

    for i, (start_line, title, _) in enumerate(sections):
        end_line = sections[i + 1][0] - 1 if i + 1 < len(sections) else total_lines
        content = "\n".join(lines[start_line - 1:end_line])

        safe_title = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", title)[:40]
        base_id = f"{rel_path}::{safe_title}:{start_line}_{end_line}"
        cid = base_id
        counter = 1
        while cid in seen_ids:
            cid = f"{base_id}_{counter}"
            counter += 1
        seen_ids.add(cid)

        chunks.append(CodeChunk(
            id=cid,
            file_path=rel_path,
            language="markdown",
            symbol_name=title,
            symbol_type="section",
            start_line=start_line,
            end_line=end_line,
            content=content,
            imports=[],
            docstring=None
        ))

    return chunks


def chunk_prisma_file(file_content: str, rel_path: str) -> List[CodeChunk]:
    """Parse Prisma schema into model and enum chunks."""
    lines = file_content.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return []

    chunks: List[CodeChunk] = []
    model_pattern = re.compile(r"^(model|enum|datasource|generator)\s+([A-Za-z0-9_]+)\s*\{")

    for i, line in enumerate(lines):
        m = model_pattern.match(line.strip())
        if m:
            kind = m.group(1)
            name = m.group(2)
            start_line = i + 1
            end_0 = _find_matching_brace(lines, i)
            end_line = end_0 + 1
            chunk_content = "\n".join(lines[i:end_0 + 1])
            chunks.append(CodeChunk(
                id=f"{rel_path}::{name}:{start_line}_{end_line}",
                file_path=rel_path,
                language="prisma",
                symbol_name=name,
                symbol_type=kind,
                start_line=start_line,
                end_line=end_line,
                content=chunk_content,
                imports=[],
                docstring=None
            ))

    if not chunks:
        return _chunk_by_line_window(file_content, rel_path, language="prisma")
    return chunks


def chunk_file(file_path: Path, rel_path: str) -> List[CodeChunk]:
    """Read a file from disk and return its parsed code chunks for any supported language."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    ext = file_path.suffix.lower()

    if ext in {".py", ".pyw"}:
        return chunk_python_code(content, rel_path)
    elif ext in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
        return chunk_js_ts_code(content, rel_path, ext)
    elif ext in {".md", ".markdown"}:
        return chunk_markdown_file(content, rel_path)
    elif ext == ".prisma":
        return chunk_prisma_file(content, rel_path)
    else:
        lang_map = {
            ".go": "go",
            ".rs": "rust",
            ".java": "java",
            ".c": "c",
            ".cpp": "cpp",
            ".cs": "csharp",
            ".json": "json",
            ".yaml": "yaml",
            ".yml": "yaml",
            ".toml": "toml",
            ".sql": "sql",
            ".html": "html",
            ".css": "css",
        }
        language = lang_map.get(ext, "text")
        return _chunk_by_line_window(content, rel_path, language=language)
