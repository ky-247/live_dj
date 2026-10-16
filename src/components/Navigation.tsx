import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Radio, Music2, SlidersHorizontal, Sparkles, Volume2, Tv, Lock, Unlock } from 'lucide-react';
import { QueueItem } from '../types';

interface NavigationProps {
  queue?: QueueItem[];
  isLocked?: boolean;
}

export function Navigation({ queue = [], isLocked = false }: NavigationProps) {
  const [isDjAuth, setIsDjAuth] = useState(false);
  const location = useLocation();

  const pendingCount = queue.filter((q) => q.status === 'pending' && !q.is_master_list).length;
  const currentlyPlaying = queue.find((q) => q.status === 'playing');

  useEffect(() => {
    const checkAuth = () => {
      try {
        setIsDjAuth(sessionStorage.getItem('desibeats_dj_auth') === 'true');
      } catch {
        setIsDjAuth(false);
      }
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  // HIDE global navigation entirely on Guest views (/request or /)
  // Guests scanning the QR code or visiting on mobile MUST ONLY see the Request interface!
  // Navigation bar only appears when authenticated or viewing admin/stage routes (/dj, /player, /tv).
  const isGuestView = location.pathname === '/request' || location.pathname === '/';
  if (isGuestView && !isDjAuth) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <NavLink to="/request" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                  DesiBeats DJ
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                  Live Indo-DE
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Crowdsourced DJ Queue & Stage Equalizer
              </p>
            </div>
          </NavLink>

          {/* Navigation Links for Admin / Stage Displays - horizontally scrollable without breaking on small screens */}
          <nav className="flex items-center gap-1 sm:gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-inner max-w-full overflow-x-auto shrink-0">
            <NavLink
              to="/request"
              className={({ isActive }) =>
                `flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`
              }
            >
              <Music2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>1. Request</span>
              {pendingCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-black/40 text-indigo-200">
                  {pendingCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/player"
              className={({ isActive }) =>
                `flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`
              }
            >
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>2. Player</span>
              {currentlyPlaying && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </NavLink>

            <NavLink
              to="/dj"
              className={({ isActive }) =>
                `flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`
              }
            >
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>3. DJ Deck</span>
              {isLocked ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                  Locked
                </span>
              ) : !isDjAuth ? (
                <Lock className="w-3 h-3 text-neutral-500 ml-0.5" />
              ) : (
                <Unlock className="w-3 h-3 text-emerald-400 ml-0.5" />
              )}
            </NavLink>

            <NavLink
              to="/tv"
              className={({ isActive }) =>
                `flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`
              }
            >
              <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>4. Venue TV</span>
            </NavLink>
          </nav>

          {/* Now playing mini status */}
          <div className="hidden xl:flex items-center gap-3">
            {currentlyPlaying ? (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs">
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-3 bg-indigo-400 animate-[bounce_1s_infinite]"></span>
                  <span className="w-0.5 h-2 bg-cyan-400 animate-[bounce_1.3s_infinite_200ms]"></span>
                  <span className="w-0.5 h-3.5 bg-violet-400 animate-[bounce_0.8s_infinite_400ms]"></span>
                </div>
                <span className="text-neutral-400">Playing:</span>
                <span className="font-medium text-neutral-200 truncate max-w-[150px]">
                  {currentlyPlaying.title}
                </span>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Ready for Indian hits</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
