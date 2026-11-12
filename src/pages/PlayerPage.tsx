import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Radio,
  Lock, 
  Delete, 
  ShieldCheck,
  Headphones,
  Check,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { QueueItem, GlobalState } from '../types';
import { socket } from '../lib/socket';
import { sortQueue } from '../lib/queue';
import { useCrossfadePlayer } from '../hooks/useCrossfadePlayer';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function PlayerPage() {
  const [djToken, setDjToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('desibeats_dj_token');
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!djToken);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ 
    isLocked: false, 
    nowPlayingTrackId: null, 
    settings: {} as any 
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem('desibeats_dj_token');
    setDjToken(null);
    setIsAuthenticated(false);
    setPinError('Session expired. Please re-enter DJ PIN.');
  }, []);

  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    autoplayBlocked,
    skipInfoLabel,
    switchNoticeLabel,
    errorNotice,
    togglePlayPause,
    handleSkip,
    handleVolumeChange,
    toggleMute,
    unlockAudio,
    advanceTrack,
    playTrack,
    renderPlayers,
    currentTime,
    duration,
    seekTo,
  } = useCrossfadePlayer({
    token: djToken,
    onUnauthorized: handleUnauthorized,
    queue,
  });

  // Check stored DJ token on mount
  useEffect(() => {
    try {
      const token = sessionStorage.getItem('desibeats_dj_token');
      if (token) {
        setDjToken(token);
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  // Shared socket listeners
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
      .then(setQueue)
      .catch((err) => console.error(err));

    fetch('/api/state')
      .then((res) => res.json())
      .then(setGlobalState)
      .catch((err) => console.error(err));

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
    };
  }, []);

  // Start initial track if authenticated and nothing is playing
  useEffect(() => {
    if (isAuthenticated && djToken && !currentTrack && queue.length > 0) {
      const alreadyPlaying = queue.find(q => q.status === 'playing');
      if (alreadyPlaying) {
        playTrack(alreadyPlaying);
      } else {
        advanceTrack();
      }
    }
  }, [isAuthenticated, djToken, currentTrack, queue, advanceTrack, playTrack]);

  // Server-side PIN verification
  const verifyPinOnServer = async (pin: string) => {
    setIsVerifying(true);
    setPinError(null);
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem('desibeats_dj_token', data.token);
        setDjToken(data.token);
        setIsAuthenticated(true);
        setPinError(null);
        setPinInput('');
        window.dispatchEvent(new Event('storage'));
      } else {
        setPinError(data.error || 'Incorrect DJ Passcode');
        setPinInput('');
      }
    } catch {
      setPinError('Connection error verifying PIN');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) return;
    verifyPinOnServer(pinInput.trim());
  };

  const handleKeypadPress = (val: string) => {
    if (pinInput.length < 6) {
      const next = pinInput + val;
      setPinInput(next);
      setPinError(null);
      if (next.length >= 4) {
        verifyPinOnServer(next);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(null);
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

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    seekTo(newSec);
  };

  // Up next pending queue items sorted by centralized sortQueue
  const upcomingTracks = sortQueue(queue, true);

  // AUTHENTICATION REQUIRED MODAL
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#191c18] text-[#efefdf] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#22251f] border border-[#44493e] rounded-md p-6 sm:p-8 text-center space-y-6">
          <div className="w-12 h-12 mx-auto rounded-sm bg-[#191c18] border border-[#44493e] flex items-center justify-center text-[#dfed66]">
            <Lock className="w-5 h-5" />
          </div>

          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-[#aeb3a5]">
              BROADCAST DECK LOCKOUT
            </div>
            <h2 className="text-xl font-bold text-[#efefdf] mt-1 tracking-tight">
              Player Authentication Required
            </h2>
            <p className="text-xs text-[#aeb3a5] mt-1.5 leading-relaxed">
              Enter the DJ passcode to unlock stage audio output and crossfade stream.
            </p>
          </div>

          {pinError && (
            <div className="p-2.5 bg-[#2a1b1b] border border-[#7a3030] rounded-sm text-xs text-[#fca5a5] font-mono text-left flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#fca5a5]" />
              <span>{pinError}</span>
            </div>
          )}

          {/* Indicator Dots */}
          <div className="flex justify-center gap-2.5 py-1">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full border transition-all ${
                  pinInput.length > idx
                    ? 'bg-[#dfed66] border-[#dfed66]'
                    : 'border-[#44493e] bg-[#191c18]'
                }`}
              />
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isVerifying}
                onClick={() => handleKeypadPress(num)}
                className="h-12 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] text-base font-mono font-bold text-[#efefdf] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
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
              className="h-12 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#aeb3a5] text-xs font-mono text-[#aeb3a5] transition-all flex items-center justify-center cursor-pointer"
            >
              CLR
            </button>
            <button
              type="button"
              disabled={isVerifying}
              onClick={() => handleKeypadPress('0')}
              className="h-12 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] text-base font-mono font-bold text-[#efefdf] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="h-12 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#aeb3a5] text-[#aeb3a5] transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Fallback Form */}
          <form onSubmit={handlePinSubmit} className="space-y-3 pt-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pinInput}
              disabled={isVerifying}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-[#191c18] border border-[#44493e] rounded-sm py-2 px-3 text-center text-sm font-mono tracking-widest text-[#efefdf] focus:outline-none focus:border-[#dfed66]"
            />
            <button
              type="submit"
              disabled={isVerifying || pinInput.length === 0}
              className="w-full py-2.5 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
            >
              {isVerifying ? 'Verifying...' : 'Unlock Audio Player'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#aeb3a5]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#dfed66]" />
            <span>Server-side authorization enforced</span>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div
      ref={containerRef}
      className="min-h-[calc(100vh-3.5rem)] bg-[#191c18] text-[#efefdf] flex flex-col lg:flex-row relative overflow-hidden"
    >
      {/* Hidden authoritative YouTube dual players */}
      {renderPlayers()}

      {/* Main Player & Monitor Deck (Left / Center) */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
        {/* Top Status Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#44493e]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#22251f] border border-[#44493e] rounded-sm px-2.5 py-1 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-[#dfed66]' : 'bg-[#aeb3a5]'}`} />
              <span className="text-[#efefdf] font-bold uppercase tracking-wider">
                {isPlaying ? 'ON AIR' : 'PAUSED'}
              </span>
            </div>
            <span className="font-mono text-xs text-[#aeb3a5] hidden sm:inline">
              MASTER AUDIO BROADCAST • 2S CROSSFADE
            </span>
          </div>

          <div className="flex items-center gap-2">
            {switchNoticeLabel && (
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#dfed66] text-[#191c18] font-bold animate-pulse">
                {switchNoticeLabel}
              </span>
            )}
            {skipInfoLabel && (
              <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#22251f] border border-[#dfed66]/50 text-[#dfed66]">
                {skipInfoLabel}
              </span>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-sm bg-[#22251f] border border-[#44493e] hover:border-[#dfed66] text-[#aeb3a5] hover:text-[#efefdf] transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Browser Autoplay Block Notice */}
        {autoplayBlocked && (
          <div className="bg-[#22251f] border border-[#dfed66] rounded-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-sm bg-[#191c18] border border-[#dfed66] flex items-center justify-center text-[#dfed66] shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#efefdf]">Browser audio playback suspended</p>
                <p className="text-xs text-[#aeb3a5]">
                  Click unlock to resume audio routing to the sound system.
                </p>
              </div>
            </div>
            <button
              onClick={unlockAudio}
              className="w-full sm:w-auto px-4 py-2 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Unlock Audio Output
            </button>
          </div>
        )}

        {/* Error / Unplayable Notice */}
        {errorNotice && (
          <div className="bg-[#2a1b1b] border border-[#7a3030] rounded-sm p-3 flex items-center justify-between gap-3 text-xs text-[#fca5a5] font-mono">
            <span>{errorNotice}</span>
            <button
              onClick={handleSkip}
              className="underline text-[#efefdf] hover:text-[#dfed66] cursor-pointer ml-2"
            >
              Skip Track
            </button>
          </div>
        )}

        {/* Prominent Current Track & Real Media Screen */}
        <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full space-y-6 my-2">
          {currentTrack ? (
            <div className="space-y-6">
              {/* Media Display Area */}
              <div className="relative aspect-video max-h-[380px] w-full rounded-sm bg-[#22251f] border border-[#44493e] overflow-hidden flex items-center justify-center">
                <img
                  src={currentTrack.thumbnail_url}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-[#191c18]/40" />

                {/* Overlay Status Bar */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs font-mono">
                  <span className="px-2 py-0.5 bg-[#191c18]/90 border border-[#44493e] text-[#efefdf] rounded-sm">
                    {currentTrack.is_pinned ? 'VIP PRIORITY' : currentTrack.is_master_list ? 'SETLIST FALLBACK' : 'GUEST REQUEST'}
                  </span>
                  <span className="px-2 py-0.5 bg-[#191c18]/90 border border-[#44493e] text-[#dfed66] rounded-sm">
                    ▲ {currentTrack.upvotes} VOTES
                  </span>
                </div>

                {/* Center Audio Indicator */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 rounded-sm bg-[#191c18]/90 border border-[#44493e] flex items-center justify-center text-[#dfed66] mb-3">
                    <Radio className="w-7 h-7" />
                  </div>
                  <div className="font-mono text-xs text-[#aeb3a5] uppercase tracking-wider">
                    {isPlaying ? 'STREAM ACTIVE' : 'PAUSED'}
                  </div>
                </div>
              </div>

              {/* Track Metadata */}
              <div className="space-y-2 text-left">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#aeb3a5]">
                  <span>REQUESTED BY</span>
                  <span className="text-[#efefdf] font-bold">
                    {currentTrack.requested_by || 'Guest'}
                  </span>
                  <span>•</span>
                  <span>SOURCE</span>
                  <span className="text-[#efefdf] font-bold truncate max-w-xs">
                    {currentTrack.channel_title}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#efefdf] leading-tight">
                  {currentTrack.title}
                </h1>
              </div>

              {/* Progress & Duration Scrubber */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between font-mono text-xs text-[#aeb3a5]">
                  <span className="text-[#dfed66]">{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="relative w-full h-2 bg-[#22251f] rounded-sm border border-[#44493e] overflow-hidden">
                  <div
                    className="h-full bg-[#dfed66] transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeekChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Seek playback position"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-sm bg-[#22251f] border border-[#44493e] p-12 text-center space-y-3">
              <Radio className="w-10 h-10 mx-auto text-[#aeb3a5]" />
              <h2 className="text-lg font-bold text-[#efefdf]">No Track Currently Playing</h2>
              <p className="text-xs text-[#aeb3a5] max-w-sm mx-auto">
                The stage player is standing by. When songs are submitted by guests or queued in the booth, they will begin streaming automatically.
              </p>
              {upcomingTracks.length > 0 ? (
                <button
                  onClick={() => advanceTrack()}
                  className="mt-2 px-4 py-2 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Start First Track
                </button>
              ) : queue.filter(q => q.status === 'played').length > 0 ? (
                <button
                  onClick={async () => {
                    const res = await fetch('/api/queue/restart-playlist', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${djToken || ''}`,
                        'Content-Type': 'application/json',
                      },
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.currentTrack) {
                        playTrack(data.currentTrack);
                      }
                    }
                  }}
                  className="mt-2 px-4 py-2 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Restart Playlist ({queue.filter(q => q.status === 'played').length} Songs from History)
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Master Transport & Volume Bar */}
        <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              disabled={!currentTrack}
              className="w-11 h-11 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] flex items-center justify-center font-bold transition-colors cursor-pointer disabled:opacity-40"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleSkip}
              disabled={!currentTrack}
              className="h-11 px-3.5 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] text-[#efefdf] flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
              title="Skip to next track (2s crossfade)"
            >
              <SkipForward className="w-4 h-4" />
              <span className="hidden sm:inline">Skip (Crossfade)</span>
            </button>

            <button
              onClick={async () => {
                if (!window.confirm('Reset the entire queue back to master list? All pending guest requests will be removed.')) {
                  return;
                }
                try {
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (djToken) headers['Authorization'] = `Bearer ${djToken}`;
                  const res = await fetch('/api/admin/reset', { method: 'POST', headers });
                  if (res.ok) {
                    const qRes = await fetch('/api/queue');
                    if (qRes.ok) setQueue(await qRes.json());
                  }
                } catch {}
              }}
              className="h-11 px-3.5 rounded-sm bg-[#191c18] border border-[#7a3030] text-[#fca5a5] hover:bg-[#2a1b1b] flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
              title="Reset Queue"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className="text-[#aeb3a5] hover:text-[#efefdf] transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-[#fca5a5]" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-24 sm:w-32 accent-[#dfed66] cursor-pointer"
              title={`Volume: ${isMuted ? 0 : volume}%`}
            />
            <span className="font-mono text-xs text-[#aeb3a5] w-9 text-right">
              {isMuted ? '0%' : `${volume}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Upcoming Setlist Panel (Right Side) */}
      <div className="w-full lg:w-96 bg-[#22251f] border-t lg:border-t-0 lg:border-l border-[#44493e] flex flex-col">
        <div className="p-4 border-b border-[#44493e] flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-wider text-[#efefdf] font-bold">
            RUNNING ORDER
          </div>
          <span className="font-mono text-xs text-[#aeb3a5]">
            {upcomingTracks.length} QUEUED
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[420px] lg:max-h-none">
          {upcomingTracks.map((item, idx) => (
            <div
              key={item.id}
              className={`p-3 rounded-sm border transition-colors flex items-center gap-3 ${
                item.is_pinned
                  ? 'bg-[#191c18] border-[#dfed66]/60'
                  : 'bg-[#191c18] border-[#44493e]'
              }`}
            >
              <div className="font-mono text-xs text-[#aeb3a5] w-6 shrink-0 text-center">
                {item.is_pinned ? (
                  <span className="text-[#dfed66] font-bold">VIP</span>
                ) : (
                  `#${(idx + 1).toString().padStart(2, '0')}`
                )}
              </div>

              <div className="w-12 h-9 rounded-sm overflow-hidden bg-[#22251f] border border-[#44493e] shrink-0">
                <img
                  src={item.thumbnail_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#efefdf] truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#aeb3a5] mt-0.5">
                  <span className="text-[#dfed66]">▲ {item.upvotes}</span>
                  <span>•</span>
                  <span className="truncate">{item.requested_by || 'Guest'}</span>
                </div>
              </div>
            </div>
          ))}

          {upcomingTracks.length === 0 && (
            <div className="py-12 text-center text-[#aeb3a5] font-mono text-xs space-y-1">
              <p>QUEUE IS EMPTY</p>
              <p className="text-[11px]">Guest requests will appear here in real time.</p>
            </div>
          )}
        </div>

        <div className="p-3 bg-[#191c18] border-t border-[#44493e] font-mono text-[11px] text-[#aeb3a5] flex items-center justify-between">
          <span>SERVER-ORDERED QUEUE</span>
          <span className="text-[#dfed66]">SORTQUEUE ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
