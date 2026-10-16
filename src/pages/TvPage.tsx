import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Radio, 
  Sparkles, 
  Flame, 
  Maximize2, 
  Minimize2, 
  Lock, 
  Trophy, 
  Crown, 
  Award, 
  PartyPopper, 
  Music2, 
  Users, 
  Zap,
  TrendingUp,
  Tv,
  LayoutGrid,
  Disc3,
  Columns3,
  ExternalLink
} from 'lucide-react';
import { QueueItem, GlobalState, PartyContributor } from '../types';
import { socket } from '../lib/socket';
import { StageEqualizer } from '../components/StageEqualizer';

interface FloatingReaction {
  id: string;
  emoji: string;
  sender: string;
  timestamp: number;
  xPos: number;
}

export type TvLayoutMode = 'panoramic' | 'split' | 'wall';

export function TvPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({
    isLocked: false,
    nowPlayingTrackId: null,
    mvpRevealActive: false,
    settings: {} as any
  });
  const [leaderboard, setLeaderboard] = useState<PartyContributor[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<TvLayoutMode>('panoramic');
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate high-contrast QR Code pointing to the /request URL
    const requestUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/request` 
      : 'https://ais-pre-5fm7tob4gyvurszpdz7wub-672204525693.europe-west2.run.app/request';

    QRCode.toDataURL(requestUrl, {
      width: 450,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, []);

  // Fetch initial queue and state
  useEffect(() => {
    fetch('/api/queue')
      .then((res) => res.json())
      .then((data) => setQueue(data))
      .catch((err) => console.error(err));

    fetch('/api/state')
      .then((res) => res.json())
      .then((data) => setGlobalState(data))
      .catch((err) => console.error(err));

    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => setLeaderboard(data))
      .catch((err) => console.error(err));
  }, []);

  // Real-time synchronization
  useEffect(() => {
    const handleQueueUpdated = (newQueue: QueueItem[]) => {
      setQueue(newQueue);
    };

    const handleStateUpdated = (newState: GlobalState) => {
      setGlobalState(newState);
    };

    const handleLeaderboardUpdated = (newLeaderboard: PartyContributor[]) => {
      setLeaderboard(newLeaderboard);
    };

    const handleNewReaction = (reaction: { emoji: string; sender: string }) => {
      const newFloating: FloatingReaction = {
        id: Math.random().toString(),
        emoji: reaction.emoji,
        sender: reaction.sender,
        timestamp: Date.now(),
        xPos: Math.floor(Math.random() * 80) + 10,
      };
      setReactions((prev) => [...prev.slice(-15), newFloating]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== newFloating.id));
      }, 3500);
    };

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);
    socket.on('leaderboard-updated', handleLeaderboardUpdated);
    socket.on('new-reaction', handleNewReaction);

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
      socket.off('leaderboard-updated', handleLeaderboardUpdated);
      socket.off('new-reaction', handleNewReaction);
    };
  }, []);

  // Keyboard shortcut listener for fast switching on venue display (V for layout, F for fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key.toLowerCase() === 'v') {
        setLayoutMode((current) => {
          if (current === 'panoramic') return 'split';
          if (current === 'split') return 'wall';
          return 'panoramic';
        });
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const currentTrack = queue.find((q) => q.status === 'playing');
  const upcomingQueue = queue
    .filter((q) => q.status === 'pending')
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_master_list === b.is_master_list) return b.upvotes - a.upvotes;
      return a.is_master_list ? 1 : -1;
    })
    .slice(0, 5);

  const topThreeMVPs = leaderboard.slice(0, 3);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black text-neutral-100 flex flex-col justify-between p-3 sm:p-6 md:p-8 relative overflow-hidden select-none font-sans"
    >
      {/* Dynamic Laser & Neon Glow Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[650px] h-[650px] bg-indigo-600/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[160px] animate-pulse" style={{ animationDelay: '1.2s' }} />
        <div className="absolute -bottom-32 left-1/3 w-[700px] h-[700px] bg-cyan-600/15 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2.4s' }} />
        
        {/* Subtle Grid Lines for Stage vibe */}
        <div 
          className="absolute inset-0 opacity-[0.05]" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)',
            backgroundSize: '40px 40px' 
          }} 
        />
      </div>

      {/* Floating Live Emoji Reactions from Guest Phones */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-10 animate-float-reaction flex flex-col items-center pointer-events-none"
            style={{ left: `${r.xPos}%` }}
          >
            <span className="text-4xl sm:text-5xl drop-shadow-[0_0_15px_rgba(255,100,100,0.8)]">
              {r.emoji}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/60 px-2 py-0.5 rounded-full mt-1 border border-white/20">
              {r.sender}
            </span>
          </div>
        ))}
      </div>

      {/* Header Bar */}
      <header className="relative z-20 flex items-center justify-between pb-3 sm:pb-4 border-b border-indigo-500/20">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-500 p-[2px] shadow-[0_0_25px_rgba(99,102,241,0.35)]">
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
              <Radio className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                DesiBeats Stage
              </h1>
              <span className="text-[10px] sm:text-xs uppercase font-extrabold px-2.5 sm:px-3 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                LIVE PROJECTOR
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 hidden sm:flex items-center gap-2">
              <span>Scan QR on phone to request & upvote</span>
              <span className="text-neutral-600">•</span>
              <span className="text-indigo-300 font-medium">Bhangra & Bollywood Anthems</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-neutral-900/90 rounded-2xl p-1 border border-neutral-800 shadow-md">
            <button
              onClick={() => setLayoutMode('panoramic')}
              title="Panoramic Equalizer Centerstage (Key: V)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                layoutMode === 'panoramic'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Panoramic EQ</span>
            </button>

            <button
              onClick={() => setLayoutMode('split')}
              title="Split Deck View (Key: V)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                layoutMode === 'split'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Split Deck</span>
            </button>

            <button
              onClick={() => setLayoutMode('wall')}
              title="Full Stage Visualizer Wall (Key: V)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                layoutMode === 'wall'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Visualizer Wall</span>
            </button>
          </div>

          {globalState.isLocked ? (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-red-950/80 border border-red-800/80 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl text-xs sm:text-sm text-red-300 font-semibold shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <Lock className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Queue Paused</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-neutral-900/80 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl border border-emerald-500/40 text-xs sm:text-sm text-emerald-400 font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">REQUESTS OPEN</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen Projector (Key: F)"
            title="Fullscreen (F)"
            className="p-2 sm:p-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:text-white hover:border-indigo-500/50 transition-all shadow-md cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </header>

      {/* Optional DJ Stage Announcement Bar */}
      {globalState.announcement && (
        <div className="relative z-20 my-2 sm:my-3 bg-gradient-to-r from-indigo-950/80 via-neutral-900 to-violet-950/80 border border-indigo-500/30 rounded-2xl px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
          <Sparkles className="w-4 h-4 text-indigo-300 animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
            {globalState.announcement}
          </span>
          <Sparkles className="w-4 h-4 text-indigo-300 animate-spin" style={{ animationDuration: '4s' }} />
        </div>
      )}

      {/* =========================================================================
          CONDITIONAL VIEW 1: MVP PARTY FINALE PODIUM
          ========================================================================= */}
      {globalState.mvpRevealActive ? (
        <div className="relative z-30 my-auto py-6 max-w-5xl mx-auto w-full text-center space-y-8 animate-in fade-in zoom-in-95">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.3)]">
              <PartyPopper className="w-4 h-4" />
              <span>PARTY FINALE • CROWD AWARDS</span>
              <PartyPopper className="w-4 h-4" />
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              Party MVP Legends!
            </h2>
            <p className="text-neutral-400 text-base max-w-lg mx-auto">
              These guests brought the ultimate energy, requested the biggest dancefloor anthems, and drove the most votes!
            </p>
          </div>

          {/* Podium Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-6">
            {/* 2nd Place */}
            {topThreeMVPs[1] ? (
              <div className="bg-gradient-to-t from-neutral-900 via-neutral-900/90 to-neutral-950 border-2 border-slate-400/50 rounded-3xl p-6 shadow-2xl space-y-4 order-2 md:order-1 h-[320px] flex flex-col justify-between">
                <div>
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-400/20 border border-slate-400 flex items-center justify-center text-2xl font-black text-slate-200 shadow-lg">
                    🥈
                  </div>
                  <h3 className="text-2xl font-black text-white mt-3 truncate">{topThreeMVPs[1].name}</h3>
                  <div className="text-xs uppercase tracking-wider font-bold text-slate-400 mt-1">2nd Place Contender</div>
                </div>
                <div className="bg-black/60 rounded-2xl p-4 border border-neutral-800">
                  <div className="text-2xl font-black text-slate-300">🔥 {topThreeMVPs[1].totalUpvotes}</div>
                  <div className="text-[11px] text-neutral-400 font-semibold uppercase">Total Crowd Votes</div>
                </div>
                <div className="text-left bg-neutral-950/80 p-2.5 rounded-xl border border-neutral-800/80">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">Top Anthem:</div>
                  <div className="text-sm font-semibold text-neutral-200 truncate">{topThreeMVPs[1].topTrackTitle}</div>
                  <div className="text-xs text-amber-400 mt-0.5">🔥 {topThreeMVPs[1].topTrackUpvotes} upvotes on this track</div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 text-center text-neutral-500 order-2 md:order-1">
                Awaiting 2nd contender
              </div>
            )}

            {/* 1st Place - Champion */}
            {topThreeMVPs[0] ? (
              <div className="bg-gradient-to-t from-amber-950/80 via-neutral-900 to-neutral-950 border-4 border-amber-400 rounded-3xl p-7 shadow-[0_0_50px_rgba(251,191,36,0.35)] space-y-4 order-1 md:order-2 h-[370px] flex flex-col justify-between transform md:-translate-y-4">
                <div>
                  <div className="w-18 h-18 mx-auto rounded-2xl bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(251,191,36,0.5)]">
                    👑
                  </div>
                  <h3 className="text-3xl font-black text-amber-300 mt-3 truncate">{topThreeMVPs[0].name}</h3>
                  <div className="text-xs uppercase tracking-widest font-black text-amber-400 mt-1 flex items-center justify-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    PARTY MVP CHAMPION
                  </div>
                </div>
                <div className="bg-black/70 rounded-2xl p-4 border border-amber-500/40">
                  <div className="text-3xl font-black text-amber-400">🔥 {topThreeMVPs[0].totalUpvotes}</div>
                  <div className="text-xs text-amber-200/80 font-bold uppercase tracking-wider">Most Energy Generated</div>
                </div>
                <div className="text-left bg-neutral-950/90 p-3 rounded-xl border border-amber-500/30">
                  <div className="text-[11px] uppercase tracking-wider font-black text-amber-400">Crowd's #1 Anthem:</div>
                  <div className="text-sm font-bold text-white truncate">{topThreeMVPs[0].topTrackTitle}</div>
                  <div className="text-xs text-amber-300 font-semibold mt-0.5">🔥 {topThreeMVPs[0].topTrackUpvotes} upvotes on this song alone</div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 text-center text-neutral-500 order-1 md:order-2">
                Awaiting Champion
              </div>
            )}

            {/* 3rd Place */}
            {topThreeMVPs[2] ? (
              <div className="bg-gradient-to-t from-neutral-900 via-neutral-900/90 to-neutral-950 border-2 border-amber-700/50 rounded-3xl p-6 shadow-2xl space-y-4 order-3 h-[300px] flex flex-col justify-between">
                <div>
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-700/20 border border-amber-700 flex items-center justify-center text-2xl font-black text-amber-600 shadow-lg">
                    🥉
                  </div>
                  <h3 className="text-2xl font-black text-white mt-3 truncate">{topThreeMVPs[2].name}</h3>
                  <div className="text-xs uppercase tracking-wider font-bold text-amber-600 mt-1">3rd Place Contender</div>
                </div>
                <div className="bg-black/60 rounded-2xl p-4 border border-neutral-800">
                  <div className="text-2xl font-black text-amber-500">🔥 {topThreeMVPs[2].totalUpvotes}</div>
                  <div className="text-[11px] text-neutral-400 font-semibold uppercase">Total Crowd Votes</div>
                </div>
                <div className="text-left bg-neutral-950/80 p-2.5 rounded-xl border border-neutral-800/80">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">Top Anthem:</div>
                  <div className="text-sm font-semibold text-neutral-200 truncate">{topThreeMVPs[2].topTrackTitle}</div>
                  <div className="text-xs text-amber-400 mt-0.5">🔥 {topThreeMVPs[2].topTrackUpvotes} upvotes on this track</div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 text-center text-neutral-500 order-3">
                Awaiting 3rd contender
              </div>
            )}
          </div>
        </div>
      ) : layoutMode === 'panoramic' ? (
        /* =========================================================================
            LAYOUT 1: PANORAMIC CENTERSTAGE EQUALIZER (COLOSSAL EQUALIZER SPREAD)
            ========================================================================= */
        <main className="relative z-20 my-auto py-2 sm:py-4 flex flex-col justify-between max-w-7xl mx-auto w-full flex-1 gap-4">
          {/* Top Row: Compact Now Playing Hero + High-Contrast QR Badge + Up Next Ticker */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            {/* Now Playing Banner (7 cols) */}
            <div className="lg:col-span-8 bg-gradient-to-r from-neutral-950/90 via-neutral-900/90 to-neutral-950/90 border-2 border-indigo-500/30 rounded-3xl p-3 sm:p-4 backdrop-blur-xl shadow-[0_0_35px_rgba(99,102,241,0.15)] flex items-center gap-4">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                {currentTrack ? (
                  <img
                    src={currentTrack.thumbnail_url}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover animate-[spin_20s_linear_infinite]"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                    <Disc3 className="w-8 h-8 text-neutral-600 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider font-black text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    NOW PLAYING
                  </span>
                  {currentTrack?.is_pinned && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                      VIP SONG
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white truncate leading-tight">
                  {currentTrack?.title || 'Ready for Next Song'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 truncate">
                  {currentTrack?.channel_title} {currentTrack?.requested_by ? `• Requested by ${currentTrack.requested_by}` : ''}
                </p>

                {currentTrack && (
                  <div className="pt-1 flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-bold flex items-center gap-1 border border-indigo-500/30">
                      <Flame className="w-3.5 h-3.5 text-indigo-400" />
                      {currentTrack.upvotes} Upvotes
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* High-Contrast Phone QR Card (4 cols) */}
            <div className="lg:col-span-4 bg-gradient-to-br from-neutral-950/90 via-black to-neutral-900/90 border-2 border-indigo-500/30 rounded-3xl p-3 sm:p-4 backdrop-blur-xl shadow-xl flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Request on Phone</span>
                </div>
                <p className="text-xs sm:text-sm font-black text-white leading-tight">
                  Point Camera at QR
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Instant requests & live votes
                </p>
              </div>

              <div className="p-1.5 bg-white rounded-xl shadow-lg border-2 border-indigo-500/30 flex-shrink-0">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan QR code"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 bg-white text-black text-[9px] flex items-center justify-center font-bold">
                    QR...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MAIN CENTERSTAGE: MASSIVE 12-COLUMN WIDE EQUALIZER */}
          <div className="w-full flex-1 flex flex-col justify-center my-auto">
            <StageEqualizer
              isPlaying={!!currentTrack}
              heightClass="h-72 sm:h-96 md:h-[420px] lg:h-[480px]"
              showControls={true}
              className="border-2 border-indigo-500/25 shadow-[0_0_50px_rgba(99,102,241,0.2)]"
            />
          </div>

          {/* Bottom Up Next Ticker */}
          {upcomingQueue.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto py-2.5 px-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider font-black text-neutral-400 flex-shrink-0 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                UP NEXT:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap">
                {upcomingQueue.map((item, idx) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300"
                  >
                    <strong className="text-indigo-300">#{idx + 1}</strong>
                    <span className="font-semibold truncate max-w-[170px]">{item.title}</span>
                    <span className="text-[10px] text-amber-400 font-bold">🔥 {item.upvotes}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>
      ) : layoutMode === 'split' ? (
        /* =========================================================================
            LAYOUT 2: SPLIT DECK VIEW (EXPANDED DUAL COLUMNS WITH LARGE EQUALIZER)
            ========================================================================= */
        <main className="relative z-20 my-auto py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center max-w-7xl mx-auto w-full flex-1">
          {/* LEFT 7 COLS: Current Track Hero + EXPANDED LARGE STAGE EQUALIZER */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
            {/* Live Indicator */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
              </span>
              <span className="text-xs sm:text-sm uppercase tracking-widest font-black text-cyan-300 bg-cyan-950/60 px-3.5 py-1 rounded-full border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                NOW PLAYING ON STAGE
              </span>
              {currentTrack?.is_pinned && (
                <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  VIP Song
                </span>
              )}
            </div>

            {/* Current Track Card */}
            {currentTrack ? (
              <div className="relative bg-gradient-to-r from-neutral-950/90 via-neutral-900/90 to-neutral-950/90 border-2 border-indigo-500/30 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(99,102,241,0.15)] flex flex-col sm:flex-row items-center gap-5 group">
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                  <img
                    src={currentTrack.thumbnail_url}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight line-clamp-2">
                    {currentTrack.title}
                  </h2>
                  <p className="text-sm sm:text-base font-semibold text-neutral-400 truncate">
                    {currentTrack.channel_title}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <div className="px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-indigo-400" />
                      <span>{currentTrack.upvotes} Upvotes</span>
                    </div>

                    <div className="px-3 py-1 rounded-xl bg-neutral-800/80 border border-neutral-700 text-neutral-300 text-xs sm:text-sm font-medium">
                      Requested by <span className="font-bold text-white">{currentTrack.requested_by}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 text-center space-y-2">
                <Music2 className="w-10 h-10 text-neutral-600 mx-auto animate-bounce" />
                <h3 className="text-xl font-bold text-neutral-300">Ready for Stage Audio</h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Scan the QR code to submit a song or start the queue from the DJ console!
                </p>
              </div>
            )}

            {/* ENLARGED MULTI-MODE STAGE EQUALIZER */}
            <StageEqualizer
              isPlaying={!!currentTrack}
              heightClass="h-56 sm:h-72 md:h-84 lg:h-96"
              showControls={true}
              className="border-2 border-indigo-500/25 shadow-[0_0_35px_rgba(99,102,241,0.15)]"
            />
          </div>

          {/* RIGHT 5 COLS: High-Contrast Neon QR Code & Up Next Queue */}
          <div className="lg:col-span-5 flex flex-col space-y-5">
            {/* Direct Phone Request QR Code Card */}
            <div className="bg-gradient-to-br from-neutral-900/90 via-black to-neutral-900/90 border-2 border-indigo-500/30 rounded-3xl p-5 backdrop-blur-xl shadow-[0_0_35px_rgba(99,102,241,0.2)] flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wide bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                  Pick Next Song On Your Phone
                </h3>
              </div>

              {/* High Contrast Clean QR Code */}
              <div className="p-3 bg-white rounded-2xl shadow-2xl shadow-indigo-500/15 border-4 border-indigo-500/30 group-hover:scale-105 transition-transform duration-300">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan QR code to request songs on your phone"
                    className="w-36 h-36 sm:w-44 sm:h-44 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center text-black text-xs font-bold">
                    Generating QR Code...
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Open Camera ➔ Point at Code ➔ Tap Link
                </p>
                <p className="text-[11px] text-neutral-400 font-medium">
                  Instant Requests • Live Upvotes • Floating Party Reactions 🔥
                </p>
              </div>
            </div>

            {/* Up Next / Next in Line Card */}
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-3xl p-4 sm:p-5 backdrop-blur-md shadow-xl flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-200">
                    Up Next in Queue
                  </span>
                </div>
                <span className="text-xs font-bold text-neutral-400">
                  {upcomingQueue.length} upcoming
                </span>
              </div>

              <div className="divide-y divide-neutral-900 mt-2 space-y-1">
                {upcomingQueue.length > 0 ? (
                  upcomingQueue.map((item, index) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-left group hover:bg-neutral-900/40 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center flex-shrink-0 ${
                          item.is_pinned 
                            ? 'bg-amber-500 text-black shadow-md' 
                            : index === 0 
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                            : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {item.is_pinned ? '★' : `#${index + 1}`}
                        </span>
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-neutral-800"
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">
                            by {item.requested_by}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                        <Flame className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{item.upvotes}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-neutral-500 text-xs font-medium">
                    Queue is open! Be the first to add an anthem.
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* =========================================================================
            LAYOUT 3: VISUALIZER WALL (MASSIVE FULL SCREEN CONCERT VISUALIZER)
            ========================================================================= */
        <main className="relative z-20 my-auto py-2 sm:py-4 flex flex-col justify-between max-w-7xl mx-auto w-full flex-1">
          {/* Top Now Playing Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-950/80 border border-indigo-500/30 rounded-3xl p-3 sm:p-5 backdrop-blur-xl shadow-[0_0_35px_rgba(99,102,241,0.15)]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.2)] flex-shrink-0">
                {currentTrack ? (
                  <img
                    src={currentTrack.thumbnail_url}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover animate-[spin_20s_linear_infinite]"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                    <Disc3 className="w-8 h-8 text-neutral-600 animate-spin" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    CONCERT VISUALIZER
                  </span>
                  {currentTrack?.is_pinned && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                      VIP ANTHEM
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-3xl font-black text-white truncate mt-1">
                  {currentTrack?.title || 'Awaiting Next Track'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 truncate">
                  {currentTrack?.channel_title} {currentTrack?.requested_by ? `• Requested by ${currentTrack.requested_by}` : ''}
                </p>
              </div>
            </div>

            {/* Quick QR Code Corner in Wall View */}
            <div className="flex items-center gap-3 bg-black/60 border border-neutral-800 rounded-2xl p-2 px-3">
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="Scan QR"
                  className="w-14 h-14 rounded-lg bg-white p-1"
                />
              )}
              <div className="text-left text-xs">
                <p className="font-extrabold text-white">Scan to Request</p>
                <p className="text-[10px] text-indigo-300 font-medium">Add songs & react live</p>
              </div>
            </div>
          </div>

          {/* Center Stage Massive Equalizer Visualizer */}
          <div className="my-3 sm:my-5 flex-1 flex flex-col justify-center">
            <StageEqualizer
              isPlaying={!!currentTrack}
              heightClass="h-[440px] sm:h-[540px] md:h-[620px] lg:h-[700px]"
              showControls={true}
              className="border-2 border-indigo-500/25 shadow-[0_0_60px_rgba(99,102,241,0.2)]"
            />
          </div>

          {/* Quick Up Next Ticker */}
          {upcomingQueue.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto py-2 px-4 bg-neutral-950/60 border border-neutral-800 rounded-2xl backdrop-blur-md">
              <span className="text-[11px] uppercase tracking-wider font-black text-neutral-400 flex-shrink-0 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                UP NEXT:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto text-xs whitespace-nowrap">
                {upcomingQueue.map((item, idx) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300"
                  >
                    <strong className="text-indigo-300">#{idx + 1}</strong>
                    <span className="font-medium truncate max-w-[150px]">{item.title}</span>
                    <span className="text-[10px] text-amber-400">🔥 {item.upvotes}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Footer Ticker with Live Room Stats */}
      <footer className="relative z-20 pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Active Event: <strong className="text-white">Desi Party Night Frankfurt</strong></span>
          </div>
          <span className="text-neutral-700">•</span>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Total Songs Played: <strong className="text-white">{queue.filter(q => q.status === 'played').length}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
          <span className="hidden sm:inline">Shortcuts: [1-6] Equalizers • [S] Scale EQ • [C] Cycle • [T] Themes • [V] Layout • [F] Fullscreen</span>
          <span className="text-neutral-700">•</span>
          <span className="text-neutral-300 font-bold">DESIBEATS LIVE</span>
        </div>
      </footer>
    </div>
  );
}
