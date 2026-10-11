import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Radio, 
  Sparkles, 
  Heart, 
  Maximize2, 
  Minimize2, 
  QrCode as QrCodeIcon, 
  Flame,
  Volume2,
  Crown,
  Megaphone,
  Lock
} from 'lucide-react';
import { QueueItem, GlobalState } from '../types';
import { socket } from '../lib/socket';

export function TvPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ isLocked: false, nowPlayingTrackId: null, settings: {} as any });
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Equalizer visual simulation with 42 bands for wide TV screen
  const numBars = 42;
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: numBars }, () => Math.floor(Math.random() * 40) + 15)
  );

  useEffect(() => {
    // Generate QR Code linking directly to the /request URL
    const requestUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/request` 
      : 'https://ais-pre-5fm7tob4gyvurszpdz7wub-672204525693.europe-west2.run.app/request';

    QRCode.toDataURL(requestUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));

    // Initial fetch
    fetch('/api/queue')
      .then((res) => res.json())
      .then((data: QueueItem[]) => setQueue(data))
      .catch((err) => console.error(err));

    fetch('/api/state')
      .then((res) => res.json())
      .then(setGlobalState)
      .catch((err) => console.error(err));

    // Shared socket listener with clean unsubscription
    const handleQueueUpdated = (newQueue: QueueItem[]) => {
      setQueue(newQueue);
    };

    const handleStateUpdated = (newState: GlobalState) => {
      setGlobalState(newState);
    };

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
    };
  }, []);

  // Animate Equalizer bars
  useEffect(() => {
    const interval = setInterval(() => {
      setBarHeights((prev) =>
        prev.map((_, i) => {
          const centerBias = Math.sin((i / numBars) * Math.PI);
          const randomFactor = Math.random() * 55;
          return Math.min(95, Math.max(12, Math.floor(centerBias * 55 + randomFactor)));
        })
      );
    }, 110);

    return () => clearInterval(interval);
  }, [numBars]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentTrack = queue.find((q) => q.status === 'playing');
  const upcomingQueue = queue
    .filter((q) => q.status === 'pending')
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_master_list === b.is_master_list) return b.upvotes - a.upvotes;
      return a.is_master_list ? 1 : -1;
    })
    .slice(0, 6);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black text-neutral-100 flex flex-col justify-between p-6 md:p-10 relative overflow-hidden select-none font-sans"
    >
      {/* Background ambient lighting effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/6 left-1/5 w-[500px] h-[500px] bg-orange-600/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-pink-600/15 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[160px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 flex items-center justify-between pb-6 border-b border-neutral-800/80">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-600 to-pink-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent">
                DesiBeats Live
              </h1>
              <span className="text-[11px] uppercase font-black px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Stage Projector View
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Scan QR code on your phone to request songs & upvote live!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {globalState.isLocked ? (
            <div className="flex items-center gap-2 bg-red-950/80 border border-red-800 px-4 py-2 rounded-2xl text-xs text-red-300">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-semibold">Requests Paused by DJ</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 bg-neutral-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-neutral-800 text-xs">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-neutral-300">Live Requests Open</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-all shadow-lg cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen TV Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Live DJ Announcement Banner if active */}
      {globalState.announcement && (
        <div className="relative z-20 my-2 bg-gradient-to-r from-purple-900/90 via-pink-900/90 to-amber-900/90 border border-pink-500/50 rounded-2xl p-3.5 shadow-2xl flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-amber-300 animate-bounce flex-shrink-0" />
          <div className="flex-1 overflow-hidden">
            <span className="text-xs uppercase font-extrabold text-amber-300 tracking-wider mr-2">
              DJ Broadcast:
            </span>
            <span className="text-sm md:text-base font-bold text-white tracking-wide">
              {globalState.announcement}
            </span>
          </div>
        </div>
      )}

      {/* Main TV Layout: Left (Now Playing & Equalizer) + Right (QR Code & Up Next) */}
      <div className="relative z-20 my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 py-6 items-stretch">
        {/* Left Side: Now Playing Hero & Giant Vinyl Display */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-8 bg-neutral-950/70 border border-neutral-800/80 backdrop-blur-xl rounded-3xl p-6 md:p-10 shadow-2xl">
          {/* Now Playing Header Badge */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-400 text-xs md:text-sm font-bold tracking-wider uppercase">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>Now Playing On Stage</span>
            </div>

            {currentTrack?.is_pinned ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500 text-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
                <Crown className="w-3.5 h-3.5 fill-black" />
                <span>VIP Priority Track</span>
              </span>
            ) : currentTrack?.is_master_list ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Master Playlist Track</span>
              </span>
            ) : currentTrack ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>👍 {currentTrack.upvotes} Crowd Upvotes</span>
              </span>
            ) : null}
          </div>

          {/* Currently Playing Track Metadata */}
          {currentTrack ? (
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10">
              {/* Spinning Vinyl Record with High Glow */}
              <div className="relative flex-shrink-0 group">
                <div className="w-44 h-44 md:w-56 md:h-56 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-[0_0_60px_rgba(249,115,22,0.35)] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-3 rounded-full border border-neutral-800/80"></div>
                  <div className="absolute inset-8 rounded-full border border-neutral-800/50"></div>
                  
                  {/* Rotating center thumbnail */}
                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-amber-400/60 shadow-inner animate-[spin_10s_linear_infinite]">
                    <img
                      src={currentTrack.thumbnail_url}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute w-5 h-5 rounded-full bg-neutral-900 border-2 border-neutral-700"></div>
                </div>
              </div>

              {/* Title & Dedication Box */}
              <div className="flex-1 text-center md:text-left space-y-3 min-w-0">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2">
                  {currentTrack.title}
                </h2>
                <p className="text-base md:text-lg text-neutral-400 font-medium truncate">
                  {currentTrack.channel_title}
                </p>

                {/* Dedication Banner */}
                <div className="pt-2">
                  <div className="inline-block bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 text-left max-w-xl backdrop-blur-md shadow-xl">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
                      <span>Requested by</span>
                      <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {currentTrack.requested_by || 'Party Guest'}
                      </span>
                    </div>
                    {currentTrack.dedication_note ? (
                      <p className="text-base md:text-lg text-pink-200 font-medium italic">
                        "{currentTrack.dedication_note}"
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-500 italic">
                        Dancefloor anthem • Turn up the volume! 💃🕺
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <Sparkles className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
              <h2 className="text-3xl font-bold text-neutral-300">Waiting for Next Track</h2>
              <p className="text-neutral-500 text-sm max-w-md mx-auto">
                Scan the QR code on the right with your phone to add your favorite songs to the queue!
              </p>
            </div>
          )}

          {/* Equalizer Frequency Bars */}
          <div className="pt-4">
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-4 md:p-5">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-2 px-1 font-mono">
                <span>STAGE SPECTRUM</span>
                <span className="text-orange-400 font-semibold">20Hz - 20kHz REALTIME</span>
              </div>
              <div className="h-20 md:h-24 flex items-end justify-between gap-1 sm:gap-1.5 px-1">
                {barHeights.map((height, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col justify-end items-center h-full"
                  >
                    <div
                      className="w-full max-w-[8px] h-1 rounded-full bg-amber-300 mb-1 transition-all duration-100"
                      style={{ opacity: height > 35 ? 0.9 : 0.2 }}
                    />
                    <div
                      className="w-full max-w-[8px] rounded-t-sm transition-all duration-100 ease-out bg-gradient-to-t from-orange-600 via-pink-500 to-amber-300 shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                      style={{ height: `${height}%`, minHeight: '6px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Code for Guests & Up Next Queue */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
          {/* QR Code Card */}
          <div className="bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-neutral-800/90 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <QrCodeIcon className="w-4 h-4 text-orange-400" />
              <span>Scan to Request & Upvote</span>
            </div>

            {/* Rendered QR Code */}
            <div className="p-3 bg-white rounded-2xl shadow-xl w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Scan to request songs"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-neutral-200 animate-pulse rounded-xl" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-white">
                Open Camera • Scan QR Code
              </p>
              <p className="text-[11px] text-neutral-400">
                Search YouTube / YouTube Music & dedicate tracks to the dancefloor!
              </p>
            </div>
          </div>

          {/* Up Next List */}
          <div className="flex-1 bg-neutral-950/70 border border-neutral-800/80 backdrop-blur-xl rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h3 className="font-bold text-sm text-white">Up Next on Stage</h3>
              </div>
              <span className="text-xs bg-neutral-900 text-amber-300 px-2.5 py-0.5 rounded-full border border-neutral-800 font-semibold">
                {upcomingQueue.length} Tracks
              </span>
            </div>

            <div className="space-y-3 my-3 overflow-y-auto max-h-64 pr-1">
              {upcomingQueue.map((item, idx) => (
                <div
                  key={item.id}
                  className={`border rounded-2xl p-3 flex items-center gap-3 ${
                    item.is_pinned
                      ? 'bg-amber-950/30 border-amber-500/40 shadow-sm'
                      : 'bg-neutral-900/80 border-neutral-800/80'
                  }`}
                >
                  <span className="text-xs font-black text-neutral-500 w-5 text-center flex-shrink-0">
                    {item.is_pinned ? (
                      <Crown className="w-3.5 h-3.5 text-amber-400 mx-auto" />
                    ) : (
                      `#${idx + 1}`
                    )}
                  </span>
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    className="w-14 h-10 object-cover rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs text-white truncate">{item.title}</p>
                      {item.is_pinned && (
                        <span className="text-[9px] font-bold bg-amber-500 text-black px-1 rounded-sm">
                          VIP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                        👍 {item.upvotes}
                      </span>
                      <span>•</span>
                      <span className="truncate">{item.requested_by}</span>
                    </div>
                  </div>
                </div>
              ))}

              {upcomingQueue.length === 0 && (
                <div className="text-center py-8 text-neutral-500 space-y-1">
                  <p className="text-xs font-medium">Queue is currently empty</p>
                  <p className="text-[11px] text-neutral-600">Scan QR code to add the next song!</p>
                </div>
              )}
            </div>

            <div className="pt-2 text-center border-t border-neutral-800/60 text-[11px] text-neutral-500">
              VIP and top upvoted songs play next automatically
            </div>
          </div>
        </div>
      </div>

      {/* Footer Ticker */}
      <footer className="relative z-20 pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
          <span>DesiBeats • Indo-German Event Crowdsourced DJ</span>
        </div>
        <div className="font-mono text-neutral-400">
          Powered by YouTube IFrame Player & Realtime Queue
        </div>
      </footer>
    </div>
  );
}
