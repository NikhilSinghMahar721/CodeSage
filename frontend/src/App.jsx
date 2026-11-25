import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GitHubRepoBar from './components/GitHubRepoBar';
import RepositoryHub from './components/RepositoryHub';
import CodeSearch from './components/CodeSearch';
import CodeReview from './components/CodeReview';
import CodeQA from './components/CodeQA';
import SettingsModal from './components/SettingsModal';
import { fetchStats, fetchHealth, fetchCurrentRepo } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('hub');
  const [stats, setStats] = useState(null);
  const [currentRepo, setCurrentRepo] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    await checkHealth();
    await loadCurrentRepo();
    await loadRepoStats();
  }

  async function checkHealth() {
    try {
      await fetchHealth();
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }

  async function loadCurrentRepo() {
    try {
      const repo = await fetchCurrentRepo();
      setCurrentRepo(repo);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRepoStats(repoPath = null) {
    try {
      const data = await fetchStats(repoPath);
      setStats(data);
      setIsConnected(true);
    } catch (err) {
      console.error(err);
      setIsConnected(false);
    }
  }

  function handleRepoLoaded(newRepo) {
    setCurrentRepo(newRepo);
    loadRepoStats(newRepo.path);
    setActiveTab('hub');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        currentRepo={currentRepo}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isConnected={isConnected}
      />

      {/* Generalized GitHub & Local Repo Input Bar */}
      <GitHubRepoBar
        currentRepo={currentRepo}
        onRepoLoaded={handleRepoLoaded}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'hub' && (
          <RepositoryHub
            currentRepo={currentRepo}
            stats={stats}
            onRefreshStats={() => loadRepoStats(currentRepo?.path)}
          />
        )}
        {activeTab === 'search' && (
          <CodeSearch currentRepo={currentRepo} />
        )}
        {activeTab === 'review' && (
          <CodeReview currentRepo={currentRepo} />
        )}
        {activeTab === 'qa' && (
          <CodeQA currentRepo={currentRepo} />
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => loadRepoStats(currentRepo?.path)}
      />

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '18px 24px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginTop: 'auto'
      }}>
        CodeSage — AI-powered Code Review & Repository Intelligence • Powered by FastAPI & React
      </footer>
    </div>
  );
}
