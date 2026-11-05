import { useState, useEffect, useCallback } from 'react';
import { 
  Lock, 
  Trash2, 
  Pin, 
  Play, 
  RotateCcw, 
  Sliders, 
  CheckCircle2, 
  Radio, 
  Search, 
  Megaphone,
  X,
  ShieldCheck,
  Trophy,
  AlertCircle,
  Undo2,
  Volume2,
  KeyRound,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { QueueItem, GlobalState, DjSettings, PartyContributor } from '../types';
import { socket } from '../lib/socket';
import { sortQueue } from '../lib/queue';

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
  fallbackSkipSeconds: 10,
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return !!sessionStorage.getItem('desibeats_dj_token');
    } catch {
      return false;
    }
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [showPinChangeModal, setShowPinChangeModal] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');

  // DJ Settings State (starts closed)
  const [localSettings, setLocalSettings] = useState<DjSettings>(defaultSettings);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Secondary Tools Drawer (Announcements, SFX, Awards, Reset)
  const [showSecondaryTools, setShowSecondaryTools] = useState<boolean>(false);

  // Announcement State
  const [announcementInput, setAnnouncementInput] = useState<string>('');
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState<boolean>(false);

  // Queue View Tab & Filter
  const [queueViewTab, setQueueViewTab] = useState<'pending' | 'played' | 'contributors'>('pending');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Undo support
  const [lastDeletedTrack, setLastDeletedTrack] = useState<QueueItem | null>(null);
  const [undoTimeoutId, setUndoTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Check session token on mount
  useEffect(() => {
    try {
      const token = sessionStorage.getItem('desibeats_dj_token');
      if (token) {
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  // Authorized DJ fetch helper
  const djFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = sessionStorage.getItem('desibeats_dj_token') || '';
    const headers = {
      ...((options.headers as Record<string, string>) || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      sessionStorage.removeItem('desibeats_dj_token');
      setIsAuthenticated(false);
      setPinError('Session expired. Please re-enter DJ PIN.');
      window.dispatchEvent(new Event('storage'));
    }
    return res;
  }, []);

  // Shared Socket event listeners
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

  const verifyPin = async (pin: string) => {
    setIsVerifyingPin(true);
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
        setIsAuthenticated(true);
        setPinError(null);
        setPinInput('');
        window.dispatchEvent(new Event('storage'));
      } else {
        setPinError(data.error || 'Incorrect DJ Passcode');
        setPinInput('');
      }
    } catch {
      setPinError('Connection error verifying DJ PIN');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) return;
    verifyPin(pinInput.trim());
  };

  const handleKeypadPress = (val: string) => {
    if (pinInput.length < 6) {
      const next = pinInput + val;
      setPinInput(next);
      setPinError(null);
      if (next.length >= 4) {
        verifyPin(next);
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('desibeats_dj_token');
    window.dispatchEvent(new Event('storage'));
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinInput || newPinInput.trim().length < 4) {
      showToast('PIN must be at least 4 digits');
      return;
    }
    const cleanPin = newPinInput.trim();
    try {
      const res = await djFetch('/api/admin/change-pin', {
        method: 'POST',
        body: JSON.stringify({ newPin: cleanPin }),
      });
      if (res.ok) {
        setShowPinChangeModal(false);
        setNewPinInput('');
        showToast('DJ PIN successfully updated on server');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update PIN');
      }
    } catch {
      showToast('Error changing PIN');
    }
  };

  const toggleLock = async () => {
    try {
      const res = await djFetch('/api/admin/lock', {
        method: 'POST',
        body: JSON.stringify({ isLocked: !globalState.isLocked }),
      });
      const data = await res.json();
      setGlobalState((prev) => ({ ...prev, isLocked: data.isLocked }));
      showToast(data.isLocked ? 'Guest requests LOCKED' : 'Guest requests UNLOCKED');
    } catch {
      showToast('Failed to toggle lock status');
    }
  };

  const toggleMvpReveal = async () => {
    try {
      const nextState = !globalState.mvpRevealActive;
      const res = await djFetch('/api/admin/mvp-reveal', {
        method: 'POST',
        body: JSON.stringify({ active: nextState }),
      });
      if (res.ok) {
        setGlobalState((prev) => ({ ...prev, mvpRevealActive: nextState }));
        showToast(nextState ? 'MVP Award Ceremony REVEALED on TV and Guest Phones' : 'MVP Ceremony closed');
      }
    } catch {
      showToast('Failed to toggle MVP reveal');
    }
  };

  const handleResetQueue = async () => {
    if (!window.confirm('Reset the entire queue back to master list? All pending guest requests will be removed.')) {
      return;
    }
    try {
      const res = await djFetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        showToast('Queue successfully reset');
      }
    } catch {
      showToast('Failed to reset queue');
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await djFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ settings: localSettings }),
      });
      if (res.ok) {
        showToast('Queue & Anti-Spam settings saved');
      } else {
        showToast('Failed to save settings');
      }
    } catch {
      showToast('Network error saving settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleBroadcastAnnouncement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSendingAnnouncement(true);
    try {
      const res = await djFetch('/api/admin/announcement', {
        method: 'POST',
        body: JSON.stringify({ announcement: announcementInput }),
      });
      if (res.ok) {
        showToast(announcementInput ? 'Stage announcement broadcasted' : 'Announcement cleared');
      }
    } catch {
      showToast('Failed to broadcast announcement');
    } finally {
      setIsSendingAnnouncement(false);
    }
  };

  const handlePlayNow = async (track: QueueItem) => {
    try {
      await djFetch(`/api/queue/${track.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'playing' }),
      });
      showToast(`Now playing: ${track.title}`);
    } catch {
      showToast('Failed to set track as playing');
    }
  };

  const handleDelete = async (trackId: string) => {
    const itemToDelete = queue.find((q) => q.id === trackId);
    try {
      await djFetch(`/api/queue/${trackId}`, { method: 'DELETE' });
      if (itemToDelete) {
        setLastDeletedTrack(itemToDelete);
        if (undoTimeoutId) clearTimeout(undoTimeoutId);
        const tid = setTimeout(() => setLastDeletedTrack(null), 10000);
        setUndoTimeoutId(tid);
      }
      showToast('Track removed from queue');
    } catch {
      showToast('Failed to delete track');
    }
  };

  const handleUndoDelete = async () => {
    if (!lastDeletedTrack) return;
    try {
      const res = await djFetch('/api/queue/restore', {
        method: 'POST',
        body: JSON.stringify({ track: lastDeletedTrack }),
      });
      if (res.ok) {
        showToast(`Restored: ${lastDeletedTrack.title}`);
        setLastDeletedTrack(null);
        if (undoTimeoutId) clearTimeout(undoTimeoutId);
      }
    } catch {
      showToast('Failed to undo deletion');
    }
  };

  const handleTogglePin = async (trackId: string) => {
    try {
      const res = await djFetch(`/api/queue/${trackId}/pin`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        showToast(updated.is_pinned ? 'VIP Pin: Track will play next' : 'Track unpinned');
      }
    } catch {
      showToast('Failed to toggle pin');
    }
  };

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
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'drop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(550, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
      showToast(`SFX: ${type.toUpperCase()}`);
    } catch {
      showToast('Audio SFX error');
    }
  };

  // Sorted queue items
  const nowPlaying = queue.find((q) => q.status === 'playing') || null;
  const pendingTracks = sortQueue(queue, true);
  const upNext = pendingTracks[0] || null;

  // Filtered view items
  const rawFiltered = queue
    .filter((q) => {
      if (queueViewTab === 'pending') return q.status === 'pending';
      if (queueViewTab === 'played') return q.status === 'played';
      return true;
    })
    .filter((q) => {
      if (!filterSearch) return true;
      const s = filterSearch.toLowerCase();
      return (
        q.title.toLowerCase().includes(s) ||
        q.requested_by.toLowerCase().includes(s) ||
        q.channel_title.toLowerCase().includes(s)
      );
    });

  const displayedQueue = queueViewTab === 'pending' ? sortQueue(rawFiltered) : rawFiltered;

  // PIN PROTECTION MODAL OVERLAY
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#191c18] text-[#efefdf] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#22251f] border border-[#44493e] rounded-sm p-6 sm:p-8 text-center space-y-6">
          <div className="w-12 h-12 mx-auto rounded-sm bg-[#191c18] border border-[#44493e] flex items-center justify-center text-[#dfed66]">
            <KeyRound className="w-5 h-5" />
          </div>

          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-[#aeb3a5]">
              STATION OPERATOR ACCESS
            </div>
            <h2 className="text-xl font-bold text-[#efefdf] mt-1 tracking-tight">
              DJ Booth Moderation Deck
            </h2>
            <p className="text-xs text-[#aeb3a5] mt-1.5 leading-relaxed">
              Enter the DJ security PIN to access live moderation, anti-spam rules, and queue prioritization.
            </p>
          </div>

          {pinError && (
            <div className="p-2.5 bg-[#2a1b1b] border border-[#7a3030] rounded-sm text-xs text-[#fca5a5] font-mono text-left flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#fca5a5]" />
              <span>{pinError}</span>
            </div>
          )}

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

          <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isVerifyingPin}
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
              disabled={isVerifyingPin}
              onClick={() => handleKeypadPress('0')}
              className="h-12 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] text-base font-mono font-bold text-[#efefdf] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPinInput((prev) => prev.slice(0, -1))}
              className="h-12 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#aeb3a5] text-[#aeb3a5] transition-all flex items-center justify-center cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3 pt-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pinInput}
              disabled={isVerifyingPin}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full bg-[#191c18] border border-[#44493e] rounded-sm py-2 px-3 text-center text-sm font-mono tracking-widest text-[#efefdf] focus:outline-none focus:border-[#dfed66]"
            />
            <button
              type="submit"
              disabled={isVerifyingPin || pinInput.length === 0}
              className="w-full py-2.5 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
            >
              {isVerifyingPin ? 'Verifying...' : 'Unlock DJ Booth'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#aeb3a5]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#dfed66]" />
            <span>Rate-limited server verification</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#191c18] text-[#efefdf] p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Undo Toast Notification */}
      {lastDeletedTrack && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#22251f] border border-[#dfed66] text-[#efefdf] p-3 rounded-sm shadow-xl flex items-center gap-3">
          <div className="font-mono text-xs">
            <span>Deleted: </span>
            <span className="font-bold truncate max-w-[200px] inline-block align-bottom">{lastDeletedTrack.title}</span>
          </div>
          <button
            onClick={handleUndoDelete}
            className="px-3 py-1 bg-[#dfed66] text-[#191c18] hover:bg-[#d2e057] rounded-sm font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* Status Toast */}
      {statusMsg && !lastDeletedTrack && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#22251f] border border-[#44493e] text-[#efefdf] px-3.5 py-2 rounded-sm shadow-xl flex items-center gap-2 font-mono text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#dfed66]" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#44493e]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[#dfed66]">
              DESIBEATS LIVE
            </span>
            <span className="text-[#44493e]">•</span>
            <span className="font-mono text-xs text-[#aeb3a5]">
              BOOTH CONTROL
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#efefdf] mt-0.5">
            DJ Running Order & Booth
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lock / Unlock Requests */}
          <button
            onClick={toggleLock}
            className={`px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              globalState.isLocked
                ? 'bg-[#2a1b1b] border-[#7a3030] text-[#fca5a5]'
                : 'bg-[#191c18] border-[#44493e] text-[#dfed66] hover:border-[#dfed66]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{globalState.isLocked ? 'Requests Paused' : 'Requests Open'}</span>
          </button>

          {/* Secondary Controls Toggle */}
          <button
            onClick={() => setShowSecondaryTools(!showSecondaryTools)}
            className="px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider bg-[#22251f] border border-[#44493e] hover:border-[#dfed66] text-[#efefdf] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Console Tools</span>
            {showSecondaryTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Settings Panel Toggle */}
          <button
            onClick={() => setShowSettingsPanel(!showSettingsPanel)}
            className="px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider bg-[#22251f] border border-[#44493e] hover:border-[#dfed66] text-[#efefdf] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showSettingsPanel ? 'Close Rules' : 'Queue Rules'}</span>
          </button>

          {/* Logout Lock */}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider bg-[#191c18] border border-[#44493e] hover:border-[#7a3030] text-[#aeb3a5] hover:text-[#fca5a5] transition-colors cursor-pointer"
          >
            Lock Deck
          </button>
        </div>
      </div>

      {/* SECONDARY CONTROLS PANEL (Announcement, SFX, Awards, PIN, Reset) */}
      {showSecondaryTools && (
        <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-4 space-y-4">
          <div className="font-mono text-xs uppercase tracking-wider text-[#aeb3a5] border-b border-[#44493e] pb-2">
            SECONDARY STATION OPERATOR CONTROLS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Live Announcement */}
            <div className="md:col-span-6 space-y-2">
              <label className="font-mono text-xs text-[#aeb3a5] block">
                STAGE TICKER ANNOUNCEMENT
              </label>
              <form onSubmit={handleBroadcastAnnouncement} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Next up: 15 minutes of Punjabi Bhangra!"
                  value={announcementInput}
                  onChange={(e) => setAnnouncementInput(e.target.value)}
                  className="flex-1 bg-[#191c18] border border-[#44493e] rounded-sm px-3 py-1.5 text-xs text-[#efefdf] placeholder-[#aeb3a5]/50 focus:outline-none focus:border-[#dfed66]"
                />
                <button
                  type="submit"
                  disabled={isSendingAnnouncement}
                  className="px-3 py-1.5 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                >
                  {isSendingAnnouncement ? 'Sending...' : 'Broadcast'}
                </button>
                {globalState.announcement && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnnouncementInput('');
                      djFetch('/api/admin/announcement', {
                        method: 'POST',
                        body: JSON.stringify({ announcement: '' }),
                      }).then(() => showToast('Announcement cleared'));
                    }}
                    className="p-1.5 rounded-sm bg-[#191c18] border border-[#44493e] text-[#aeb3a5] hover:text-[#efefdf]"
                    title="Clear Announcement"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>

            {/* Soundboard SFX */}
            <div className="md:col-span-3 space-y-2">
              <label className="font-mono text-xs text-[#aeb3a5] block">
                STAGE SOUNDBOARD
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => playSoundEffect('airhorn')}
                  className="py-1.5 px-2 bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] rounded-sm font-mono text-xs text-[#efefdf] text-center transition-colors cursor-pointer"
                >
                  AIRHORN
                </button>
                <button
                  onClick={() => playSoundEffect('drop')}
                  className="py-1.5 px-2 bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] rounded-sm font-mono text-xs text-[#efefdf] text-center transition-colors cursor-pointer"
                >
                  DROP
                </button>
                <button
                  onClick={() => playSoundEffect('cheer')}
                  className="py-1.5 px-2 bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] rounded-sm font-mono text-xs text-[#efefdf] text-center transition-colors cursor-pointer"
                >
                  CHEER
                </button>
              </div>
            </div>

            {/* Quick Actions (Awards, PIN, Reset) */}
            <div className="md:col-span-3 space-y-2">
              <label className="font-mono text-xs text-[#aeb3a5] block">
                ADMIN UTILITIES
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleMvpReveal}
                  className={`px-2.5 py-1.5 rounded-sm font-mono text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                    globalState.mvpRevealActive
                      ? 'bg-[#dfed66] text-[#191c18] border-[#dfed66]'
                      : 'bg-[#191c18] border-[#44493e] text-[#efefdf] hover:border-[#dfed66]'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{globalState.mvpRevealActive ? 'MVP Active' : 'Reveal MVP'}</span>
                </button>

                <button
                  onClick={() => setShowPinChangeModal(true)}
                  className="px-2.5 py-1.5 rounded-sm font-mono text-xs bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] text-[#efefdf] transition-colors cursor-pointer"
                >
                  Change PIN
                </button>

                <button
                  onClick={handleResetQueue}
                  className="px-2.5 py-1.5 rounded-sm font-mono text-xs bg-[#191c18] border border-[#7a3030] text-[#fca5a5] hover:bg-[#2a1b1b] transition-colors cursor-pointer flex items-center gap-1"
                  title="Reset Queue"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PIN MODAL */}
      {showPinChangeModal && (
        <div className="fixed inset-0 z-50 bg-[#191c18]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#44493e] pb-2">
              <span className="font-mono text-xs uppercase tracking-wider text-[#efefdf] font-bold">
                Update DJ Passcode
              </span>
              <button
                onClick={() => setShowPinChangeModal(false)}
                className="text-[#aeb3a5] hover:text-[#efefdf]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleChangePin} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                placeholder="New 4-6 digit PIN"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                className="w-full bg-[#191c18] border border-[#44493e] rounded-sm p-2 text-center text-sm font-mono text-[#efefdf] tracking-widest focus:outline-none focus:border-[#dfed66]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinChangeModal(false)}
                  className="px-3 py-1.5 rounded-sm bg-[#191c18] border border-[#44493e] text-xs font-mono text-[#aeb3a5] hover:text-[#efefdf]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-sm bg-[#dfed66] text-[#191c18] hover:bg-[#d2e057] text-xs font-mono font-bold uppercase tracking-wider"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPANDABLE SETTINGS PANEL (Queue & Anti-Spam Constraints) */}
      {showSettingsPanel && (
        <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#44493e] pb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-[#efefdf] font-bold">
              Queue Rules & Anti-Spam Constraints
            </span>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-3.5 py-1.5 rounded-sm bg-[#dfed66] hover:bg-[#d2e057] text-[#191c18] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {isSavingSettings ? 'Saving...' : 'Save Rules'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Cooldown */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#aeb3a5]">Request Cooldown</span>
                <span className="text-[#dfed66] font-bold">{localSettings.guestCooldownSeconds}s</span>
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
                className="w-full accent-[#dfed66] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[#aeb3a5]">Cooldown period per guest device</p>
            </div>

            {/* Duplicate Lockout Window */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#aeb3a5]">Duplicate Lockout</span>
                <span className="text-[#dfed66] font-bold">{localSettings.duplicateLockoutMinutes}m</span>
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
                className="w-full accent-[#dfed66] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[#aeb3a5]">Replay lockout for played songs</p>
            </div>

            {/* Max Queue Capacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#aeb3a5]">Max Queue Capacity</span>
                <span className="text-[#dfed66] font-bold">{localSettings.maxQueueCapacity}</span>
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
                className="w-full accent-[#dfed66] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[#aeb3a5]">Max pending guest songs allowed</p>
            </div>

            {/* Max Requests Per Guest */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#aeb3a5]">Max Requests / Guest</span>
                <span className="text-[#dfed66] font-bold">{localSettings.maxRequestsPerGuest}</span>
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
                className="w-full accent-[#dfed66] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[#aeb3a5]">Concurrent pending tracks per guest</p>
            </div>

            {/* Max Upvotes */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#aeb3a5]">Max Upvotes / Guest</span>
                <span className="text-[#dfed66] font-bold">{localSettings.maxUpvotesPerGuest}</span>
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
                className="w-full accent-[#dfed66] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-[#aeb3a5]">Total votes allowed per guest device</p>
            </div>

            {/* Fallback Intro Skip Seconds */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#aeb3a5]">Fallback Intro Skip</span>
                <span className="text-[#dfed66] font-bold">{localSettings.fallbackSkipSeconds ?? 10}s</span>
              </div>
              <input
                type="number"
                min="0"
                max="60"
                value={localSettings.fallbackSkipSeconds ?? 10}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    fallbackSkipSeconds: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0))
                  })
                }
                className="w-full bg-[#191c18] border border-[#44493e] rounded-sm px-2.5 py-1 text-xs font-mono text-[#efefdf] focus:outline-none focus:border-[#dfed66]"
              />
              <p className="font-mono text-[11px] text-[#aeb3a5]">Skip first X seconds when no community data (0 disables)</p>
            </div>
          </div>
        </div>
      )}

      {/* NOW PLAYING & UP NEXT (Above Running-Order Table) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Now Playing Card */}
        <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-4 flex items-center gap-4">
          <div className="w-16 h-12 rounded-sm overflow-hidden bg-[#191c18] border border-[#44493e] shrink-0">
            {nowPlaying ? (
              <img
                src={nowPlaying.thumbnail_url}
                alt={nowPlaying.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#aeb3a5]">
                <Radio className="w-5 h-5" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[#dfed66] font-bold uppercase tracking-wider">
                ● NOW ON AIR
              </span>
              {nowPlaying?.is_pinned && (
                <span className="text-[#191c18] bg-[#dfed66] px-1.5 py-0.2 rounded-xs font-bold">
                  VIP
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[#efefdf] truncate mt-0.5">
              {nowPlaying?.title || 'No active track playing'}
            </p>
            <div className="flex items-center gap-2 font-mono text-xs text-[#aeb3a5] mt-0.5">
              <span>{nowPlaying ? `▲ ${nowPlaying.upvotes}` : '—'}</span>
              <span>•</span>
              <span className="truncate">{nowPlaying?.requested_by || 'Master catalog'}</span>
            </div>
          </div>
        </div>

        {/* Up Next Card */}
        <div className="bg-[#22251f] border border-[#44493e] rounded-sm p-4 flex items-center gap-4">
          <div className="w-16 h-12 rounded-sm overflow-hidden bg-[#191c18] border border-[#44493e] shrink-0">
            {upNext ? (
              <img
                src={upNext.thumbnail_url}
                alt={upNext.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#aeb3a5]">
                <Radio className="w-5 h-5" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[#aeb3a5] font-bold uppercase tracking-wider">
                UP NEXT (HIGHEST PRIORITY)
              </span>
              {upNext?.is_pinned && (
                <span className="text-[#191c18] bg-[#dfed66] px-1.5 py-0.2 rounded-xs font-bold">
                  VIP
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-[#efefdf] truncate mt-0.5">
              {upNext?.title || 'Queue is currently clear'}
            </p>
            <div className="flex items-center gap-2 font-mono text-xs text-[#aeb3a5] mt-0.5">
              <span>{upNext ? `▲ ${upNext.upvotes}` : '—'}</span>
              <span>•</span>
              <span className="truncate">{upNext?.requested_by || 'Master catalog'}</span>
            </div>
          </div>

          {upNext && (
            <button
              onClick={() => handlePlayNow(upNext)}
              className="px-2.5 py-1.5 rounded-sm bg-[#dfed66] text-[#191c18] hover:bg-[#d2e057] font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              title="Play this track now"
            >
              Play
            </button>
          )}
        </div>
      </div>

      {/* COMPACT RUNNING-ORDER TABLE SECTION */}
      <div className="bg-[#22251f] border border-[#44493e] rounded-sm space-y-0 overflow-hidden">
        {/* Table Controls Bar (Tabs & Search) */}
        <div className="p-3 border-b border-[#44493e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => setQueueViewTab('pending')}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                queueViewTab === 'pending'
                  ? 'bg-[#dfed66] text-[#191c18]'
                  : 'bg-[#191c18] border border-[#44493e] text-[#aeb3a5] hover:text-[#efefdf]'
              }`}
            >
              Running Order ({queue.filter((q) => q.status === 'pending').length})
            </button>
            <button
              onClick={() => setQueueViewTab('played')}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                queueViewTab === 'played'
                  ? 'bg-[#dfed66] text-[#191c18]'
                  : 'bg-[#191c18] border border-[#44493e] text-[#aeb3a5] hover:text-[#efefdf]'
              }`}
            >
              Played History ({queue.filter((q) => q.status === 'played').length})
            </button>
            <button
              onClick={() => setQueueViewTab('contributors')}
              className={`px-3 py-1.5 rounded-sm font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                queueViewTab === 'contributors'
                  ? 'bg-[#dfed66] text-[#191c18]'
                  : 'bg-[#191c18] border border-[#44493e] text-[#aeb3a5] hover:text-[#efefdf]'
              }`}
            >
              Contributors ({leaderboard.length})
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#aeb3a5]" />
            <input
              type="text"
              placeholder="Filter tracks or guests..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full bg-[#191c18] border border-[#44493e] rounded-sm pl-8 pr-3 py-1.5 font-mono text-xs text-[#efefdf] placeholder-[#aeb3a5]/50 focus:outline-none focus:border-[#dfed66]"
            />
          </div>
        </div>

        {/* Tab 1 & 2: Compact Running-Order Table */}
        {queueViewTab !== 'contributors' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="bg-[#191c18] border-b border-[#44493e] text-[#aeb3a5]">
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4">TRACK</th>
                  <th className="py-2.5 px-4 w-44">REQUESTED BY</th>
                  <th className="py-2.5 px-4 w-24 text-right">VOTES</th>
                  <th className="py-2.5 px-4 w-40 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#44493e]/60">
                {displayedQueue.map((track, idx) => (
                  <tr
                    key={track.id}
                    className={`hover:bg-[#191c18]/60 transition-colors ${
                      track.status === 'playing' ? 'bg-[#191c18]/80' : ''
                    }`}
                  >
                    {/* Index Column */}
                    <td className="py-2.5 px-4 text-center text-[#aeb3a5]">
                      {track.is_pinned ? (
                        <span className="text-[#dfed66] font-bold">VIP</span>
                      ) : (
                        (idx + 1).toString().padStart(2, '0')
                      )}
                    </td>

                    {/* Track Info */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={track.thumbnail_url}
                          alt={track.title}
                          className="w-10 h-7 object-cover rounded-xs border border-[#44493e] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-[#efefdf] truncate max-w-md">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#aeb3a5] truncate">
                            {track.channel_title}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Requester */}
                    <td className="py-2.5 px-4 text-[#efefdf] truncate">
                      {track.requested_by || 'Master catalog'}
                    </td>

                    {/* Votes */}
                    <td className="py-2.5 px-4 text-right font-bold text-[#dfed66]">
                      ▲ {track.upvotes}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {track.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleTogglePin(track.id)}
                              className={`p-1.5 rounded-sm border transition-colors cursor-pointer ${
                                track.is_pinned
                                  ? 'bg-[#dfed66] text-[#191c18] border-[#dfed66]'
                                  : 'bg-[#191c18] border-[#44493e] text-[#aeb3a5] hover:text-[#efefdf]'
                              }`}
                              title={track.is_pinned ? 'Unpin VIP Track' : 'Pin VIP (Plays Next)'}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handlePlayNow(track)}
                              className="px-2 py-1 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#dfed66] text-[#efefdf] hover:text-[#dfed66] text-xs font-bold uppercase transition-colors cursor-pointer"
                              title="Play Now"
                            >
                              Play
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDelete(track.id)}
                          className="p-1.5 rounded-sm bg-[#191c18] border border-[#44493e] hover:border-[#7a3030] text-[#aeb3a5] hover:text-[#fca5a5] transition-colors cursor-pointer"
                          title="Remove from queue (Undoable)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {displayedQueue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#aeb3a5]">
                      No songs in this view match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Tab 3: Party Contributors Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="bg-[#191c18] border-b border-[#44493e] text-[#aeb3a5]">
                  <th className="py-2.5 px-4 w-16 text-center">RANK</th>
                  <th className="py-2.5 px-4">CONTRIBUTOR</th>
                  <th className="py-2.5 px-4">TOP ANTHEM REQUESTED</th>
                  <th className="py-2.5 px-4 w-28 text-right">SONGS</th>
                  <th className="py-2.5 px-4 w-28 text-right">TOTAL VOTES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#44493e]/60">
                {leaderboard.map((contributor, idx) => (
                  <tr key={contributor.client_id} className="hover:bg-[#191c18]/60 transition-colors">
                    <td className="py-2.5 px-4 text-center font-bold text-[#aeb3a5]">
                      {idx === 0 ? '👑 #01' : `#${(idx + 1).toString().padStart(2, '0')}`}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-[#efefdf]">
                      {contributor.name}
                    </td>
                    <td className="py-2.5 px-4 text-[#aeb3a5] truncate max-w-sm">
                      {contributor.topTrackTitle || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#aeb3a5]">
                      {contributor.acceptedSongs}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#dfed66]">
                      ▲ {contributor.totalUpvotes}
                    </td>
                  </tr>
                ))}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#aeb3a5]">
                      No contributor points recorded yet tonight.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 bg-[#191c18] border-t border-[#44493e] font-mono text-[11px] text-[#aeb3a5] flex items-center justify-between">
          <span>CENTRALIZED QUEUE DISPATCH</span>
          <span className="text-[#dfed66]">PINNED PRIORITY • RANKED GUESTS • MASTER FALLBACK</span>
        </div>
      </div>
    </div>
  );
}
