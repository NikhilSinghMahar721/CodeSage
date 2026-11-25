import os
import re
import shutil
import subprocess
import urllib.parse
from pathlib import Path
from typing import List, Generator, Tuple
from codesage.config import settings

class Cloner:
    """Clones remote git repositories or resolves local directory paths."""

    def __init__(self, cache_dir: Path = settings.repos_cache_dir):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def resolve_repo_path(self, repo_url_or_path: str) -> Path:
        """Given a local path or a GitHub repository URL, return a local Path."""
        clean_target = repo_url_or_path.strip()

        # If it looks like a remote URL or GitHub shorthand, clone it
        if (
            clean_target.startswith("http://")
            or clean_target.startswith("https://")
            or clean_target.startswith("git@")
            or "github.com" in clean_target
        ):
            return self.clone_repo(clean_target)

        # Check local path
        try:
            path_obj = Path(clean_target).expanduser().resolve()
            if path_obj.exists() and path_obj.is_dir():
                return path_obj
        except Exception:
            pass

        # If it's in owner/repo shorthand format, clone from GitHub
        if re.match(r"^[a-zA-Z0-9_\-\.]+/[a-zA-Z0-9_\-\.]+$", clean_target):
            return self.clone_repo(f"https://github.com/{clean_target}.git")

        return self.clone_repo(clean_target)

    def _get_repo_dirname(self, repo_url: str) -> str:
        # Strip branch paths like /tree/main or /blob/master if present
        clean_url = re.sub(r"/(?:tree|blob)/.*$", "", repo_url.strip())
        parsed = urllib.parse.urlparse(clean_url)
        path = parsed.path.strip("/")
        if path.endswith(".git"):
            path = path[:-4]
        # Sanitize for Windows filesystem: replace / and invalid filename chars
        safe_name = re.sub(r'[/\\:*?"<>|]', "_", path)
        return safe_name.strip("._ ") or "repo"

    def clone_repo(self, repo_url: str) -> Path:
        """Clone a git repository into cache_dir if not already cloned."""
        clean_url = repo_url.strip()
        # Clean branch paths from URL
        clean_url = re.sub(r"/(?:tree|blob)/.*$", "", clean_url)
        if not clean_url.endswith(".git") and "github.com" in clean_url:
            clean_url = f"{clean_url}.git"

        dirname = self._get_repo_dirname(clean_url)
        target_dir = self.cache_dir / dirname

        if target_dir.exists() and (target_dir / ".git").exists():
            # Ensure working tree is checked out (recover from prior partial checkout)
            self._ensure_checkout(target_dir)
            return target_dir

        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)

        # Clone using git CLI with depth 1 for speed and a 120s timeout
        cmd = ["git", "clone", "--depth", "1", clean_url, str(target_dir)]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        except subprocess.TimeoutExpired:
            shutil.rmtree(target_dir, ignore_errors=True)
            raise RuntimeError(f"Cloning timed out after 120 seconds for repository '{clean_url}'.")
        except FileNotFoundError:
            raise RuntimeError("Git executable not found on system PATH. Please ensure Git is installed.")
        except Exception as e:
            raise RuntimeError(f"Failed to execute git clone: {str(e)}")

        # On Windows, clone can succeed but checkout can fail (long paths,
        # reserved filenames like CON/AUX, or special characters).
        if result.returncode != 0:
            if target_dir.exists() and (target_dir / ".git").exists():
                # Clone data is present — attempt to restore the working tree
                self._ensure_checkout(target_dir)
            else:
                err_msg = result.stderr.strip()
                if "Authentication failed" in err_msg or "Repository not found" in err_msg:
                    friendly = "Repository not found or private. Please check the repository URL and permissions."
                else:
                    friendly = f"Failed to clone repository: {err_msg}"
                raise RuntimeError(friendly)

        return target_dir

    @staticmethod
    def _ensure_checkout(target_dir: Path):
        """Restore working tree files from HEAD when checkout was incomplete."""
        try:
            subprocess.run(
                ["git", "restore", "--source=HEAD", ":/"],
                cwd=str(target_dir),
                capture_output=True,
                text=True,
                timeout=30,
            )
        except Exception:
            pass  # Best-effort; proceed with whatever files are present


IGNORED_FILE_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "Cargo.lock",
    "composer.lock",
    "poetry.lock",
    "Gemfile.lock",
    ".DS_Store",
    "Thumbs.db",
}


def walk_code_files(repo_path: Path) -> Generator[Tuple[Path, str], None, None]:
    """
    Walk directory and yield (absolute_file_path, relative_file_path).
    Filters out ignored directories, binary extensions, generated lockfiles, and oversized files.
    """
    repo_path = Path(repo_path).resolve()

    for root, dirs, files in os.walk(repo_path):
        root_path = Path(root)
        # Prune ignored directories in-place
        dirs[:] = [
            d for d in dirs
            if d not in settings.ignored_dirs and not d.startswith(".")
        ]

        for file_name in files:
            if file_name in IGNORED_FILE_NAMES:
                continue

            file_path = root_path / file_name
            ext = file_path.suffix.lower()

            if ext in settings.ignored_extensions:
                continue

            # Only accept supported code extensions for parsing
            if ext not in settings.supported_extensions:
                continue

            try:
                if file_path.stat().st_size > settings.max_file_size_bytes:
                    continue
            except OSError:
                continue

            rel_path = file_path.relative_to(repo_path).as_posix()
            yield file_path, rel_path
