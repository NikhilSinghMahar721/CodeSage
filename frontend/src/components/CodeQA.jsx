import React, { useState } from 'react';
import { 
  MessageSquareCode, 
  Send, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Code2, 
  Layers, 
  Clock,
  FolderGit2
} from 'lucide-react';
import { askQuestion } from '../api';

export default function CodeQA({ currentRepo }) {
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [qaResponse, setQaResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedChunk, setSelectedChunk] = useState(null);

  const repoName = currentRepo?.name || 'repository';
  const isCustomRepo = currentRepo?.is_github || currentRepo?.path !== '.';

  const starterQuestions = isCustomRepo ? [
    `What is the project file structure and architecture of ${repoName}?`,
    `What are the core classes and services defined in ${repoName}?`,
    `Where are the main configuration or entrypoints located?`,
    `How does error handling and validation work in ${repoName}?`
  ] : [
    'How does the Reciprocal Rank Fusion algorithm combine vector and BM25 scores?',
    'Where is the AST code chunking logic defined and what does it extract?',
    'How does the ContextBuilder attach enclosing functions to diff hunks?',
    'What LLM providers are supported and how are retries handled?'
  ];

  async function handleAsk(q = question) {
    if (!q.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await askQuestion(q, mode, 5, currentRepo?.path);
      setQaResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Title & Active Repo Context */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Codebase Q&A with Verified Citations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Ask architectural and implementation questions. Answers are enriched with citations verified against indexed chunks.
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '8px',
          color: 'var(--accent-emerald)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)'
        }}>
          <FolderGit2 size={15} />
          <span>Active Context: <strong>{currentRepo?.full_name || currentRepo?.name || 'Local CodeSage'}</strong></span>
        </div>
      </div>

      {/* Question Input Card */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 18px'
          }}>
            <MessageSquareCode size={20} color="var(--text-muted)" />
            <input
              type="text"
              placeholder={`Ask a question about ${currentRepo?.full_name || currentRepo?.name || 'this repository'}...`}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button
            onClick={() => handleAsk()}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: '700',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={16} />
            <span>{isLoading ? 'Thinking...' : 'Ask'}</span>
          </button>
        </div>

        {/* Starter Prompts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
            Suggestions for {currentRepo?.name || 'repository'}:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {starterQuestions.map(sq => (
              <button
                key={sq}
                onClick={() => {
                  setQuestion(sq);
                  handleAsk(sq);
                }}
                style={{
                  fontSize: '12px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Answer & Citations Layout */}
      {qaResponse && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          {/* Left: AI Answer */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-indigo)" />
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>CodeSage Answer</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <Clock size={12} />
                <span>{qaResponse.latency_sec}s</span>
              </div>
            </div>

            <div style={{
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)'
            }}>
              {qaResponse.answer}
            </div>

            {/* Verified Citations List */}
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Referenced Code Citations ({qaResponse.citations.length})
              </h3>

              {qaResponse.citations.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No direct line citations in answer.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {qaResponse.citations.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: c.is_valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        border: c.is_valid ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        color: c.is_valid ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                      }}
                    >
                      {c.is_valid ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      <span>{c.raw_citation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Retrieved Supporting Chunks */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="var(--accent-cyan)" />
              <span>Retrieved Code Chunks ({qaResponse.retrieved_chunks.length})</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
              {qaResponse.retrieved_chunks.map((chunk, idx) => (
                <div
                  key={chunk.id}
                  onClick={() => setSelectedChunk(selectedChunk?.id === chunk.id ? null : chunk)}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                      {chunk.symbol_name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Score: {chunk.score}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {chunk.file_path}:{chunk.start_line}-{chunk.end_line}
                  </div>

                  {selectedChunk?.id === chunk.id && (
                    <pre style={{
                      marginTop: '10px',
                      padding: '10px',
                      background: '#070a12',
                      borderRadius: '6px',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      fontFamily: 'var(--font-mono)',
                      color: '#cbd5e1',
                      overflowX: 'auto'
                    }}>
                      <code>{chunk.content}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
