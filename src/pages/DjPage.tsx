import { useState, useEffect } from 'react';
import { 
  Play, 
  SkipForward, 
  Trash2, 
  Lock, 
  Unlock, 
  Settings2, 
  Music, 
  RotateCcw, 
  Radio, 
  CheckCircle2, 
  KeyRound, 
  Delete, 
  LogOut, 
  SlidersHorizontal, 
  Key, 
  Flame, 
  Crown, 
  Megaphone, 
  Send, 
  X, 
  RefreshCw, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Layers, 
  Search, 
  History,
  Trophy,
  Award,
  Eye,
  EyeOff
} from 'lucide-react';
import { QueueItem, GlobalState, DjSettings, PartyContributor } from '../types';
import { socket } from '../lib/socket';

const DEFAULT_PIN = '1234';

const defaultSettings: DjSettings = {
  guestCooldownSeconds: 180,
  duplicateLockoutMinutes: 30,
  maxQueueCapacity: 20,
  maxRequestsPerGuest: 2,
  maxUpvotesPerGuest: 10,
  profanityFilterEnabled: true,
  autoCleanupPlayed: false,
  peakTimeFastMode: false,
  vibeTagFilter: 'all',
};

export function DjPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ 
    isLocked: false, 
    nowPlayingTrackId: null,
    announcement: null,
    mvpRevealActive: false,
    settings: defaultSettings 
  });
  const [leaderboard, setLeaderboard] = useState<PartyContributor[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [storedPin, setStoredPin] = useState<string>(DEFAULT_PIN);
  const [showPinChangeModal, setShowPinChangeModal] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');

  // DJ Settings State
  const [localSettings, setLocalSettings] = useState<DjSettings>(defaultSettings);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Announcement State
  const [announcementInput, setAnnouncementInput] = useState<string>('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState<boolean>(false);

  // Queue View Tab & Filter
  const [queueViewTab, setQueueViewTab] = useState<'pending' | 'played' | 'mvp'>('pending');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Load stored PIN & session authentication
  useEffect(() => {
    try {
      const savedPin = localStorage.getItem('desibeats_dj_pin');
      if (savedPin) {
        setStoredPin(savedPin);
      }
      const sessionAuth = sessionStorage.getItem('desibeats_dj_auth');
      if (sessionAuth === 'true') {
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.warn('Failed to read DJ auth state:', e);
    }
  }, []);

  // Shared Socket event listeners with clean unsubscription
  useEffect(() => {
    const handleQueueUpdated = (newQueue: QueueItem[]) => {
      setQueue(newQueue);
    };

    const handleStateUpdated = (newState: GlobalState) => {
      setGlobalState(newState);
      if (newState.settings) {
        setLocalSettings(newState.settings);
      }
      if (newState.announcement !== undefined) {
        setAnnouncementInput(newState.announcement || '');
      }
    };

    const handleLeaderboardUpdated = (newLeaderboard: PartyContributor[]) => {
      setLeaderboard(newLeaderboard);
    };

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);
    socket.on('leaderboard-updated', handleLeaderboardUpdated);

    fetch('/api/queue')
      .then((res) => res.json())
      .then(setQueue)
      .catch(() => {});

    fetch('/api/state')
      .then((res) => res.json())
      .then((data: GlobalState) => {
        setGlobalState(data);
        if (data.settings) {
          setLocalSettings(data.settings);
        }
        if (data.announcement) {
          setAnnouncementInput(data.announcement);
        }
      })
      .catch(() => {});

    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then(setLeaderboard)
      .catch(() => {});

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
      socket.off('leaderboard-updated', handleLeaderboardUpdated);
    };
  }, []);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3500);
  };

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
      setPinError('Incorrect PIN code. Default is 1234.');
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

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('desibeats_dj_auth');
    window.dispatchEvent(new Event('storage'));
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinInput || newPinInput.trim().length < 4) {
      showToast('PIN must be at least 4 digits');
      return;
    }
    const cleanPin = newPinInput.trim();
    setStoredPin(cleanPin);
    localStorage.setItem('desibeats_dj_pin', cleanPin);
    fetch('/api/admin/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPin: storedPin, newPin: cleanPin }),
    }).catch(() => {});
    setShowPinChangeModal(false);
    setNewPinInput('');
    showToast(`DJ PIN successfully changed to ${cleanPin}`);
  };

  // Toggle Lock/Unlock Guest Requests
  const toggleLock = async () => {
    try {
      const res = await fetch('/api/admin/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: !globalState.isLocked }),
      });
      const data = await res.json();
      setGlobalState((prev) => ({ ...prev, isLocked: data.isLocked }));
      showToast(data.isLocked ? 'Guest song requests LOCKED' : 'Guest song requests UNLOCKED');
    } catch {
      showToast('Failed to toggle lock status');
    }
  };

  // Toggle Top 3 Party MVP Reveal (Projector and Guest Phones)
  const toggleMvpReveal = async () => {
    try {
      const nextState = !globalState.mvpRevealActive;
      const res = await fetch('/api/admin/mvp-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: storedPin, active: nextState }),
      });
      if (res.ok) {
        setGlobalState((prev) => ({ ...prev, mvpRevealActive: nextState }));
        showToast(nextState ? '🏆 Party MVP Ceremony ACTIVATED on TV & Guest Screens!' : 'Party MVP Ceremony CLOSED');
      }
    } catch {
      showToast('Failed to toggle MVP reveal');
    }
  };

  // Reset Entire Queue
  const handleResetQueue = async () => {
    if (!window.confirm('Are you sure you want to reset the queue back to default? All pending guest requests will be cleared.')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        showToast('Queue reset to default successfully');
      }
    } catch {
      showToast('Failed to reset queue');
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: storedPin, settings: localSettings }),
      });
      if (res.ok) {
        showToast('DJ Anti-Spam & Queue Rules Saved!');
      } else {
        showToast('Failed to save settings');
      }
    } catch {
      showToast('Network error saving settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Send Stage Announcement
  const handleBroadcastAnnouncement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSendingAnnouncement(true);
    try {
      const res = await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: storedPin, announcement: announcementInput }),
      });
      if (res.ok) {
        showToast(announcementInput ? 'Stage Announcement Broadcasted!' : 'Announcement cleared');
      }
    } catch {
      showToast('Failed to broadcast announcement');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  // Track Actions: Play, Delete, VIP Pin
  const handlePlayNow = async (track: QueueItem) => {
    try {
      await fetch(`/api/queue/${track.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'playing' }),
      });
      showToast(`Now Playing: ${track.title}`);
    } catch {
      showToast('Failed to update status');
    }
  };

  const handleDelete = async (trackId: string) => {
    try {
      await fetch(`/api/queue/${trackId}`, { method: 'DELETE' });
      showToast('Track removed from queue');
    } catch {
      showToast('Failed to delete track');
    }
  };

  const handleTogglePin = async (trackId: string) => {
    try {
      const res = await fetch(`/api/queue/${trackId}/pin`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        showToast(updated.is_pinned ? 'VIP Pinned: Will play next!' : 'Unpinned track');
      }
    } catch {
      showToast('Failed to toggle VIP pin');
    }
  };

  // Soundboard Quick FX generator (Synthesized Web Audio airhorn / drops)
  const playSoundEffect = (type: 'airhorn' | 'drop' | 'cheer') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'airhorn') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'drop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, audioCtx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      } else {
        // High beep cheer
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
      showToast(`Triggered SFX: ${type.toUpperCase()}`);
    } catch (e) {
      console.warn('AudioContext SFX error:', e);
    }
  };

  // Filtered queue items
  const filteredQueue = queue
    .filter((q) => {
      if (queueViewTab === 'pending') return q.status === 'pending';
      if (queueViewTab === 'played') return q.status === 'played';
      return true;
    })
    .filter((q) => {
      if (!filterSearch.trim()) return true;
      const s = filterSearch.toLowerCase();
      return (
        q.title.toLowerCase().includes(s) ||
        q.requested_by.toLowerCase().includes(s) ||
        q.channel_title.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      if (queueViewTab === 'pending') {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.is_master_list === b.is_master_list) return b.upvotes - a.upvotes;
        return a.is_master_list ? 1 : -1;
      }
      return 0;
    });

  // PIN PROTECTION MODAL OVERLAY
  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 bg-gradient-to-b from-neutral-950 via-black to-neutral-950">
        <div className="w-full max-w-sm bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-pink-500 p-[2px] mx-auto shadow-lg shadow-orange-500/25">
            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">DJ Deck Authentication</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Enter the DJ Admin Passcode to unlock moderation controls and live queue management.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-mono font-bold transition-all ${
                    pinInput.length > idx
                      ? 'border-orange-500 bg-orange-500/10 text-white shadow-md shadow-orange-500/20'
                      : 'border-neutral-800 bg-neutral-950 text-neutral-600'
                  }`}
                >
                  {pinInput.length > idx ? '●' : ''}
                </div>
              ))}
            </div>

            {pinError && (
              <p className="text-xs text-red-400 font-semibold bg-red-950/40 border border-red-800/60 py-1.5 px-3 rounded-xl">
                {pinError}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (btn === 'C') setPinInput('');
                    else if (btn === '⌫') handleKeypadBackspace();
                    else handleKeypadPress(btn);
                  }}
                  className="h-12 rounded-xl bg-neutral-950 border border-neutral-800 text-lg font-bold text-neutral-200 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
                >
                  {btn}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={pinInput.length === 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-sm shadow-lg shadow-orange-500/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              Unlock DJ Console
            </button>
            <p className="text-[11px] text-neutral-500">Default PIN: 1234</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Toast Notification */}
      {statusMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-orange-500 text-orange-300 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-orange-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Top DJ Header with Action Buttons */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 bg-clip-text text-transparent">
              DJ Master Deck
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Authenticated
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Full Moderation, Anti-Spam Constraints, Leaderboard & Stage Control
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Top 3 Party MVP Ceremony Toggle */}
          <button
            onClick={toggleMvpReveal}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
              globalState.mvpRevealActive
                ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30'
                : 'bg-amber-950/40 text-amber-300 border-amber-600/40 hover:bg-amber-900/40'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>{globalState.mvpRevealActive ? 'MVP Ceremony ACTIVE' : 'Reveal Top 3 MVPs'}</span>
          </button>

          {/* Toggle Lock */}
          <button
            onClick={toggleLock}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
              globalState.isLocked
                ? 'bg-red-950/80 text-red-200 border-red-700 hover:bg-red-900'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
            }`}
          >
            {globalState.isLocked ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
            <span>{globalState.isLocked ? 'Unlock Requests' : 'Lock Requests'}</span>
          </button>

          {/* Reset Queue */}
          <button
            onClick={handleResetQueue}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-red-500 hover:text-red-400 transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Queue</span>
          </button>

          {/* Settings Panel Toggle */}
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              showSettingsPanel
                ? 'bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/20'
                : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
            title="Log out of DJ console"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK SOUNDBOARD FX & ANNOUNCEMENT BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* DJ Soundboard */}
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Instant Hype Soundboard
            </span>
            <span className="text-[10px] text-neutral-500">Live Stage Audio</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => playSoundEffect('airhorn')}
              className="py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-orange-500 hover:bg-orange-500/10 text-xs font-bold text-orange-300 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              🎺 Airhorn
            </button>
            <button
              onClick={() => playSoundEffect('drop')}
              className="py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-pink-500 hover:bg-pink-500/10 text-xs font-bold text-pink-300 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              💣 Bass Drop
            </button>
            <button
              onClick={() => playSoundEffect('cheer')}
              className="py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500 hover:bg-emerald-500/10 text-xs font-bold text-emerald-300 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              🎉 Crowd Hype
            </button>
          </div>
        </div>

        {/* Stage Live Announcement Ticker */}
        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
          <form onSubmit={handleBroadcastAnnouncement} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Megaphone className="w-4 h-4 text-orange-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="Broadcast a live announcement to TV and guest phones..."
                value={announcementInput}
                onChange={(e) => setAnnouncementInput(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSendingAnnouncement}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-xs hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Broadcast</span>
              </button>
              {globalState.announcement && (
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementInput('');
                    fetch('/api/admin/announcement', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pin: storedPin, announcement: '' }),
                    }).then(() => showToast('Announcement removed'));
                  }}
                  className="px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white text-xs"
                  title="Clear Announcement"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* OPTIONAL EXPANDABLE SETTINGS PANEL */}
      {showSettingsPanel && (
        <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                Queue & Anti-Spam Constraints
              </h2>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all"
            >
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Cooldown Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-300">Request Cooldown (per guest)</span>
                <span className="font-bold text-orange-400">{localSettings.guestCooldownSeconds}s</span>
              </div>
              <input
                type="range"
                min="30"
                max="600"
                step="30"
                value={localSettings.guestCooldownSeconds}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, guestCooldownSeconds: parseInt(e.target.value, 10) })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">Time guests must wait between requests</p>
            </div>

            {/* Duplicate Lockout Window */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-300">Duplicate Lockout Window</span>
                <span className="font-bold text-orange-400">{localSettings.duplicateLockoutMinutes} mins</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={localSettings.duplicateLockoutMinutes}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, duplicateLockoutMinutes: parseInt(e.target.value, 10) })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">Prevents same song being replayed too soon</p>
            </div>

            {/* Max Queue Capacity */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-300">Max Queue Capacity</span>
                <span className="font-bold text-orange-400">{localSettings.maxQueueCapacity} songs</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={localSettings.maxQueueCapacity}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, maxQueueCapacity: parseInt(e.target.value, 10) })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">Max pending crowd songs allowed in queue</p>
            </div>

            {/* Max Requests Per Guest */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-300">Max Pending per Guest</span>
                <span className="font-bold text-orange-400">{localSettings.maxRequestsPerGuest} songs</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={localSettings.maxRequestsPerGuest}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, maxRequestsPerGuest: parseInt(e.target.value, 10) })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">Limits one guest from monopolizing queue</p>
            </div>

            {/* Max Upvotes per Device */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-300">Max Upvotes per Guest</span>
                <span className="font-bold text-orange-400">{localSettings.maxUpvotesPerGuest}</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={localSettings.maxUpvotesPerGuest}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, maxUpvotesPerGuest: parseInt(e.target.value, 10) })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">Total upvotes a guest device can cast tonight</p>
            </div>

            {/* Toggles */}
            <div className="flex flex-col justify-center space-y-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={localSettings.profanityFilterEnabled}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, profanityFilterEnabled: e.target.checked })
                  }
                  className="rounded bg-neutral-900 border-neutral-700 text-orange-500 focus:ring-0"
                />
                <span className="font-medium text-neutral-300">Profanity & Slur Filter Enabled</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={localSettings.autoCleanupPlayed}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, autoCleanupPlayed: e.target.checked })
                  }
                  className="rounded bg-neutral-900 border-neutral-700 text-orange-500 focus:ring-0"
                />
                <span className="font-medium text-neutral-300">Auto-Remove Songs Once Played</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* MAIN QUEUE & LIVE LEADERBOARD SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 8 COLS: QUEUE MANAGEMENT */}
        <div className="lg:col-span-8 bg-neutral-950 border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setQueueViewTab('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  queueViewTab === 'pending'
                    ? 'bg-orange-500 text-white'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                Pending Queue ({queue.filter((q) => q.status === 'pending').length})
              </button>
              <button
                onClick={() => setQueueViewTab('played')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  queueViewTab === 'played'
                    ? 'bg-orange-500 text-white'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                Played History ({queue.filter((q) => q.status === 'played').length})
              </button>
            </div>

            {/* Filter Search */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter songs or guest..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* List of Tracks */}
          <div className="space-y-2.5">
            {filteredQueue.length > 0 ? (
              filteredQueue.map((track) => (
                <div
                  key={track.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    track.status === 'playing'
                      ? 'bg-orange-500/10 border-orange-500 shadow-md shadow-orange-500/10'
                      : track.is_pinned
                      ? 'bg-amber-950/20 border-amber-600/50'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={track.thumbnail_url}
                      alt={track.title}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-neutral-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-white truncate">
                          {track.title}
                        </p>
                        {track.is_pinned && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            VIP
                          </span>
                        )}
                        {track.is_master_list && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Master
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        Requested by: <strong className="text-neutral-200">{track.requested_by}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Actions & Upvotes */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="px-2.5 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-orange-400 text-xs font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{track.upvotes}</span>
                    </div>

                    {track.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleTogglePin(track.id)}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                            track.is_pinned
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-amber-400'
                          }`}
                          title="Pin VIP (Plays next)"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handlePlayNow(track)}
                          className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Play</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(track.id)}
                      className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-red-400 hover:border-red-500/40 transition-all"
                      title="Delete Track"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-neutral-500 text-xs font-medium">
                No songs match the current filter.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 4 COLS: LIVE PARTY LEADERBOARD (Always visible to DJ) */}
        <div className="lg:col-span-4 bg-neutral-950 border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  DJ Crowd MVP Radar
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">
              Tracks guests with the most upvotes. When the party peaks, hit <strong>"Reveal Top 3 MVPs"</strong> to trigger the ceremony!
            </p>

            <div className="mt-4 space-y-2.5">
              {leaderboard.length > 0 ? (
                leaderboard.map((contributor, idx) => (
                  <div
                    key={contributor.client_id}
                    className={`p-3 rounded-2xl border transition-all ${
                      idx === 0
                        ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                        : idx === 1
                        ? 'bg-slate-900/40 border-slate-700 text-slate-200'
                        : idx === 2
                        ? 'bg-amber-900/20 border-amber-800/40 text-amber-300'
                        : 'bg-neutral-900/40 border-neutral-800/60 text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-xs w-4">
                          {idx === 0 ? '👑' : `#${idx + 1}`}
                        </span>
                        <span className="font-bold text-xs truncate text-white">
                          {contributor.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-xs text-orange-400">
                        <Flame className="w-3.5 h-3.5" />
                        <span>{contributor.totalUpvotes} pts</span>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-400 truncate pl-6">
                      Top Anthem: "{contributor.topTrackTitle}" ({contributor.topTrackUpvotes} upvotes)
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  Leaderboard activates as guests submit and upvote songs!
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <button
              onClick={toggleMvpReveal}
              className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                globalState.mvpRevealActive
                  ? 'bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/25'
                  : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:opacity-90'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>{globalState.mvpRevealActive ? 'Close TV MVP Ceremony' : 'Launch Party MVP Awards on TV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
