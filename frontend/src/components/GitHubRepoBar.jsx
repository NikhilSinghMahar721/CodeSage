import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Search, 
  Star, 
  GitFork, 
  AlertCircle, 
  ExternalLink, 
  FolderGit2, 
  Sparkles, 
  RefreshCw, 
  CheckCircle, 
  History,
  FileCode,
  Tag,
  Code
} from 'lucide-react';
import { loadRepository, fetchRecentRepos } from '../api';

const POPULAR_PRESETS = [
  { label: 'pallets/flask', url: 'https://github.com/pallets/flask' },
  { label: 'psf/requests', url: 'https://github.com/psf/requests' },
  { label: 'tiangolo/fastapi', url: 'https://github.com/tiangolo/fastapi' },
  { label: 'Local (CodeSage)', url: '.' }
];

export default function GitHubRepoBar({ currentRepo, onRepoLoaded }) {
  const [inputUrl, setInputUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [error, setError] = useState(null);
  const [recentRepos, setRecentRepos] = useState([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    try {
      const list = await fetchRecentRepos();
      setRecentRepos(list);
    } catch {
      // ignore
    }
  }

  async function handleLoad(url = inputUrl) {
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);
    setStatusMsg(`Connecting and fetching repository '${url}'...`);

    try {
      const repoData = await loadRepository(url, true);
      setStatusMsg(`Successfully loaded ${repoData.full_name || repoData.name}!`);
      onRepoLoaded(repoData);
      loadRecent();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      let cleanMsg = err.message || 'Failed to load repository.';
      if (cleanMsg.includes('warning:') || cleanMsg.includes('Cloning into')) {
        cleanMsg = cleanMsg
          .replace(/Cloning into [^.]+\.\.\./g, '')
          .replace(/warning: Clone succeeded, but checkout failed\.[^.]*/g, '')
          .trim();
        if (!cleanMsg) {
          cleanMsg = 'Repository cloned with partial checkout. Some files may have reserved names on Windows.';
        }
      }
      setError(cleanMsg);
      setStatusMsg(null);
    } finally {
      setIsLoading(false);
    }
  }

  const gh = currentRepo?.github || {};
  const struct = currentRepo?.structure || {};

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(14, 20, 32, 0.95) 0%, rgba(10, 14, 23, 0.85) 100%)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '18px 24px',
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
        {/* Top Input Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '10px 16px',
            position: 'relative'
          }}>
            <FolderGit2 size={18} color="var(--accent-emerald)" />
            <input
              type="text"
              placeholder="Paste any public GitHub repository URL (e.g. https://github.com/pallets/flask) or local directory path..."
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoad()}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>

          <button
            onClick={() => handleLoad()}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 22px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '9px',
              color: '#fff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={15} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isLoading ? 'Analyzing...' : 'Analyze Repository'}</span>
          </button>

          {recentRepos.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowRecent(!showRecent)}
                title="Recent Repositories"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '11px 14px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '9px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <History size={16} />
                <span>Recent</span>
              </button>

              {showRecent && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  width: '320px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: '10px',
                  padding: '8px',
                  zIndex: 60,
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', padding: '6px 10px', textTransform: 'uppercase' }}>
                    Recent Repositories
                  </div>
                  {recentRepos.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setShowRecent(false);
                        setInputUrl(r.input_target || r.path);
                        handleLoad(r.input_target || r.path);
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: '600' }}>{r.full_name || r.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.total_files || 0} files</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preset Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: currentRepo ? '14px' : '0' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>TRY REPO:</span>
          {POPULAR_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                setInputUrl(p.url);
                handleLoad(p.url);
              }}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '5px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {statusMsg && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            color: 'var(--accent-emerald)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '10px'
          }}>
            <CheckCircle size={14} />
            <span>{statusMsg}</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            color: '#fca5a5',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '10px'
          }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Loaded Repository Banner */}
        {currentRepo && (
          <div style={{
            marginTop: '12px',
            padding: '14px 18px',
            background: 'rgba(18, 26, 41, 0.6)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            {/* Left: Repo title, description, link */}
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: '800', color: '#fff', letterSpacing: '-0.01em' }}>
                  {currentRepo.full_name || currentRepo.name}
                </span>

                {gh.html_url && (
                  <a
                    href={gh.html_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: 'var(--accent-cyan)',
                      textDecoration: 'none'
                    }}
                  >
                    <span>View on GitHub</span>
                    <ExternalLink size={12} />
                  </a>
                )}

                {gh.license && (
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {gh.license}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {gh.description || 'Local or custom repository'}
              </div>
            </div>

            {/* Right: Badges & Metrics */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {gh.stars > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                  <Star size={14} fill="var(--accent-amber)" />
                  <span>{gh.stars.toLocaleString()}</span>
                </div>
              )}

              {gh.forks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  <GitFork size={14} />
                  <span>{gh.forks.toLocaleString()}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                <FileCode size={14} />
                <span>{struct.total_loc ? `${struct.total_loc.toLocaleString()} LOC` : `${currentRepo.total_files || 0} files`}</span>
              </div>

              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '5px',
                background: currentRepo.is_indexed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: currentRepo.is_indexed ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                border: currentRepo.is_indexed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                {currentRepo.is_indexed ? 'Indexed & Ready' : 'Unindexed'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
