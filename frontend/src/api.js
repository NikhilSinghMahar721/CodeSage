// CodeSage API Client

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

export async function fetchStats(repoPath = null) {
  const url = repoPath 
    ? `${API_BASE}/stats?repo_path=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/stats`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch repository statistics');
  return res.json();
}

export async function loadRepository(repoUrlOrPath, autoIndex = true) {
  const res = await fetch(`${API_BASE}/repo/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_url_or_path: repoUrlOrPath,
      auto_index: autoIndex
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to load repository');
  }
  return res.json();
}

export async function fetchCurrentRepo() {
  const res = await fetch(`${API_BASE}/repo/current`);
  if (!res.ok) throw new Error('Failed to fetch current repository');
  return res.json();
}

export async function fetchRecentRepos() {
  const res = await fetch(`${API_BASE}/repo/recent`);
  if (!res.ok) throw new Error('Failed to fetch recent repositories');
  return res.json();
}

export async function indexRepository(repoPath = null) {
  const res = await fetch(`${API_BASE}/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Indexing failed');
  }
  return res.json();
}

export async function searchCode(query, mode = 'hybrid', topK = 5, repoPath = null) {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode, top_k: topK, repo_path: repoPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Search failed');
  }
  return res.json();
}

export async function askQuestion(question, mode = 'hybrid', topK = 5, repoPath = null) {
  const res = await fetch(`${API_BASE}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, mode, top_k: topK, repo_path: repoPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Q&A failed');
  }
  return res.json();
}

export async function reviewDiff(diffText, prUrl = null, severity = null, minConfidence = 0.0, repoPath = null) {
  const res = await fetch(`${API_BASE}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diff_text: diffText,
      pr_url: prUrl,
      severity: severity || null,
      min_confidence: minConfidence,
      repo_path: repoPath,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Review failed');
  }
  return res.json();
}

export async function listFiles(repoPath = null) {
  const url = repoPath 
    ? `${API_BASE}/files?repo_path=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/files`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to list files');
  return res.json();
}

export async function getFileContent(filePath, repoPath = null) {
  const url = repoPath
    ? `${API_BASE}/file-content?file_path=${encodeURIComponent(filePath)}&repo_path=${encodeURIComponent(repoPath)}`
    : `${API_BASE}/file-content?file_path=${encodeURIComponent(filePath)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load file: ${filePath}`);
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}
