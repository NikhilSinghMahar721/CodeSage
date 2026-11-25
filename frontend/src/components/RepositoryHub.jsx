import React, { useState, useEffect } from 'react';
import { 
  FolderGit2, 
  FileCode2, 
  Database, 
  RefreshCw, 
  Cpu, 
  Code2, 
  FileText, 
  Layers, 
  ExternalLink, 
  X,
  CheckCircle,
  Copy,
  Clock,
  GitCommit,
  Tag,
  Star,
  GitFork,
  AlertCircle,
  Package,
  Search
} from 'lucide-react';
import { indexRepository, listFiles, getFileContent } from '../api';

export default function RepositoryHub({ currentRepo, stats, onRefreshStats }) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexMessage, setIndexMessage] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fileFilter, setFileFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

  const activePath = currentRepo?.path || '.';

  useEffect(() => {
    loadFileList();
  }, [currentRepo]);

  async function loadFileList() {
    setLoadingFiles(true);
    try {
      const list = await listFiles(activePath);
      setFiles(list || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleIndex() {
    setIsIndexing(true);
    setIndexMessage('Indexing repository with AST chunking and vector embeddings...');
    try {
      const res = await indexRepository(activePath);
      setIndexMessage(`Indexing complete! ${res.stats.files_indexed} files, ${res.stats.chunks_created} chunks in ${res.stats.elapsed_sec}s`);
      if (onRefreshStats) await onRefreshStats();
      await loadFileList();
    } catch (err) {
      setIndexMessage(`Indexing error: ${err.message}`);
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleOpenFile(filePath) {
    setSelectedFile(filePath);
    setLoadingContent(true);
    try {
      const data = await getFileContent(filePath, activePath);
      setFileContent(data.content);
    } catch (err) {
      setFileContent(`Error loading file: ${err.message}`);
    } finally {
      setLoadingContent(false);
    }
  }

  function handleCopyContent() {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const gh = currentRepo?.github || {};
  const struct = currentRepo?.structure || {};
  const breakdown = stats?.symbol_breakdown || {};
  const totalSymbols = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
  const topDeps = struct?.top_dependencies || [];
  const langBreakdown = struct?.language_breakdown || {};

  const totalLoc = struct?.total_loc || stats?.total_loc || 0;
  const totalChunks = stats?.total_chunks || currentRepo?.total_chunks || 0;
  const vectorChunks = stats?.vector_store_chunks || totalChunks;
  const totalFilesCount = currentRepo?.total_files || stats?.total_files || files.length || 0;

  const filteredFiles = files.filter(f => 
    !fileFilter || f.path.toLowerCase().includes(fileFilter.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Header / Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px'
      }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {currentRepo?.full_name || currentRepo?.name || 'Repository Intelligence Hub'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Multi-language AST symbol graph, vector indexing, and structural intelligence.
          </p>
        </div>

        <button
          onClick={handleIndex}
          disabled={isIndexing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            background: isIndexing ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '600',
            fontSize: '13px',
            cursor: isIndexing ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
            transition: 'all 0.2s ease'
          }}
        >
          <RefreshCw size={16} style={{ animation: isIndexing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isIndexing ? 'Indexing...' : 'Re-Index Repository'}</span>
        </button>
      </div>

      {indexMessage && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          color: 'var(--accent-emerald)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px'
        }}>
          <CheckCircle size={16} />
          <span>{indexMessage}</span>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        {/* Card 1: LOC & Files */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Code Files / LOC</span>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)' }}>
              <FileCode2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            {totalLoc > 0 ? totalLoc.toLocaleString() : (totalFilesCount > 0 ? `${totalFilesCount}` : '0')}{' '}
            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>LOC</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Across {totalFilesCount} source files
          </div>
        </div>

        {/* Card 2: Chunks */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>AST Code Chunks</span>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            {totalChunks > 0 ? totalChunks.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Granular functions, classes & methods
          </div>
        </div>

        {/* Card 3: Vector Store */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Vector Store (Chroma)</span>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
              <Database size={18} />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            {vectorChunks > 0 ? vectorChunks.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            MiniLM-L6-v2 384-dim dense vectors
          </div>
        </div>

        {/* Card 4: Lexical BM25 */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Keyword BM25+ Index</span>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
              <Cpu size={18} />
            </div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            {totalChunks > 0 ? totalChunks.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Subword & CamelCase tokens
          </div>
        </div>
      </div>

      {/* GitHub Metadata & Dependencies Banner */}
      {(gh.description || topDeps.length > 0 || struct.last_commit || Object.keys(langBreakdown).length > 0) && (
        <div className="glass-card" style={{ padding: '22px', marginBottom: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Languages Breakdown */}
            {Object.keys(langBreakdown).length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCode2 size={14} color="var(--accent-indigo)" />
                  <span>Languages & Technologies</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {Object.entries(langBreakdown).map(([lang, loc]) => (
                    <span
                      key={lang}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        color: 'var(--accent-indigo)',
                        fontWeight: '600'
                      }}
                    >
                      {lang}: {loc.toLocaleString()} LOC
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Dependencies */}
            {topDeps.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={14} color="var(--accent-emerald)" />
                  <span>Key Libraries & Dependencies</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {topDeps.slice(0, 12).map(dep => (
                    <span
                      key={dep}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: 'var(--accent-emerald)',
                        fontWeight: '600'
                      }}
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Last Git Commit */}
            {struct.last_commit && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitCommit size={14} color="var(--accent-cyan)" />
                  <span>Latest Commit</span>
                </div>
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600', marginBottom: '4px' }}>
                  {struct.last_commit.message}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  by {struct.last_commit.author} ({struct.last_commit.date}) • {struct.last_commit.hash}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid: Symbol Breakdown + File Browser */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Left: Symbol Breakdown */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code2 size={18} color="var(--accent-emerald)" />
            <span>AST Symbol Breakdown</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'function', label: 'Functions', color: 'var(--accent-emerald)' },
              { key: 'method', label: 'Methods', color: 'var(--accent-cyan)' },
              { key: 'class', label: 'Classes', color: 'var(--accent-indigo)' },
              { key: 'interface', label: 'Interfaces & Types', color: '#ec4899' },
              { key: 'section', label: 'Markdown Sections', color: 'var(--accent-amber)' },
              { key: 'model', label: 'Schemas & Models', color: '#a855f7' },
              { key: 'window', label: 'Code Windows', color: '#64748b' },
            ].map(sym => {
              const count = breakdown[sym.key] || 0;
              const pct = Math.round((count / totalSymbols) * 100);
              return (
                <div key={sym.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{sym.label}</span>
                    <span style={{ color: '#fff', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: sym.color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '28px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>Active LLM Provider</div>
            <div style={{ fontSize: '13px', color: 'var(--accent-emerald)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {stats?.settings?.provider || 'gemini'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Model: {stats?.settings?.model || 'gemini-2.5-flash'}
            </div>
          </div>
        </div>

        {/* Right: File Explorer */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderGit2 size={18} color="var(--accent-cyan)" />
              <span>Project File Explorer</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter files..."
                  value={fileFilter}
                  onChange={e => setFileFilter(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    width: '140px'
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {filteredFiles.length} / {files.length} files
              </span>
            </div>
          </div>

          {loadingFiles ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading files...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {files.length === 0 ? 'No source files indexed yet. Click "Re-Index Repository" above.' : 'No files match your search.'}
            </div>
          ) : (
            <div style={{ maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredFiles.map(file => (
                <div
                  key={file.path}
                  onClick={() => handleOpenFile(file.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 13px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <FileText size={15} color={
                      file.path.endsWith('.ts') || file.path.endsWith('.tsx') ? 'var(--accent-indigo)' :
                      file.path.endsWith('.py') ? 'var(--accent-emerald)' :
                      file.path.endsWith('.prisma') ? '#a855f7' :
                      file.path.endsWith('.md') ? 'var(--accent-amber)' : 'var(--accent-cyan)'
                    } />
                    <span style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.path}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {(file.size_bytes / 1024).toFixed(1)} KB
                    </span>
                    <ExternalLink size={13} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Code Viewer Modal */}
      {selectedFile && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '960px',
            maxHeight: '85vh',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-hover)',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCode2 size={18} color="var(--accent-emerald)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                  {selectedFile}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleCopyContent}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: copied ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={13} />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#0a0d14' }}>
              {loadingContent ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading source content...</div>
              ) : (
                <pre style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {fileContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
