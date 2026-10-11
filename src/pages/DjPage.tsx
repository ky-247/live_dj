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
  History 
} from 'lucide-react';
import { QueueItem, GlobalState, DjSettings } from '../types';
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
    settings: defaultSettings 
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [storedPin, setStoredPin] = useState<string>(DEFAULT_PIN);
  const [showPinChangeModal, setShowPinChangeModal] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');

  // DJ Settings State (local copy for tweaking before or during save)
  const [localSettings, setLocalSettings] = useState<DjSettings>(defaultSettings);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Announcement State
  const [announcementInput, setAnnouncementInput] = useState<string>('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState<boolean>(false);

  // Queue View Tab & Filter
  const [queueViewTab, setQueueViewTab] = useState<'pending' | 'played'>('pending');
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

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);

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

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
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
      setPinError('Incorrect PIN code. Please try again.');
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

  const handleLockDeck = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('desibeats_dj_auth');
    window.dispatchEvent(new Event('storage'));
    showToast('DJ Deck locked');
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.length >= 4) {
      setStoredPin(newPinInput);
      localStorage.setItem('desibeats_dj_pin', newPinInput);
      setShowPinChangeModal(false);
      setNewPinInput('');
      showToast('DJ PIN successfully updated!');
    }
  };

  const handleSkip = async (id: string) => {
    try {
      await fetch(`/api/queue/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'played' }),
      });
      showToast('Track skipped! Advancing to next track.');
    } catch {
      showToast('Error skipping track');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Remove "${title}" from the queue?`)) {
      try {
        await fetch(`/api/queue/${id}`, { method: 'DELETE' });
        showToast('Track removed from queue.');
      } catch {
        showToast('Error removing track');
      }
    }
  };

  const handleTogglePin = async (id: string, currentPinStatus?: boolean) => {
    try {
      const res = await fetch(`/api/queue/${id}/pin`, { method: 'POST' });
      if (res.ok) {
        showToast(currentPinStatus ? 'VIP Priority removed' : '⭐ Set to VIP Priority! Plays next on stage.');
      } else {
        showToast('Failed to update priority');
      }
    } catch {
      showToast('Error setting VIP priority');
    }
  };

  const toggleLock = async () => {
    try {
      const newLocked = !globalState.isLocked;
      await fetch('/api/admin/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: newLocked }),
      });
      showToast(newLocked ? 'Guest requests paused!' : 'Guest requests reopened!');
    } catch {
      showToast('Error updating lock status');
    }
  };

  const handleResetQueue = async () => {
    if (confirm('Reset queue back to initial Bollywood & Bhangra event tracks?')) {
      try {
        await fetch('/api/admin/reset', { method: 'POST' });
        showToast('Queue reset to fresh event playlist!');
      } catch {
        showToast('Error resetting queue');
      }
    }
  };

  const handleSaveSettings = async (overrideSettings?: Partial<DjSettings>) => {
    setIsSavingSettings(true);
    const payload = overrideSettings ? { ...localSettings, ...overrideSettings } : localSettings;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLocalSettings(updated);
        showToast('Anti-Spam & Queue rules live updated! 🛡️');
      } else {
        showToast('Failed to save settings');
      }
    } catch {
      showToast('Error connecting to server');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSendAnnouncement = async () => {
    setIsSendingAnnouncement(true);
    try {
      const res = await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: announcementInput }),
      });
      if (res.ok) {
        showToast(announcementInput.trim() ? '📢 Broadcast sent to Stage Screens & Guests!' : 'Announcement banner cleared');
      }
    } catch {
      showToast('Failed to broadcast announcement');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const handleClearAnnouncement = async () => {
    setAnnouncementInput('');
    try {
      await fetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: '' }),
      });
      showToast('Announcement ticker cleared');
    } catch {
      showToast('Failed to clear announcement');
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Clear song lockout history? (Allows previously played songs to be requested again immediately)')) {
      try {
        await fetch('/api/admin/history', { method: 'DELETE' });
        showToast('Lockout history cleared! All tracks eligible again.');
      } catch {
        showToast('Failed to clear history');
      }
    }
  };

  // If not authenticated, render the DJ PIN Security Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-sm bg-neutral-900/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6 text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 via-pink-500 to-amber-500 mx-auto flex items-center justify-center shadow-xl shadow-orange-500/25">
            <KeyRound className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-white">DJ Deck Access</h1>
            <p className="text-xs text-neutral-400">
              Enter your Passcode to unlock live moderation & anti-spam controls
            </p>
          </div>

          {/* PIN Input Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 h-12 bg-neutral-950 border border-neutral-800 rounded-2xl px-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    pinInput.length > i
                      ? 'bg-gradient-to-r from-orange-400 to-pink-500 scale-125 shadow-md shadow-orange-500/50'
                      : 'bg-neutral-800'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-xs font-semibold text-red-400 animate-shake">
                {pinError}
              </p>
            )}
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="h-13 bg-neutral-950 hover:bg-neutral-800/80 active:bg-neutral-700 text-white font-black text-lg rounded-2xl border border-neutral-800/80 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPinInput('')}
              className="h-13 bg-neutral-950/60 hover:bg-neutral-800 text-neutral-400 font-bold text-xs rounded-2xl border border-neutral-800 transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-13 bg-neutral-950 hover:bg-neutral-800/80 active:bg-neutral-700 text-white font-black text-lg rounded-2xl border border-neutral-800/80 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="h-13 bg-neutral-950/60 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center rounded-2xl border border-neutral-800 transition-all cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={pinInput.length === 0}
              className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-amber-500 hover:opacity-90 disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-orange-500/25 cursor-pointer text-sm"
            >
              Unlock DJ Console
            </button>
            <p className="text-[11px] text-neutral-500">
              Default Event Passcode: <span className="font-mono text-neutral-300 font-bold">1234</span>
            </p>
          </form>
        </div>
      </div>
    );
  }

  const playingTrack = queue.find((q) => q.status === 'playing');

  // Sorted upcoming tracks: Pinned tracks first, then guest requests by upvotes, then master list
  const pendingQueue = queue
    .filter((q) => q.status === 'pending')
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_master_list === b.is_master_list) return b.upvotes - a.upvotes;
      return a.is_master_list ? 1 : -1;
    });

  const playedHistory = queue.filter((q) => q.status === 'played');

  // Filtered queue items
  const filteredQueue = (queueViewTab === 'pending' ? pendingQueue : playedHistory).filter((item) => {
    if (!filterSearch.trim()) return true;
    const s = filterSearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(s) ||
      item.requested_by.toLowerCase().includes(s) ||
      (item.dedication_note && item.dedication_note.toLowerCase().includes(s))
    );
  });

  const totalUpvotes = queue.reduce((sum, item) => sum + item.upvotes, 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100 p-3 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* DJ Header & Top Actions */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-neutral-900/90 border border-neutral-800 p-5 sm:p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">DJ Moderation Console</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Live Deck ✓
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                Role-based moderation, live anti-spam sliders, VIP queue pinning & stage announcements
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
                showSettingsPanel 
                  ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' 
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{showSettingsPanel ? 'Hide Settings' : 'Anti-Spam Settings'}</span>
            </button>

            <button
              onClick={() => setShowPinChangeModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors border border-neutral-700 cursor-pointer"
              title="Change DJ Passcode"
            >
              <Key className="w-3.5 h-3.5 text-neutral-400" />
              <span>PIN</span>
            </button>

            <button
              onClick={handleResetQueue}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors border border-neutral-700 cursor-pointer"
              title="Reset queue to demo Bollywood & Bhangra party songs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Reset Tracks</span>
            </button>

            <button
              onClick={toggleLock}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-lg cursor-pointer ${
                globalState.isLocked
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25'
              }`}
            >
              {globalState.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{globalState.isLocked ? 'Requests Paused' : 'Accepting Requests'}</span>
            </button>

            <button
              onClick={handleLockDeck}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-neutral-800 hover:bg-red-950/80 hover:text-red-300 text-neutral-400 text-xs font-bold transition-colors border border-neutral-700 cursor-pointer"
              title="Lock DJ Deck session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </header>

        {/* Toast status */}
        {statusMsg && (
          <div className="p-3 bg-neutral-900 border border-orange-500/40 text-orange-300 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-orange-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Live Stage Announcement Broadcast Ticker Bar */}
        <div className="bg-gradient-to-r from-purple-950/60 via-neutral-900 to-pink-950/60 border border-purple-800/50 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-pink-400 animate-pulse" />
              <h2 className="text-xs sm:text-sm font-bold text-pink-300 uppercase tracking-wider">
                DJ Live Stage Announcement Ticker
              </h2>
            </div>
            <span className="text-[11px] text-neutral-400">
              Broadcasts instantly to Stage TV, Player, and Guest Mobile phones
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Cake cutting in 5 minutes! 🎂 • Send in your Bhangra requests now! 🔥"
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendAnnouncement()}
              className="flex-1 bg-neutral-950/80 border border-neutral-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={handleSendAnnouncement}
              disabled={isSendingAnnouncement}
              className="px-4 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-pink-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast</span>
            </button>
            {globalState.announcement && (
              <button
                onClick={handleClearAnnouncement}
                className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                title="Clear stage ticker"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Queue & Anti-Spam Controls Settings Panel */}
        {showSettingsPanel && (
          <section className="bg-neutral-900/95 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-orange-400" />
                <div>
                  <h2 className="text-base font-bold text-white">Queue & Anti-Spam Controls</h2>
                  <p className="text-xs text-neutral-400">
                    Fine-tune guest request limits, duplicate lockouts, and stage filters in real time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveSettings()}
                  disabled={isSavingSettings}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'Saving...' : 'Apply Rules'}</span>
                </button>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Guest Cooldown Slider */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Request Cooldown</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    {Math.floor(localSettings.guestCooldownSeconds / 60)}m {localSettings.guestCooldownSeconds % 60}s
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="600"
                  step="30"
                  value={localSettings.guestCooldownSeconds}
                  onChange={(e) => setLocalSettings({ ...localSettings, guestCooldownSeconds: Number(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>30s (Rapid)</span>
                  <div className="flex gap-1.5">
                    {[60, 180, 300].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, guestCooldownSeconds: sec })}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          localSettings.guestCooldownSeconds === sec
                            ? 'bg-orange-500 text-white font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sec / 60}m
                      </button>
                    ))}
                  </div>
                  <span>10m (Slow)</span>
                </div>
              </div>

              {/* 2. Duplicate Lockout Window */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-pink-400" />
                    <span>Duplicate Song Lockout</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-md">
                    {localSettings.duplicateLockoutMinutes} mins
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={localSettings.duplicateLockoutMinutes}
                  onChange={(e) => setLocalSettings({ ...localSettings, duplicateLockoutMinutes: Number(e.target.value) })}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>5 mins</span>
                  <div className="flex gap-1.5">
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLocalSettings({ ...localSettings, duplicateLockoutMinutes: m })}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          localSettings.duplicateLockoutMinutes === m
                            ? 'bg-pink-500 text-white font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <span>120 mins</span>
                </div>
              </div>

              {/* 3. Max Queue Capacity */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Max Queue Capacity</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                    {localSettings.maxQueueCapacity} songs
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={localSettings.maxQueueCapacity}
                  onChange={(e) => setLocalSettings({ ...localSettings, maxQueueCapacity: Number(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>5 songs</span>
                  <span className="text-neutral-400">Current: {pendingQueue.length}/{localSettings.maxQueueCapacity}</span>
                  <span>50 songs</span>
                </div>
              </div>

              {/* 4. Max Active Requests per Guest */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300">Max Active Songs per Guest</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {localSettings.maxRequestsPerGuest} songs
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={localSettings.maxRequestsPerGuest}
                  onChange={(e) => setLocalSettings({ ...localSettings, maxRequestsPerGuest: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>1 song max</span>
                  <span>Prevents one guest dominating</span>
                  <span>10 songs max</span>
                </div>
              </div>

              {/* 5. Max Upvotes per Guest */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300">Max Upvotes per Guest</span>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                    {localSettings.maxUpvotesPerGuest} votes
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="50"
                  step="1"
                  value={localSettings.maxUpvotesPerGuest}
                  onChange={(e) => setLocalSettings({ ...localSettings, maxUpvotesPerGuest: Number(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>3 votes</span>
                  <span>Prevents ballot stuffing</span>
                  <span>50 votes</span>
                </div>
              </div>

              {/* 6. Vibe Genre Filter */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-neutral-300 block">Event Vibe Tag Filter</span>
                <select
                  value={localSettings.vibeTagFilter || 'all'}
                  onChange={(e) => setLocalSettings({ ...localSettings, vibeTagFilter: e.target.value })}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="all">All Genres Allowed (Open Format)</option>
                  <option value="bhangra">High-Energy Punjabi Bhangra Only</option>
                  <option value="bollywood">Bollywood Dance Anthems</option>
                  <option value="romantic">Couple Romantic & Sangeet Hits</option>
                  <option value="south">South Indian / Tollywood Beats</option>
                </select>
                <p className="text-[10px] text-neutral-500">
                  Highlights and guides suggestions for current event phase
                </p>
              </div>
            </div>

            {/* Toggles Row */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Profanity Filter Toggle */}
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, profanityFilterEnabled: !localSettings.profanityFilterEnabled })}
                className={`p-3.5 rounded-2xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${
                  localSettings.profanityFilterEnabled
                    ? 'bg-emerald-950/40 border-emerald-800 text-white'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-neutral-200">Profanity Auto-Censor</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Sanitizes English & Hindi vulgarities in dedications</div>
                </div>
                <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${localSettings.profanityFilterEnabled ? 'bg-emerald-500' : 'bg-neutral-800'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${localSettings.profanityFilterEnabled ? 'translate-x-3.5' : ''}`} />
                </div>
              </button>

              {/* Auto Cleanup Played Tracks Toggle */}
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, autoCleanupPlayed: !localSettings.autoCleanupPlayed })}
                className={`p-3.5 rounded-2xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${
                  localSettings.autoCleanupPlayed
                    ? 'bg-cyan-950/40 border-cyan-800 text-white'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-neutral-200">Auto-Purge Played Songs</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Removes finished tracks to keep queue compact</div>
                </div>
                <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${localSettings.autoCleanupPlayed ? 'bg-cyan-500' : 'bg-neutral-800'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${localSettings.autoCleanupPlayed ? 'translate-x-3.5' : ''}`} />
                </div>
              </button>

              {/* Peak Time Fast Mode */}
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, peakTimeFastMode: !localSettings.peakTimeFastMode })}
                className={`p-3.5 rounded-2xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${
                  localSettings.peakTimeFastMode
                    ? 'bg-amber-950/40 border-amber-800 text-white'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-neutral-200 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Peak Time Rush Mode</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Rapid turnaround for peak dancefloor frenzy</div>
                </div>
                <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${localSettings.peakTimeFastMode ? 'bg-amber-500' : 'bg-neutral-800'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${localSettings.peakTimeFastMode ? 'translate-x-3.5' : ''}`} />
                </div>
              </button>
            </div>

            {/* Quick Actions Footer inside Settings */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/80 text-xs">
              <button
                onClick={handleClearHistory}
                className="text-neutral-400 hover:text-pink-300 underline underline-offset-4 cursor-pointer"
              >
                Reset Duplicate Lockout History ({playedHistory.length} songs recorded)
              </button>
              <div className="text-neutral-500">
                Rule updates apply instantaneously across active client connections
              </div>
            </div>
          </section>
        )}

        {/* 2-Column Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Now Playing & Event Telemetry (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Now Playing Card */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-orange-400" />
                  <span>Now Playing On Stage</span>
                </h2>
                {playingTrack && (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              {playingTrack ? (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                    <img
                      src={playingTrack.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-3">
                      <span className="text-[10px] font-mono font-bold bg-black/70 px-2 py-0.5 rounded text-amber-300">
                        👍 {playingTrack.upvotes} Votes
                      </span>
                      {playingTrack.is_pinned && (
                        <span className="text-[10px] font-bold bg-amber-500 text-black px-2 py-0.5 rounded-md flex items-center gap-1 shadow">
                          <Crown className="w-3 h-3 fill-black" />
                          <span>VIP Pinned</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm sm:text-base line-clamp-2 text-white">
                      {playingTrack.title}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Req by: <strong className="text-neutral-200">{playingTrack.requested_by}</strong>
                    </p>
                    {playingTrack.dedication_note && (
                      <p className="text-xs text-pink-300 italic mt-1 line-clamp-2">
                        "{playingTrack.dedication_note}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSkip(playingTrack.id)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-95 text-white py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Skip Current Track</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-10 text-neutral-500 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 space-y-2">
                  <Radio className="w-8 h-8 text-neutral-700 mx-auto" />
                  <p className="text-xs font-semibold">No track actively playing</p>
                  <p className="text-[11px] text-neutral-600 max-w-xs mx-auto">
                    Open /player page on your stage laptop or click play to start sound system output.
                  </p>
                </div>
              )}
            </div>

            {/* Event Metrics */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Live Event Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800">
                  <span className="text-[11px] text-neutral-500 block">Pending Queue</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-amber-400">{pendingQueue.length}</span>
                    <span className="text-xs text-neutral-500">/ {localSettings.maxQueueCapacity}</span>
                  </div>
                </div>
                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800">
                  <span className="text-[11px] text-neutral-500 block">Songs Played</span>
                  <span className="text-2xl font-black text-emerald-400 block mt-0.5">{playedHistory.length}</span>
                </div>
                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800">
                  <span className="text-[11px] text-neutral-500 block">Total Upvotes</span>
                  <span className="text-2xl font-black text-pink-400 block mt-0.5">{totalUpvotes}</span>
                </div>
                <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800">
                  <span className="text-[11px] text-neutral-500 block">Duplicate Window</span>
                  <span className="text-2xl font-black text-cyan-400 block mt-0.5">{localSettings.duplicateLockoutMinutes}m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Moderation Queue List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Queue List Header & Filter Controls */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-2xl border border-neutral-800">
                  <button
                    onClick={() => setQueueViewTab('pending')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      queueViewTab === 'pending'
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Upcoming Queue ({pendingQueue.length})
                  </button>
                  <button
                    onClick={() => setQueueViewTab('played')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      queueViewTab === 'played'
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Played History ({playedHistory.length})
                  </button>
                </div>

                {/* Search Queue */}
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search song or guest..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Moderated List */}
              <div className="space-y-2.5">
                {filteredQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`border rounded-2xl p-3.5 flex gap-3.5 items-center transition-all ${
                      item.is_pinned
                        ? 'bg-amber-950/25 border-amber-500/50 shadow-md shadow-amber-500/10'
                        : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {/* Rank / VIP Badge */}
                    <div className="w-7 text-center font-black text-xs flex-shrink-0">
                      {item.is_pinned ? (
                        <Crown className="w-4 h-4 text-amber-400 mx-auto" />
                      ) : (
                        <span className="text-neutral-500">#{idx + 1}</span>
                      )}
                    </div>

                    <img
                      src={item.thumbnail_url}
                      alt=""
                      className="w-16 h-12 object-cover rounded-xl flex-shrink-0 bg-neutral-900"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-neutral-100 truncate">{item.title}</p>
                        {item.is_pinned && (
                          <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded">
                            VIP
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 flex-wrap">
                        <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                          👍 {item.upvotes}
                        </span>
                        <span>•</span>
                        <span className="text-neutral-300 truncate">{item.requested_by}</span>
                        {item.is_master_list && (
                          <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.2 rounded border border-blue-800">
                            Master Playlist
                          </span>
                        )}
                        {item.status === 'played' && item.played_at && (
                          <span className="text-[10px] text-neutral-500">
                            Played {new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {item.dedication_note && (
                        <p className="text-xs text-pink-300 italic truncate mt-1">
                          "{item.dedication_note}"
                        </p>
                      )}
                    </div>

                    {/* Action Buttons for Pending songs */}
                    {queueViewTab === 'pending' && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* VIP Pin Button */}
                        <button
                          onClick={() => handleTogglePin(item.id, item.is_pinned)}
                          className={`p-2 rounded-xl transition-all cursor-pointer ${
                            item.is_pinned
                              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                              : 'text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10'
                          }`}
                          title={item.is_pinned ? 'Unpin VIP priority' : 'Pin to play immediately next!'}
                        >
                          <Crown className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(item.id, item.title)}
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                          title="Remove track from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {filteredQueue.length === 0 && (
                  <div className="text-center py-16 text-neutral-500 bg-neutral-950/40 border border-neutral-800/80 border-dashed rounded-3xl space-y-2">
                    <Music className="w-8 h-8 mx-auto text-neutral-600" />
                    <p className="font-semibold text-sm">
                      {queueViewTab === 'pending' ? 'No pending tracks found' : 'No played tracks recorded yet'}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {queueViewTab === 'pending'
                        ? 'Click "Reset Tracks" above or invite guests via /request QR code!'
                        : 'Tracks will appear here once played.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change PIN Modal */}
      {showPinChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-orange-500" />
              <span>Change DJ Passcode</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Set a new PIN code for this event session.
            </p>
            <form onSubmit={handleSaveNewPin} className="space-y-4">
              <input
                type="password"
                maxLength={6}
                placeholder="Enter new 4-digit PIN"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 px-4 text-center font-mono text-lg tracking-widest text-white focus:outline-none focus:border-orange-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinChangeModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newPinInput.length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
