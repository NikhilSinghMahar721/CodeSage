import React from 'react';
import { 
  Layers, 
  Search, 
  ShieldAlert, 
  MessageSquareCode, 
  Settings, 
  Cpu, 
  FolderGit2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export default function Header({ activeTab, setActiveTab, stats, currentRepo, onOpenSettings, isConnected }) {
  const tabs = [
    { id: 'hub', label: 'Repository Hub', icon: FolderGit2, badge: stats?.total_files ? `${stats.total_files} files` : null },
    { id: 'search', label: 'Hybrid Search', icon: Search, badge: 'RRF' },
    { id: 'review', label: 'AI Reviewer', icon: ShieldAlert, badge: 'Diff' },
    { id: 'qa', label: 'Codebase Q&A', icon: MessageSquareCode, badge: 'Citations' },
  ];

  const repoDisplayName = currentRepo?.full_name || currentRepo?.name || stats?.repo_name || 'CodeSage';

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 14, 23, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '68px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.35)'
          }}>
            <Cpu size={22} color="#07090e" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: '#fff' }}>
                CodeSage
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                letterSpacing: '0.04em'
              }}>
                v0.1.0
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              AI Code Review & Deep Repo Intelligence
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)' : 'none',
                  borderBottom: isActive ? '2px solid var(--accent-emerald)' : '2px solid transparent'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--accent-emerald)' : 'var(--text-secondary)'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    fontWeight: '600'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Tools & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Active Repo Chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            padding: '5px 12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              boxShadow: isConnected ? '0 0 8px var(--accent-emerald)' : 'none'
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#fff' }}>
              {repoDisplayName}
            </span>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Configure LLM & Retrieval"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
