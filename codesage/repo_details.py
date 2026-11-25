import os
import re
import json
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
from collections import Counter
import requests

from codesage.config import settings, BASE_DIR
from codesage.ingestion.cloner import Cloner, walk_code_files, IGNORED_FILE_NAMES

RECENT_REPOS_FILE = BASE_DIR / ".repos" / "recent_repos.json"


def parse_github_url(url_or_path: str) -> Optional[Tuple[str, str]]:
    """Extract (owner, repo) from GitHub URL or shorthand."""
    clean = url_or_path.strip().rstrip("/")
    # Remove branch paths like /tree/main or /blob/master/...
    clean = re.sub(r"/(?:tree|blob)/.*$", "", clean)
    if clean.endswith(".git"):
        clean = clean[:-4]

    # Matches https://github.com/owner/repo or git@github.com:owner/repo
    m = re.search(r"github\.com[/:]([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)", clean)
    if m:
        return m.group(1), m.group(2)

    # Matches shorthand owner/repo (e.g. 'pallets/flask')
    m_short = re.match(r"^([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+)$", clean)
    if m_short and not Path(clean).exists():
        return m_short.group(1), m_short.group(2)

    return None


def fetch_github_api_metadata(owner: str, repo: str) -> Dict[str, Any]:
    """Fetch public metadata from GitHub REST API with graceful offline fallback."""
    api_url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodeSage-Analyzer"
    }
    if settings.github_token:
        headers["Authorization"] = f"token {settings.github_token}"

    try:
        resp = requests.get(api_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "owner": owner,
                "name": repo,
                "full_name": data.get("full_name", f"{owner}/{repo}"),
                "description": data.get("description") or "No description provided.",
                "stars": data.get("stargazers_count", 0),
                "forks": data.get("forks_count", 0),
                "open_issues": data.get("open_issues_count", 0),
                "language": data.get("language") or "Multi-language",
                "license": data.get("license", {}).get("spdx_id") if data.get("license") else None,
                "default_branch": data.get("default_branch", "main"),
                "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
                "topics": data.get("topics", []),
                "avatar_url": data.get("owner", {}).get("avatar_url"),
                "is_remote": True
            }
    except Exception:
        pass

    # Fallback if unauthenticated or rate-limited
    return {
        "owner": owner,
        "name": repo,
        "full_name": f"{owner}/{repo}",
        "description": f"GitHub repository {owner}/{repo}",
        "stars": 0,
        "forks": 0,
        "open_issues": 0,
        "language": "Multi-language",
        "license": "Open Source",
        "default_branch": "main",
        "html_url": f"https://github.com/{owner}/{repo}",
        "topics": [],
        "avatar_url": None,
        "is_remote": True
    }


def analyze_repository_structure(repo_path: Path) -> Dict[str, Any]:
    """
    Inspect repository directory across all supported languages (TypeScript, JavaScript,
    Python, Go, Rust, Java, Prisma, SQL, etc.) for files, LOC, dependencies, entry points,
    and git history. Never raises; returns safe fallback structures on any error.
    """
    try:
        repo_path = Path(repo_path).resolve()
        if not repo_path.exists() or not repo_path.is_dir():
            return {
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
    except Exception:
        return {
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

    total_loc = 0
    total_files = 0
    extension_counts: Counter = Counter()
    lang_loc: Counter = Counter()
    dep_counter: Counter = Counter()
    discovered_files: List[str] = []

    ext_to_lang = {
        ".py": "Python", ".pyw": "Python",
        ".ts": "TypeScript", ".tsx": "TypeScript (React)",
        ".js": "JavaScript", ".jsx": "JavaScript (React)", ".mjs": "JavaScript",
        ".html": "HTML", ".css": "CSS", ".scss": "SCSS",
        ".go": "Go", ".rs": "Rust", ".java": "Java", ".c": "C", ".cpp": "C++", ".cs": "C#",
        ".prisma": "Prisma", ".sql": "SQL", ".graphql": "GraphQL",
        ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
        ".md": "Markdown", ".sh": "Shell"
    }

    # 1. Walk code files and measure LOC
    try:
        for abs_path, rel_path in walk_code_files(repo_path):
            total_files += 1
            discovered_files.append(rel_path)
            ext = abs_path.suffix.lower() or "no_ext"
            extension_counts[ext] += 1
            lang_name = ext_to_lang.get(ext, "Other")

            try:
                content = abs_path.read_text(encoding="utf-8", errors="replace")
                lines = content.splitlines()
                loc = len(lines)
                total_loc += loc
                lang_loc[lang_name] += loc

                # If Python file, extract imports
                if ext in {".py", ".pyw"}:
                    for line in lines[:80]:
                        line_s = line.strip()
                        if line_s.startswith("import "):
                            parts = line_s[7:].split(",")
                            for part in parts:
                                mod = part.strip().split()[0].split(".")[0]
                                if mod and mod not in {"sys", "os", "re", "json", "time", "pathlib", "typing", "math", "collections"}:
                                    dep_counter[mod] += 1
                        elif line_s.startswith("from "):
                            mod = line_s[5:].split()[0].split(".")[0]
                            if mod and mod not in {"sys", "os", "re", "json", "time", "pathlib", "typing", "math", "collections"}:
                                dep_counter[mod] += 1
            except Exception:
                pass
    except Exception:
        pass

    # 2. Extract dependencies from package.json files (JavaScript / TypeScript / Node)
    try:
        for pkg_file in repo_path.glob("**/package.json"):
            try:
                rel_parts = pkg_file.relative_to(repo_path).parts[:-1]
                if any(ignored in rel_parts for ignored in settings.ignored_dirs):
                    continue
                pkg_data = json.loads(pkg_file.read_text(encoding="utf-8", errors="replace"))
                deps = pkg_data.get("dependencies", {})
                for d in deps.keys():
                    dep_counter[d] += 2
                dev_deps = pkg_data.get("devDependencies", {})
                for d in dev_deps.keys():
                    dep_counter[d] += 1
            except Exception:
                pass
    except Exception:
        pass

    # 3. Extract dependencies from pyproject.toml / requirements.txt
    try:
        for req_file in repo_path.glob("**/requirements*.txt"):
            try:
                rel_parts = req_file.relative_to(repo_path).parts[:-1]
                if any(ignored in rel_parts for ignored in settings.ignored_dirs):
                    continue
                for line in req_file.read_text(encoding="utf-8", errors="replace").splitlines():
                    line_s = line.strip().split("==")[0].split(">=")[0].split("<=")[0].strip()
                    if line_s and not line_s.startswith("#"):
                        dep_counter[line_s] += 2
            except Exception:
                pass
    except Exception:
        pass

    # 4. Read latest git commit if present
    last_commit = None
    try:
        git_dir = repo_path / ".git"
        if git_dir.exists():
            res = subprocess.run(
                ["git", "log", "-1", "--format=%h|%an|%ar|%s"],
                cwd=str(repo_path),
                capture_output=True,
                text=True,
                timeout=5
            )
            if res.returncode == 0 and res.stdout.strip():
                parts = res.stdout.strip().split("|")
                if len(parts) >= 4:
                    last_commit = {
                        "hash": parts[0],
                        "author": parts[1],
                        "date": parts[2],
                        "message": parts[3]
                    }
    except Exception:
        pass

    # 5. Key entrypoint detection (Python, TypeScript, Node, Web, Go, Rust, Java)
    entrypoints = []
    candidate_entrypoints = [
        "main.py", "app.py", "server.py", "cli.py", "manage.py",
        "src/main.ts", "backend/src/main.ts", "src/index.ts", "src/app.ts",
        "frontend/src/app/page.tsx", "src/app/page.tsx", "pages/index.tsx",
        "index.js", "server.js", "app.js", "backend/src/app.module.ts",
        "prisma/schema.prisma", "backend/prisma/schema.prisma",
        "next.config.ts", "next.config.mjs", "next.config.js", "vite.config.ts", "vite.config.js",
        "main.go", "src/main.rs", "pom.xml", "build.gradle"
    ]
    for candidate in candidate_entrypoints:
        try:
            if (repo_path / candidate).exists():
                entrypoints.append(candidate)
        except Exception:
            pass

    # 6. Read README preview
    readme_snippet = ""
    for candidate in ["README.md", "readme.md", "README.rst", "README.txt", "ReadMe.md"]:
        try:
            readme_path = repo_path / candidate
            if readme_path.exists():
                lines = readme_path.read_text(encoding="utf-8", errors="replace").splitlines()[:25]
                readme_snippet = "\n".join(lines).strip()
                break
        except Exception:
            pass

    # 7. Build structured directory hierarchy summary
    top_dirs: Dict[str, List[str]] = {}
    for rf in discovered_files[:150]:
        parts = rf.split("/")
        if len(parts) > 1:
            d_name = parts[0]
            if d_name not in top_dirs:
                top_dirs[d_name] = []
            if len(top_dirs[d_name]) < 8:
                top_dirs[d_name].append("/".join(parts[1:]))

    return {
        "total_files": total_files,
        "total_loc": total_loc,
        "language_breakdown": dict(lang_loc.most_common(6)),
        "extension_breakdown": dict(extension_counts.most_common(8)),
        "top_dependencies": [mod for mod, _ in dep_counter.most_common(12)],
        "entrypoints": entrypoints[:8],
        "last_commit": last_commit,
        "readme_snippet": readme_snippet,
        "top_dirs": top_dirs
    }


def save_recent_repo(repo_info: Dict[str, Any]):
    """Persist analyzed repo to recent repos list."""
    try:
        RECENT_REPOS_FILE.parent.mkdir(parents=True, exist_ok=True)
        recent = []
        if RECENT_REPOS_FILE.exists():
            recent = json.loads(RECENT_REPOS_FILE.read_text(encoding="utf-8"))

        # Deduplicate by full_name or path
        recent = [r for r in recent if r.get("path") != repo_info.get("path") and r.get("full_name") != repo_info.get("full_name")]
        recent.insert(0, repo_info)
        # Keep top 12
        recent = recent[:12]
        RECENT_REPOS_FILE.write_text(json.dumps(recent, indent=2), encoding="utf-8")
    except Exception:
        pass


def get_recent_repos() -> List[Dict[str, Any]]:
    """Retrieve previously analyzed repos."""
    if RECENT_REPOS_FILE.exists():
        try:
            return json.loads(RECENT_REPOS_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []
