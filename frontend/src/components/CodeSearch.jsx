import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Zap, 
  Cpu, 
  BookOpen, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Code2, 
  Sliders 
} from 'lucide-react';
import { searchCode } from '../api';

export default function CodeSearch({ currentRepo }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedChunkId, setExpandedChunkId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const presets = [
    'reciprocal rank fusion',
    'AST chunk_python_code',
    'verify_jwt_token',
    'parse_unified_diff',
    'ReviewService findings'
  ];

  async function handleSearch(searchQuery = query) {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const items = await searchCode(searchQuery, mode, topK, currentRepo?.path);
      setResults(items);
      if (items.length > 0) {
        setExpandedChunkId(items[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Title */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Intelligent Code Search
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Query your codebase using Hybrid Reciprocal Rank Fusion (RRF), Dense Vector Embeddings, or BM25+ Lexical search.
        </p>
      </div>

      {/* Main Search Panel */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        {/* Search bar row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 18px',
            transition: 'border-color 0.2s ease'
          }}>
            <Search size={20} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search functions, classes, architectural concepts, or identifiers..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
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
            onClick={() => handleSearch()}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: '700',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={16} />
            <span>{isLoading ? 'Searching...' : 'Search'}</span>
          </button>
        </div>

        {/* Controls: Mode & Top-K & Presets */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Retrieval Modes */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>MODE:</span>
            {[
              { id: 'hybrid', label: 'Hybrid RRF', icon: Zap, color: 'var(--accent-emerald)' },
              { id: 'vector', label: 'Vector (Dense)', icon: Cpu, color: 'var(--accent-cyan)' },
              { id: 'bm25', label: 'BM25 (Lexical)', icon: BookOpen, color: 'var(--accent-amber)' },
            ].map(m => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: isSelected ? `1px solid ${m.color}` : '1px solid var(--border-subtle)',
                    background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: isSelected ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} color={isSelected ? m.color : 'var(--text-muted)'} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Top-K Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>TOP-K:</span>
            {[3, 5, 10, 15].map(k => (
              <button
                key={k}
                onClick={() => setTopK(k)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '5px',
                  border: topK === k ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                  background: topK === k ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: topK === k ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Query Chips */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TRY:</span>
          {presets.map(p => (
            <button
              key={p}
              onClick={() => {
                setQuery(p);
                handleSearch(p);
              }}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Search Results List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Results ({results.length})
          </h2>
        </div>

        {results.length === 0 && !isLoading && (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Enter a query above or click a preset to search indexed chunks.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {results.map((item, idx) => {
            const isExpanded = expandedChunkId === item.id;
            return (
              <div 
                key={item.id} 
                className="glass-card" 
                style={{ 
                  overflow: 'hidden',
                  borderLeft: idx === 0 ? '3px solid var(--accent-emerald)' : '1px solid var(--border-subtle)'
                }}
              >
                {/* Result Item Header */}
                <div 
                  onClick={() => setExpandedChunkId(isExpanded ? null : item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.01)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: idx === 0 ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      #{idx + 1}
                    </span>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: item.symbol_type === 'function' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      color: item.symbol_type === 'function' ? 'var(--accent-emerald)' : 'var(--accent-indigo)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      {item.symbol_type}
                    </span>

                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                      {item.symbol_name}
                    </span>

                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {item.file_path}:{item.start_line}-{item.end_line}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      Score: {item.score}
                    </span>

                    {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', background: '#070a12', padding: '18px 20px' }}>
                    {item.docstring && (
                      <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <strong>Docstring:</strong> {item.docstring}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button
                        onClick={() => handleCopy(item.content, item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '5px',
                          color: 'var(--text-secondary)',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        {copiedId === item.id ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                        <span>{copiedId === item.id ? 'Copied' : 'Copy Chunk'}</span>
                      </button>
                    </div>

                    <pre style={{
                      margin: 0,
                      padding: '14px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: '8px',
                      overflowX: 'auto',
                      fontSize: '12px',
                      lineHeight: '1.6',
                      fontFamily: 'var(--font-mono)',
                      color: '#cbd5e1'
                    }}>
                      <code>{item.content}</code>
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
