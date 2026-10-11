import { useState, useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  ListMusic,
  Tv,
  Crown,
  Megaphone,
  Headphones,
  Lock,
  KeyRound,
  Delete,
  ShieldCheck
} from 'lucide-react';
import { QueueItem, GlobalState } from '../types';
import { EqualizerVisualizer } from '../components/EqualizerVisualizer';
import { socket } from '../lib/socket';

export function PlayerPage() {
  // Authentication state for Stage Operator
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ isLocked: false, nowPlayingTrackId: null, settings: {} as any });
  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [showQueueSidebar, setShowQueueSidebar] = useState(true);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read stored PIN or default to 1234
  const storedPin = typeof window !== 'undefined' 
    ? localStorage.getItem('desibeats_dj_pin') || '1234'
    : '1234';

  // Check initial authentication
  useEffect(() => {
    try {
      const isAuth = sessionStorage.getItem('desibeats_dj_auth') === 'true';
      setIsAuthenticated(isAuth);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput === storedPin) {
      setIsAuthenticated(true);
      setPinError(null);
      setPinInput('');
      try {
        sessionStorage.setItem('desibeats_dj_auth', 'true');
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error(err);
      }
    } else {
      setPinError('Incorrect Passcode PIN. Default is 1234.');
      setPinInput('');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (pinInput.length < 6) {
      const next = pinInput + val;
      setPinInput(next);
      setPinError(null);
      if (next.length === storedPin.length && next === storedPin) {
        setIsAuthenticated(true);
        setPinInput('');
        sessionStorage.setItem('desibeats_dj_auth', 'true');
        window.dispatchEvent(new Event('storage'));
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  // Play next track logic: VIP pinned tracks always play first!
  const playNextTrack = useCallback(async (currentQueue: QueueItem[]) => {
    const pending = currentQueue.filter((q) => q.status === 'pending');
    if (pending.length === 0) return;

    // 1. VIP Pinned tracks play next immediately
    const pinnedTracks = pending.filter((q) => q.is_pinned);
    // 2. Highest upvoted live requests
    const liveRequests = pending.filter((q) => !q.is_master_list && !q.is_pinned).sort((a, b) => b.upvotes - a.upvotes);
    // 3. Master list tracks fallback
    const masterRequests = pending.filter((q) => q.is_master_list && !q.is_pinned);

    const nextTrack = pinnedTracks.length > 0 
      ? pinnedTracks[0] 
      : (liveRequests.length > 0 ? liveRequests[0] : masterRequests[0]);

    if (nextTrack) {
      setCurrentTrack(nextTrack);
      setIsPlaying(true);
      setErrorNotice(null);
      await fetch(`/api/queue/${nextTrack.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'playing' }),
      }).catch((err) => console.error(err));
    }
  }, []);

  const handleEnd = useCallback(async () => {
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = null;
    }

    if (currentTrack) {
      await fetch(`/api/queue/${currentTrack.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'played' }),
      }).catch((err) => console.error(err));
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setErrorNotice(null);
  }, [currentTrack]);

  // Shared socket listener
  useEffect(() => {
    const handleQueueUpdated = (newQueue: QueueItem[]) => {
      setQueue(newQueue);
    };

    const handleStateUpdated = (newState: GlobalState) => {
      setGlobalState(newState);
    };

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);

    fetch('/api/queue')
      .then((res) => res.json())
      .then((data: QueueItem[]) => {
        setQueue(data);
        const playing = data.find((q) => q.status === 'playing');
        if (playing) {
          setCurrentTrack(playing);
          setIsPlaying(true);
        }
      })
      .catch((err) => console.error(err));

    fetch('/api/state')
      .then((res) => res.json())
      .then(setGlobalState)
      .catch((err) => console.error(err));

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
    };
  }, []);

  // When currentTrack is null and we have tracks in queue, pick the next song ONLY IF authenticated
  useEffect(() => {
    if (isAuthenticated && !currentTrack && queue.length > 0) {
      playNextTrack(queue);
    }
  }, [isAuthenticated, queue, currentTrack, playNextTrack]);

  const handleSkip = () => {
    handleEnd();
  };

  const unlockAudio = () => {
    setAudioUnlocked(true);
    setAutoplayBlocked(false);
    if (playerRef.current) {
      playerRef.current.unMute?.();
      playerRef.current.playVideo?.();
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (!audioUnlocked) {
      unlockAudio();
      return;
    }
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (playerRef.current) {
      playerRef.current.setVolume(newVol);
      if (newVol > 0 && isMuted) {
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

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

  // Up next pending queue items sorted by priority: VIP pinned -> upvotes -> master
  const upcomingTracks = queue
    .filter((q) => q.status === 'pending')
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_master_list === b.is_master_list) return b.upvotes - a.upvotes;
      return a.is_master_list ? 1 : -1;
    });

  // YouTube options - strictly plays audio in the background!
  const ytOpts = {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1 as const,
      controls: 0 as const,
      disablekb: 1 as const,
      fs: 0 as const,
      modestbranding: 1 as const,
      playsinline: 1 as const,
    },
  };

  // PASSCODE PROTECT MODAL: Block audio and playback if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Stage Player Protected</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Enter the DJ / Stage Admin PIN to control stage audio playback & stream output.
            </p>
          </div>

          {pinError && (
            <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-300 font-medium">
              {pinError}
            </div>
          )}

          {/* PIN Input Indicator */}
          <div className="flex justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pinInput.length > idx
                    ? 'bg-orange-500 border-orange-500 scale-110'
                    : 'border-neutral-700 bg-neutral-800'
                }`}
              />
            ))}
          </div>

          {/* Touch-Friendly Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xl font-bold text-neutral-200 transition-all flex items-center justify-center cursor-pointer shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPinInput('');
                setPinError(null);
              }}
              className="h-14 rounded-2xl bg-neutral-800/60 hover:bg-neutral-800 text-xs font-semibold text-neutral-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-14 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xl font-bold text-neutral-200 transition-all flex items-center justify-center cursor-pointer shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="h-14 rounded-2xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handlePinSubmit} className="pt-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Or type PIN (default: 1234)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2 px-3 text-center text-sm tracking-widest text-white focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-90 font-bold text-sm text-white shadow-lg shadow-orange-500/25 cursor-pointer"
            >
              Unlock Stage Player
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Default Passcode PIN: <strong className="text-neutral-400">1234</strong></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100 flex flex-col lg:flex-row relative overflow-hidden"
    >
      {/* HIDDEN YOUTUBE PLAYER: audio stream only, video is completely invisible */}
      {currentTrack && (
        <div
          className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none w-1 h-1 overflow-hidden"
          aria-hidden="true"
        >
          <YouTube
            videoId={currentTrack.youtube_id}
            opts={ytOpts}
            onEnd={handleEnd}
            onPlay={() => {
              setIsPlaying(true);
              setAutoplayBlocked(false);
            }}
            onPause={() => setIsPlaying(false)}
            onReady={(e) => {
              playerRef.current = e.target;
              e.target.setVolume(volume);
              const playPromise = e.target.playVideo();
              // Check if browser blocked autoplay
              if (playPromise !== undefined) {
                Promise.resolve(playPromise).catch(() => {
                  setAutoplayBlocked(true);
                });
              }
            }}
            onError={(e) => {
              console.warn('YouTube playback error (code ' + e?.data + '). Video may be unplayable or region restricted.', e);
              setErrorNotice('Video restricted or unplayable. Skipping to next track in 2s...');
              
              if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
              skipTimeoutRef.current = setTimeout(() => {
                handleEnd();
              }, 2000);
            }}
          />
        </div>
      )}

      {/* Main Stage Visualizer Area (Center/Left) */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative z-10 overflow-y-auto">
        {/* DJ Live Announcement Ticker Banner */}
        {globalState.announcement && (
          <div className="mb-4 bg-gradient-to-r from-purple-900/90 via-pink-900/90 to-amber-900/90 border border-pink-500/40 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-lg animate-in fade-in">
            <Megaphone className="w-5 h-5 text-amber-300 animate-bounce flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <span className="text-[11px] uppercase font-bold text-amber-300 tracking-wider mr-2">
                DJ Announcement:
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {globalState.announcement}
              </span>
            </div>
          </div>
        )}

        {/* Autoplay Unlock Banner */}
        {autoplayBlocked && (
          <div className="mb-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200">
            <div className="flex items-center gap-3">
              <Headphones className="w-6 h-6 text-amber-400 animate-pulse flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Browser audio is currently muted by policy</p>
                <p className="text-xs text-amber-300/80">
                  Click 'Start Audio' to enable sound through stage speakers.
                </p>
              </div>
            </div>
            <button
              onClick={unlockAudio}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors shadow-lg cursor-pointer"
            >
              Start Audio
            </button>
          </div>
        )}

        {/* Error Notice Auto Skip */}
        {errorNotice && (
          <div className="mb-4 bg-red-950/80 border border-red-800 text-red-200 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between">
            <span>{errorNotice}</span>
            <button
              onClick={handleSkip}
              className="underline text-red-300 hover:text-white cursor-pointer ml-2"
            >
              Skip Now
            </button>
          </div>
        )}

        {/* Dynamic Equalizer Visualizer Component */}
        <div className="flex-1 flex items-center justify-center my-4 min-h-[300px]">
          <EqualizerVisualizer
            track={currentTrack}
            isPlaying={isPlaying}
          />
        </div>

        {/* Stage Soundbar Controls */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-4 sm:p-5 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-pink-500 hover:opacity-90 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <button
              onClick={handleSkip}
              className="w-10 h-10 rounded-2xl bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300 transition-all cursor-pointer"
              title="Skip to next song"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-neutral-800 mx-1 hidden sm:block"></div>

            {/* Volume Sliders */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-neutral-300" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20 sm:w-28 accent-orange-500 cursor-pointer"
                title={`Volume: ${volume}%`}
              />
              <span className="text-xs font-mono text-neutral-400 w-8">
                {isMuted ? '0%' : `${volume}%`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQueueSidebar(!showQueueSidebar)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-colors"
            >
              <ListMusic className="w-4 h-4 text-orange-400" />
              <span>Queue ({upcomingTracks.length})</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Up Next Queue Sidebar (Right Side) */}
      <div
        className={`w-full lg:w-96 bg-neutral-900/95 border-t lg:border-t-0 lg:border-l border-neutral-800/80 backdrop-blur-xl flex flex-col ${
          showQueueSidebar ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-orange-400" />
            <span className="font-bold text-sm text-neutral-200">Upcoming Auto-Queue</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-800 text-amber-300">
            {upcomingTracks.length} ready
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px] lg:max-h-none">
          {upcomingTracks.map((item, idx) => (
            <div
              key={item.id}
              className={`group border rounded-xl p-3 flex gap-3 items-center transition-all ${
                item.is_pinned
                  ? 'bg-amber-950/30 border-amber-500/50 shadow-sm'
                  : 'bg-neutral-950/80 hover:bg-neutral-800/80 border-neutral-800/80'
              }`}
            >
              <div className="w-6 text-center font-bold text-xs flex-shrink-0">
                {item.is_pinned ? (
                  <Crown className="w-4 h-4 text-amber-400 mx-auto" />
                ) : (
                  <span className="text-neutral-500">#{idx + 1}</span>
                )}
              </div>

              <div className="w-16 h-12 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 relative">
                <img
                  src={item.thumbnail_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-xs sm:text-sm text-neutral-200 group-hover:text-white truncate">
                    {item.title}
                  </p>
                  {item.is_pinned && (
                    <span className="text-[9px] font-bold bg-amber-500 text-black px-1.5 py-0.2 rounded-sm flex-shrink-0">
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1">
                  <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                    👍 {item.upvotes}
                  </span>
                  <span>•</span>
                  <span className="truncate">{item.requested_by}</span>
                  {item.is_master_list && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-900/60 text-blue-300 border border-blue-800">
                      Master
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {upcomingTracks.length === 0 && (
            <div className="text-center py-16 px-4 space-y-2">
              <Sparkles className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-medium text-neutral-400">Queue is empty</p>
              <p className="text-xs text-neutral-600">
                Pre-event songs or crowd requests will show up here in real time.
              </p>
            </div>
          )}
        </div>

        {/* Stage Operator Quick Tip */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800/80 text-xs text-neutral-400 flex items-center gap-2">
          <Tv className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span>Connected to stage speakers. Audio only — visual equalizer active.</span>
        </div>
      </div>
    </div>
  );
}
