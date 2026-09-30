import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, UserCheck, Menu, X } from 'lucide-react';
import { apiService } from '../services/api';

interface NavbarProps {
  onSearchCase?: (caseId: string) => void;
  onNavigateLanding?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSearchCase,
  onNavigateLanding,
  isMobileMenuOpen,
  onToggleMobileMenu,
}) => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [searchInput, setSearchInput] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiService.checkHealth();
        setBackendStatus(res.status === 'ok' ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim() && onSearchCase) {
      onSearchCase(searchInput.trim());
      setSearchInput('');
      setIsMobileSearchOpen(false);
    }
  };

  return (
    <header
      className="h-12 sticky top-0 z-50 flex items-center justify-between px-3 sm:px-4"
      style={{
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      {/* Left side: Mobile menu toggle + Brand */}
      <div className="flex items-center gap-2">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div
          onClick={onNavigateLanding}
          className="flex items-center gap-2 cursor-pointer select-none"
          title="View System Architecture & Landing Page"
        >
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{ background: 'var(--accent)', flexShrink: 0 }}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
          </div>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Sentinel
          </span>
          <span
            className="hidden sm:inline-block text-xs font-medium px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--bg-raised)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-default)',
              letterSpacing: '0.02em',
            }}
          >
            Fraud Ops
          </span>
        </div>
      </div>

      {/* Desktop Search */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative">
        <Search
          className="w-3 h-3 absolute left-2.5 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="Jump to case ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input-base"
          style={{ width: 260, paddingLeft: 28, paddingRight: 40, paddingTop: 5, paddingBottom: 5 }}
        />
        <kbd
          className="absolute right-2.5 text-[10px] font-mono px-1 rounded"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
          }}
        >
          /
        </kbd>
      </form>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Mobile search toggle button */}
        <button
          onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
          className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          aria-label="Toggle Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Backend status */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px]"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-muted)',
          }}
        >
          {backendStatus === 'checking' && (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--warn)' }}
              />
              <span>Connecting</span>
            </>
          )}
          {backendStatus === 'online' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Live</span>
            </>
          )}
          {backendStatus === 'offline' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
              <span style={{ color: 'var(--danger-text)' }}>Offline</span>
            </>
          )}
        </div>

        {/* Analyst badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded text-[11px] font-medium"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
          }}
        >
          <UserCheck className="w-3 h-3" style={{ color: 'var(--accent-text)' }} />
          <span>Analyst</span>
        </div>
      </div>

      {/* Mobile Search Dropdown Bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden absolute top-12 left-0 right-0 p-2.5 bg-slate-900 border-b border-slate-800 z-50 shadow-lg">
          <form onSubmit={handleSearchSubmit} className="flex items-center relative">
            <Search
              className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Enter Case ID (e.g. HHG-001)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-base w-full pl-9 pr-16 py-1.5"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-1.5 btn btn-primary px-2.5 py-1 text-[11px]"
            >
              Go
            </button>
          </form>
        </div>
      )}
    </header>
  );
};

