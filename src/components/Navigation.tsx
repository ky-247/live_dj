import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Radio, Music2, SlidersHorizontal, Volume2, Tv, Lock, Unlock } from 'lucide-react';
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
        const token = sessionStorage.getItem('desibeats_dj_token');
        setIsDjAuth(!!token);
      } catch {
        setIsDjAuth(false);
      }
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  // Hide global navigation entirely on Guest views (/request or /) for unauthenticated visitors
  // Guests scanning QR code only see the guest cue sheet
  const isGuestView = location.pathname === '/request' || location.pathname === '/';
  if (isGuestView && !isDjAuth) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-[#191c18] border-b border-[#44493e] text-[#efefdf]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Station Brand */}
          <NavLink to="/request" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-sm bg-[#22251f] border border-[#44493e] flex items-center justify-center text-[#dfed66] group-hover:border-[#dfed66] transition-colors">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm sm:text-base tracking-tight text-[#efefdf]">
                  DESIBEATS
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[#22251f] text-[#dfed66] border border-[#44493e]">
                  LIVE CUE
                </span>
              </div>
              <p className="text-[10px] font-mono text-[#aeb3a5] hidden sm:block">
                Radio Station Setlist & Crowd Stream
              </p>
            </div>
          </NavLink>

          {/* Navigation Tabs - Contemporary setlist / radio style */}
          <nav className="flex items-center gap-1 p-1 bg-[#22251f] border border-[#44493e] rounded-sm max-w-full overflow-x-auto shrink-0">
            <NavLink
              to="/request"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-mono tracking-tight transition-all ${
                  isActive
                    ? 'bg-[#dfed66] text-[#191c18] font-bold'
                    : 'text-[#aeb3a5] hover:text-[#efefdf] hover:bg-[#191c18]'
                }`
              }
            >
              <Music2 className="w-3.5 h-3.5" />
              <span>01. CUE</span>
              {pendingCount > 0 && (
                <span className="px-1 text-[10px] font-mono rounded-sm bg-black/30">
                  {pendingCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/player"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-mono tracking-tight transition-all ${
                  isActive
                    ? 'bg-[#dfed66] text-[#191c18] font-bold'
                    : 'text-[#aeb3a5] hover:text-[#efefdf] hover:bg-[#191c18]'
                }`
              }
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>02. PLAYER</span>
              {currentlyPlaying && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#dfed66] inline-block animate-pulse" />
              )}
            </NavLink>

            <NavLink
              to="/dj"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-mono tracking-tight transition-all ${
                  isActive
                    ? 'bg-[#dfed66] text-[#191c18] font-bold'
                    : 'text-[#aeb3a5] hover:text-[#efefdf] hover:bg-[#191c18]'
                }`
              }
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>03. DJ BOOTH</span>
              {isLocked ? (
                <span className="text-[9px] font-mono px-1 rounded-sm bg-[#e05d52]/20 text-[#e05d52] border border-[#e05d52]/40">
                  LOCK
                </span>
              ) : !isDjAuth ? (
                <Lock className="w-3 h-3 text-[#aeb3a5]" />
              ) : (
                <Unlock className="w-3 h-3 text-[#dfed66]" />
              )}
            </NavLink>

            <NavLink
              to="/tv"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-mono tracking-tight transition-all ${
                  isActive
                    ? 'bg-[#dfed66] text-[#191c18] font-bold'
                    : 'text-[#aeb3a5] hover:text-[#efefdf] hover:bg-[#191c18]'
                }`
              }
            >
              <Tv className="w-3.5 h-3.5" />
              <span>04. VENUE TV</span>
            </NavLink>
          </nav>

          {/* On-air status banner */}
          <div className="hidden lg:flex items-center gap-2.5 font-mono text-xs">
            {currentlyPlaying ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-[#22251f] border border-[#44493e]">
                <span className="w-2 h-2 rounded-full bg-[#dfed66] animate-pulse" />
                <span className="text-[#aeb3a5] text-[11px] uppercase">ON AIR:</span>
                <span className="font-sans font-medium text-[#efefdf] truncate max-w-[180px]">
                  {currentlyPlaying.title}
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-[#aeb3a5] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#44493e]" />
                <span>SETLIST READY</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
