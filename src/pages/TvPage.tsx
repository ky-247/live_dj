import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Radio, 
  Maximize2, 
  Minimize2, 
  Lock, 
  Trophy, 
  PartyPopper,
  Sparkles
} from 'lucide-react';
import { QueueItem, GlobalState, PartyContributor } from '../types';
import { socket } from '../lib/socket';
import { sortQueue } from '../lib/queue';

interface ReactionBubble {
  id: string;
  emoji: string;
  x: number;
}

export function TvPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({
    isLocked: false,
    nowPlayingTrackId: null,
    mvpRevealActive: false,
    announcement: null,
    settings: {} as any
  });
  const [leaderboard, setLeaderboard] = useState<PartyContributor[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reactions, setReactions] = useState<ReactionBubble[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate high-contrast QR Code pointing to the current deployment request URL
  useEffect(() => {
    const requestUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/request` 
      : 'https://ais-pre-5fm7tob4gyvurszpdz7wub-672204525693.europe-west2.run.app/request';

    QRCode.toDataURL(requestUrl, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#191c18',
        light: '#efefdf',
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

    const handleNewReaction = (data: { emoji: string; clientId: string }) => {
      const id = `${Date.now()}-${Math.random()}`;
      const randomX = Math.floor(Math.random() * 80) + 10;
      setReactions((prev) => [...prev.slice(-15), { id, emoji: data.emoji, x: randomX }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 4000);
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

  // Fullscreen shortcut listener (key F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key.toLowerCase() === 'f') {
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

  const currentTrack = queue.find((q) => q.status === 'playing') || null;
  const upcomingQueue = sortQueue(queue, true).slice(0, 2); // Exactly two upcoming songs per spec
  const nextTrack = upcomingQueue[0] || null;
  const followingTrack = upcomingQueue[1] || null;

  // Clean Radio Frequency Spectrum Visualizer (Canvas in #dfed66 and #22251f)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const barsCount = 64;
    const values = new Float32Array(barsCount);
    let phase = 0;

    const render = () => {
      phase += 0.04;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barWidth = Math.max(3, w / barsCount - 3);

      for (let i = 0; i < barsCount; i++) {
        if (!currentTrack) {
          values[i] = 4;
        } else {
          const centerBias = Math.sin((i / barsCount) * Math.PI);
          const wave = Math.sin(phase * 2 + i * 0.25) * (h * 0.2);
          const noise = Math.random() * (h * 0.25);
          const target = Math.max(6, Math.min(h - 4, centerBias * (h * 0.55) + wave + noise));
          values[i] += (target - values[i]) * 0.2;
        }

        const barHeight = values[i];
        const x = i * (barWidth + 3);
        const y = h - barHeight;

        ctx.fillStyle = '#dfed66';
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [currentTrack]);

  // MVP Podium Data
  const topThreeMVPs = leaderboard.slice(0, 3);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#191c18] text-[#efefdf] flex flex-col justify-between p-4 sm:p-8 lg:p-12 relative overflow-hidden select-none font-sans"
    >
      {/* Floating Audience Reaction Toasts */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-16 animate-bounce text-3xl opacity-80"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Header Bar (No operator navigation chrome) */}
      <header className="relative z-20 flex items-center justify-between pb-4 sm:pb-6 border-b border-[#44493e]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-[#22251f] border border-[#44493e] flex items-center justify-center text-[#dfed66]">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-[#dfed66] font-bold">
                DESIBEATS LIVE
              </span>
              <span className="text-[#44493e]">•</span>
              <span className="font-mono text-xs text-[#aeb3a5]">
                VENUE ON-AIR BROADCAST
              </span>
            </div>
            <p className="text-xs text-[#aeb3a5] mt-0.5">
              Live Crowdsourced Stage Queue & Dancefloor Setlist
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {globalState.isLocked ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-sm bg-[#2a1b1b] border border-[#7a3030] text-xs font-mono uppercase tracking-wider text-[#fca5a5]">
              <Lock className="w-3.5 h-3.5" />
              <span>REQUESTS PAUSED</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-sm bg-[#22251f] border border-[#dfed66] text-xs font-mono uppercase tracking-wider text-[#dfed66]">
              <span className="w-2 h-2 rounded-full bg-[#dfed66] animate-pulse" />
              <span>REQUESTS OPEN</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            title="Toggle Fullscreen (F)"
            className="p-1.5 rounded-sm bg-[#22251f] border border-[#44493e] hover:border-[#dfed66] text-[#aeb3a5] hover:text-[#efefdf] transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Stage Announcement Banner */}
      {globalState.announcement && (
        <div className="relative z-20 my-4 bg-[#22251f] border border-[#dfed66] rounded-sm px-4 py-2.5 flex items-center gap-3 text-sm font-mono text-[#efefdf]">
          <span className="text-[#dfed66] font-bold uppercase tracking-wider shrink-0">
            DJ ANNOUNCEMENT:
          </span>
          <span className="truncate">{globalState.announcement}</span>
        </div>
      )}

      {/* CONDITIONAL: MVP AWARDS PODIUM */}
      {globalState.mvpRevealActive ? (
        <main className="relative z-20 my-auto py-8 max-w-5xl mx-auto w-full space-y-8 text-center animate-in fade-in">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#22251f] border border-[#dfed66] text-[#dfed66] font-mono text-xs uppercase tracking-wider font-bold">
              <PartyPopper className="w-3.5 h-3.5" />
              <span>PARTY FINALE • CROWD MVPS</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#efefdf]">
              Top Party Contributors
            </h2>
            <p className="text-sm font-mono text-[#aeb3a5] max-w-md mx-auto">
              Guests who drove the dancefloor tonight through popular requests and audience upvotes.
            </p>
          </div>

          {/* Podium Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
            {/* 2nd Place */}
            {topThreeMVPs[1] ? (
              <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 space-y-4 order-2 md:order-1 h-[280px] flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-[#aeb3a5]">
                    2ND PLACE
                  </div>
                  <h3 className="text-2xl font-bold text-[#efefdf] mt-1 truncate">
                    {topThreeMVPs[1].name}
                  </h3>
                </div>
                <div className="bg-[#191c18] border border-[#44493e] rounded-sm p-3 font-mono">
                  <div className="text-2xl font-bold text-[#dfed66]">
                    ▲ {topThreeMVPs[1].totalUpvotes}
                  </div>
                  <div className="text-[11px] text-[#aeb3a5] uppercase">Total Crowd Votes</div>
                </div>
                <div className="text-left font-mono text-xs text-[#aeb3a5] truncate">
                  Top: <span className="text-[#efefdf]">{topThreeMVPs[1].topTrackTitle}</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 text-center text-[#aeb3a5] font-mono text-xs order-2 md:order-1">
                Awaiting 2nd Contender
              </div>
            )}

            {/* 1st Place Champion */}
            {topThreeMVPs[0] ? (
              <div className="bg-[#22251f] border-2 border-[#dfed66] rounded-sm p-7 space-y-4 order-1 md:order-2 h-[340px] flex flex-col justify-between transform md:-translate-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#191c18] bg-[#dfed66] px-2 py-0.5 rounded-xs font-bold">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>PARTY MVP CHAMPION</span>
                  </div>
                  <h3 className="text-3xl font-bold text-[#efefdf] mt-2 truncate">
                    {topThreeMVPs[0].name}
                  </h3>
                </div>
                <div className="bg-[#191c18] border border-[#dfed66]/40 rounded-sm p-4 font-mono">
                  <div className="text-3xl font-bold text-[#dfed66]">
                    ▲ {topThreeMVPs[0].totalUpvotes}
                  </div>
                  <div className="text-xs text-[#aeb3a5] uppercase">Most Crowd Energy Generated</div>
                </div>
                <div className="text-left font-mono text-xs text-[#aeb3a5] truncate">
                  Top Anthem: <span className="text-[#efefdf] font-bold">{topThreeMVPs[0].topTrackTitle}</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 text-center text-[#aeb3a5] font-mono text-xs order-1 md:order-2">
                Awaiting Champion
              </div>
            )}

            {/* 3rd Place */}
            {topThreeMVPs[2] ? (
              <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 space-y-4 order-3 h-[260px] flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-[#aeb3a5]">
                    3RD PLACE
                  </div>
                  <h3 className="text-2xl font-bold text-[#efefdf] mt-1 truncate">
                    {topThreeMVPs[2].name}
                  </h3>
                </div>
                <div className="bg-[#191c18] border border-[#44493e] rounded-sm p-3 font-mono">
                  <div className="text-2xl font-bold text-[#dfed66]">
                    ▲ {topThreeMVPs[2].totalUpvotes}
                  </div>
                  <div className="text-[11px] text-[#aeb3a5] uppercase">Total Crowd Votes</div>
                </div>
                <div className="text-left font-mono text-xs text-[#aeb3a5] truncate">
                  Top: <span className="text-[#efefdf]">{topThreeMVPs[2].topTrackTitle}</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 text-center text-[#aeb3a5] font-mono text-xs order-3">
                Awaiting 3rd Contender
              </div>
            )}
          </div>
        </main>
      ) : (
        /* STANDARD BROADCAST VIEW: Large Typography, Visualizer, QR & 2 Upcoming Tracks */
        <main className="relative z-20 my-auto py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-7xl mx-auto w-full flex-1">
          {/* LEFT 8 COLS: Large Track Typography & Accurate Metadata */}
          <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-sm bg-[#22251f] border border-[#dfed66] text-[#dfed66] font-bold uppercase tracking-wider">
                  ● NOW PLAYING
                </span>
                {currentTrack?.is_pinned && (
                  <span className="px-2.5 py-1 rounded-sm bg-[#dfed66] text-[#191c18] font-bold uppercase tracking-wider">
                    VIP PRIORITY
                  </span>
                )}
                {currentTrack?.is_master_list && (
                  <span className="px-2.5 py-1 rounded-sm bg-[#22251f] border border-[#44493e] text-[#aeb3a5]">
                    SETLIST SELECTION
                  </span>
                )}
              </div>

              {/* Large Track Typography */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#efefdf] leading-[1.08] line-clamp-3">
                {currentTrack ? currentTrack.title : 'Ready for Next Song'}
              </h1>

              {/* Accurate Metadata */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-[#aeb3a5] pt-1">
                <span>SOURCE</span>
                <span className="text-[#efefdf] font-bold">
                  {currentTrack ? currentTrack.channel_title : 'DesiBeats Master Catalog'}
                </span>
                <span>•</span>
                <span>REQUESTED BY</span>
                <span className="text-[#efefdf] font-bold">
                  {currentTrack?.requested_by || 'Guest'}
                </span>
                <span>•</span>
                <span className="text-[#dfed66] font-bold">
                  ▲ {currentTrack ? currentTrack.upvotes : 0} VOTES
                </span>
              </div>
            </div>

            {/* Clean Radio Spectrum Equalizer Visualizer */}
            <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-4 h-36 sm:h-44 flex flex-col justify-between">
              <div className="flex items-center justify-between font-mono text-[11px] text-[#aeb3a5] border-b border-[#44493e] pb-1.5">
                <span>AUDIO FREQUENCY MONITOR</span>
                <span className="text-[#dfed66]">64 CHANNELS ACTIVE</span>
              </div>
              <canvas
                ref={canvasRef}
                width={700}
                height={120}
                className="w-full h-24 sm:h-28 block"
              />
            </div>
          </div>

          {/* RIGHT 4 COLS: High-Contrast Real QR & 2 Upcoming Songs */}
          <div className="lg:col-span-4 flex flex-col space-y-6">
            {/* Real High-Contrast QR Code Card */}
            <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 flex flex-col items-center text-center space-y-4">
              <div className="space-y-1">
                <div className="font-mono text-xs uppercase tracking-wider text-[#dfed66] font-bold">
                  POINT PHONE CAMERA
                </div>
                <h3 className="text-xl font-bold text-[#efefdf]">
                  Request Songs & Vote
                </h3>
              </div>

              {/* High Contrast Paper QR Display */}
              <div className="p-3 bg-[#efefdf] rounded-sm border border-[#44493e] shadow-md">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan QR code to open request screen"
                    className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center font-mono text-xs text-[#191c18]">
                    GENERATING QR...
                  </div>
                )}
              </div>

              <div className="font-mono text-xs text-[#aeb3a5] space-y-0.5">
                <p className="text-[#efefdf]">No app installation required</p>
                <p className="text-[11px]">Instant search, upvotes & live setlist</p>
              </div>
            </div>

            {/* Two Upcoming Songs (Per Spec: Exactly Two Upcoming Tracks) */}
            <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-4 space-y-3">
              <div className="font-mono text-xs uppercase tracking-wider text-[#aeb3a5] border-b border-[#44493e] pb-2 flex items-center justify-between">
                <span>UPCOMING QUEUE</span>
                <span className="text-[#dfed66]">SERVER RUNNING ORDER</span>
              </div>

              <div className="space-y-2">
                {/* 1. Next on air */}
                <div className="p-2.5 rounded-sm bg-[#191c18] border border-[#44493e] space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[#dfed66] font-bold uppercase tracking-wider">
                      01. NEXT ON AIR
                    </span>
                    <span className="text-[#dfed66]">
                      {nextTrack ? `▲ ${nextTrack.upvotes}` : '—'}
                    </span>
                  </div>
                  <p className="font-bold text-xs text-[#efefdf] truncate">
                    {nextTrack ? nextTrack.title : 'Queue is clear'}
                  </p>
                  <p className="font-mono text-[11px] text-[#aeb3a5] truncate">
                    {nextTrack ? `by ${nextTrack.requested_by}` : 'Submit next anthem with QR code'}
                  </p>
                </div>

                {/* 2. Following track */}
                <div className="p-2.5 rounded-sm bg-[#191c18] border border-[#44493e] space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[#aeb3a5] font-bold uppercase tracking-wider">
                      02. FOLLOWING
                    </span>
                    <span className="text-[#aeb3a5]">
                      {followingTrack ? `▲ ${followingTrack.upvotes}` : '—'}
                    </span>
                  </div>
                  <p className="font-bold text-xs text-[#efefdf] truncate">
                    {followingTrack ? followingTrack.title : 'Open slot'}
                  </p>
                  <p className="font-mono text-[11px] text-[#aeb3a5] truncate">
                    {followingTrack ? `by ${followingTrack.requested_by}` : 'Waiting for guest vote tally'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Footer Ticker with Event Info */}
      <footer className="relative z-20 pt-4 border-t border-[#44493e] flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-[#aeb3a5]">
        <div className="flex items-center gap-4">
          <span>EVENT: <strong className="text-[#efefdf]">DESIBEATS LIVE NIGHT</strong></span>
          <span className="text-[#44493e]">•</span>
          <span>SONGS PLAYED: <strong className="text-[#efefdf]">{queue.filter(q => q.status === 'played').length}</strong></span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span>FULLSCREEN: [F]</span>
          <span className="text-[#44493e]">•</span>
          <span className="text-[#dfed66] font-bold">DESIBEATS RADIO</span>
        </div>
      </footer>
    </div>
  );
}
