import React, { useState, useEffect } from 'react';
import { X, Save, Key, Cpu, Sparkles, Check, CheckCircle2 } from 'lucide-react';
import { fetchSettings, updateSettings } from '../api';

export default function SettingsModal({ isOpen, onClose, onSaved }) {
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [retrievalMode, setRetrievalMode] = useState('hybrid');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  async function loadSettings() {
    try {
      const data = await fetchSettings();
      setProvider(data.llm_provider || 'gemini');
      setModel(data.llm_model || 'gemini-2.5-flash');
      setRetrievalMode(data.retrieval_mode || 'hybrid');
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const payload = {
        llm_provider: provider,
        llm_model: model,
        retrieval_mode: retrievalMode,
      };
      if (geminiKey) payload.gemini_api_key = geminiKey;
      if (openaiKey) payload.openai_api_key = openaiKey;
      if (anthropicKey) payload.anthropic_api_key = anthropicKey;

      await updateSettings(payload);
      setSavedSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
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
        maxWidth: '560px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-hover)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} color="var(--accent-emerald)" />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>
              LLM & Retrieval Configuration
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Provider Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              LLM Provider
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['gemini', 'openai', 'ollama', 'mock'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p);
                    if (p === 'gemini') setModel('gemini-2.5-flash');
                    if (p === 'openai') setModel('gpt-4o-mini');
                    if (p === 'ollama') setModel('codellama');
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: provider === p ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                    background: provider === p ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    color: provider === p ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Model Identifier
            </label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="e.g. gemini-2.5-flash, gpt-4o"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#090d16',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>

          {/* Gemini API Key */}
          {provider === 'gemini' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Gemini API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="Paste GEMINI_API_KEY (leave blank to keep existing)"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          )}

          {/* OpenAI API Key */}
          {provider === 'openai' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                OpenAI API Key
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                placeholder="Paste OPENAI_API_KEY (leave blank to keep existing)"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          )}

          {/* Retrieval Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
              Default Retrieval Mode
            </label>
            <select
              value={retrievalMode}
              onChange={e => setRetrievalMode(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#090d16',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px'
              }}
            >
              <option value="hybrid">Hybrid (Reciprocal Rank Fusion)</option>
              <option value="vector">Dense Vector (MiniLM Cosine)</option>
              <option value="bm25">BM25+ (Lexical Tokens)</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-tertiary)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{savedSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
