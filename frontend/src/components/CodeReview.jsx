import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Bug, 
  Flame, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  FileDiff, 
  Sliders, 
  ExternalLink 
} from 'lucide-react';
import { reviewDiff } from '../api';

const SAMPLE_SQLI_DIFF = `diff --git a/app/db/users.py b/app/db/users.py
index 1234567..89abcdef 100644
--- a/app/db/users.py
+++ b/app/db/users.py
@@ -12,6 +12,7 @@ def get_user_by_email(email: str):
-    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
+    query = f"SELECT * FROM users WHERE email = '{email}'"
+    cursor.execute(query)
`;

const SAMPLE_OFF_BY_ONE_DIFF = `diff --git a/app/utils/search.py b/app/utils/search.py
index 2345678..bcdef01 100644
--- a/app/utils/search.py
+++ b/app/utils/search.py
@@ -8,6 +8,6 @@ def binary_search(arr, target):
-    high = len(arr) - 1
+    high = len(arr)
     while low <= high:
         mid = (low + high) // 2
`;

export default function CodeReview({ currentRepo }) {
  const [diffText, setDiffText] = useState(SAMPLE_SQLI_DIFF);
  const [prUrl, setPrUrl] = useState('');
  const [useUrl, setUseUrl] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [isLoading, setIsLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  async function handleReview() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reviewDiff(
        useUrl ? null : diffText,
        useUrl ? prUrl : null,
        severityFilter || null,
        minConfidence,
        currentRepo?.path
      );
      setReviewResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopySuggestion(text, idx) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function getSeverityColor(sev) {
    switch (sev.toLowerCase()) {
      case 'high': return 'var(--accent-rose)';
      case 'medium': return 'var(--accent-amber)';
      case 'low': return 'var(--accent-cyan)';
      default: return 'var(--accent-emerald)';
    }
  }

  function getCategoryIcon(cat) {
    switch (cat.toLowerCase()) {
      case 'security': return <ShieldAlert size={14} color="var(--accent-rose)" />;
      case 'bug': return <Bug size={14} color="var(--accent-amber)" />;
      case 'performance': return <Zap size={14} color="var(--accent-cyan)" />;
      default: return <AlertTriangle size={14} color="var(--accent-emerald)" />;
    }
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Automated Code Review & PR Auditor
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Analyze pull requests and unified diffs with enclosing AST context and Pydantic-validated findings.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Input Column */}
        <div className="glass-card" style={{ padding: '24px' }}>
          {/* Mode Switch: Raw Diff vs GitHub PR URL */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setUseUrl(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: !useUrl ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                  background: !useUrl ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: !useUrl ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Unified Diff
              </button>
              <button
                onClick={() => setUseUrl(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: useUrl ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                  background: useUrl ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: useUrl ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                GitHub PR URL
              </button>
            </div>

            {/* Presets */}
            {!useUrl && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setDiffText(SAMPLE_SQLI_DIFF)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  SQLi Preset
                </button>
                <button
                  onClick={() => setDiffText(SAMPLE_OFF_BY_ONE_DIFF)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Boundary Preset
                </button>
              </div>
            )}
          </div>

          {/* Input field */}
          {useUrl ? (
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="https://github.com/owner/repo/pull/123"
                value={prUrl}
                onChange={e => setPrUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <textarea
                rows={12}
                value={diffText}
                onChange={e => setDiffText(e.target.value)}
                placeholder="Paste unified diff here..."
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>
          )}

          {/* Controls: Severity & Min Confidence */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
                MIN SEVERITY
              </label>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: '#0e1422',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                <option value="">All Severities</option>
                <option value="high">High Only</option>
                <option value="medium">Medium + High</option>
                <option value="low">Low + Medium + High</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
                CONFIDENCE THRESHOLD: {Math.round(minConfidence * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minConfidence}
                onChange={e => setMinConfidence(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-emerald)' }}
              />
            </div>
          </div>

          <button
            onClick={handleReview}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: '700',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ShieldAlert size={18} />
            <span>{isLoading ? 'Analyzing Diff...' : 'Run Automated Review'}</span>
          </button>
        </div>

        {/* Right Findings Column */}
        <div>
          {error && (
            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {!reviewResult && !isLoading && (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Click <strong>"Run Automated Review"</strong> to generate structured findings for this diff.
            </div>
          )}

          {reviewResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Summary Card */}
              <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '3px solid var(--accent-emerald)' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Review Summary
                </div>
                <div style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>
                  {reviewResult.summary}
                </div>
              </div>

              {/* Findings */}
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Findings ({reviewResult.findings.length})
              </div>

              {reviewResult.findings.map((finding, idx) => (
                <div key={idx} className="glass-card" style={{ padding: '18px 20px' }}>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        {getCategoryIcon(finding.category)}
                        <span>{finding.category}</span>
                      </span>

                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        color: getSeverityColor(finding.severity),
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${getSeverityColor(finding.severity)}`
                      }}>
                        {finding.severity}
                      </span>
                    </div>

                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Confidence: {Math.round(finding.confidence * 100)}%
                    </span>
                  </div>

                  {/* Location */}
                  <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginBottom: '8px', fontWeight: '600' }}>
                    {finding.file}:{finding.line}
                  </div>

                  {/* Issue */}
                  <div style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '12px', lineHeight: '1.5' }}>
                    {finding.issue}
                  </div>

                  {/* Suggestion Code Block */}
                  {finding.suggestion && (
                    <div style={{
                      background: '#070a12',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '12px',
                      position: 'relative'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                          Suggested Fix:
                        </span>
                        <button
                          onClick={() => handleCopySuggestion(finding.suggestion, idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          {copiedIndex === idx ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                          <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#93c5fd', whiteSpace: 'pre-wrap' }}>
                        <code>{finding.suggestion}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
