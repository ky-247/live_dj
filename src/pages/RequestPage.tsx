import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Send, 
  Link as LinkIcon, 
  Music, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Flame, 
  Volume2, 
  Clock, 
  Crown, 
  Megaphone,
  RefreshCw,
  Trophy,
  X,
  ListMusic,
  ChevronRight,
  TrendingUp,
  User,
  Info
} from 'lucide-react';
import { QueueItem, GlobalState, PartyContributor } from '../types';
import { socket, getOrCreateClientId } from '../lib/socket';

export function RequestPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ 
    isLocked: false, 
    nowPlayingTrackId: null, 
    mvpRevealActive: false,
    settings: {} as any 
  });
  const [leaderboard, setLeaderboard] = useState<PartyContributor[]>([]);
  const [activeTab, setActiveTab] = useState<'request' | 'queue' | 'leaderboard'>('request');
  
  // Input & search fields
  const [inputQuery, setInputQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<{
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
  } | null>(null);

  const [requestedBy, setRequestedBy] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Client persistence & anti-spam state
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [promptUrlPaste, setPromptUrlPaste] = useState(false);

  // Pull-to-refresh mobile gesture
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Emoji reactions sent by user
  const [reactionFeedback, setReactionFeedback] = useState<string | null>(null);

  // Client ID for personal track tracking
  const [myClientId, setMyClientId] = useState<string>('');

  // Popular Quick-Pick Suggestions for Indian parties in Germany
  const quickSuggestions = [
    { title: 'Tauba Tauba', query: 'Tauba Tauba' },
    { title: 'Kala Chashma', query: 'Kala Chashma' },
    { title: 'Chaleya', query: 'Chaleya' },
    { title: 'Mundian To Bach Ke', query: 'Mundian To Bach Ke' },
    { title: 'Jhoome Jo Pathaan', query: 'Jhoome Jo Pathaan' },
    { title: 'Brown Munde', query: 'Brown Munde' }
  ];

  // Helper trigger for mobile haptic feedback
  const triggerHaptic = (pattern: number | number[] = 25) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore vibration error on unsupported mobile browsers
    }
  };

  // Initialize client ID, saved name, and stored upvotes
  useEffect(() => {
    const cid = getOrCreateClientId();
    setMyClientId(cid);

    try {
      const storedName = localStorage.getItem('desibeats_guest_name');
      if (storedName) {
        setRequestedBy(storedName);
      }
      const storedUpvotes = localStorage.getItem('desibeats_upvoted_ids');
      if (storedUpvotes) {
        const parsed = JSON.parse(storedUpvotes);
        if (Array.isArray(parsed)) {
          setUpvotedIds(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn('Failed to load stored localStorage data:', e);
    }

    // Cooldown check interval
    const updateCooldown = () => {
      const cooldownMs = (globalState.settings?.guestCooldownSeconds || 180) * 1000;
      const lastRequest = localStorage.getItem('desibeats_last_request_time');
      if (lastRequest) {
        const elapsed = Date.now() - parseInt(lastRequest, 10);
        const remaining = Math.max(0, cooldownMs - elapsed);
        setCooldownRemainingMs(remaining);
      } else {
        setCooldownRemainingMs(0);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [globalState.settings?.guestCooldownSeconds]);

  // Shared Socket connection
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

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);
    socket.on('leaderboard-updated', handleLeaderboardUpdated);

    fetch('/api/queue').then((res) => res.json()).then(setQueue).catch(() => {});
    fetch('/api/state').then((res) => res.json()).then(setGlobalState).catch(() => {});
    fetch('/api/leaderboard').then((res) => res.json()).then(setLeaderboard).catch(() => {});

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
      socket.off('leaderboard-updated', handleLeaderboardUpdated);
    };
  }, []);

  // Clear feedback message after 4s
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Mobile pull-down-to-refresh touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY !== null && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - pullStartY;
      if (diff > 0) {
        setPullDistance(Math.min(80, diff * 0.4));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 45) {
      triggerHaptic([30, 20, 30]);
      setIsRefreshing(true);
      try {
        const [qRes, sRes, lRes] = await Promise.all([
          fetch('/api/queue'),
          fetch('/api/state'),
          fetch('/api/leaderboard')
        ]);
        if (qRes.ok) setQueue(await qRes.json());
        if (sRes.ok) setGlobalState(await sRes.json());
        if (lRes.ok) setLeaderboard(await lRes.json());
      } catch {
        // Fallback
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setPullStartY(null);
        }, 350);
      }
    } else {
      setPullDistance(0);
      setPullStartY(null);
    }
  };

  const isUrl = (text: string) => {
    return /youtube\.com|youtu\.be|music\.youtube\.com/i.test(text.trim());
  };

  const formatCooldown = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
  };

  const handleSearchOrResolve = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const query = (directText || inputQuery).trim();
    if (!query) return;

    setIsProcessing(true);
    setFeedbackMsg(null);

    // If it's a YouTube / YouTube Music URL
    if (isUrl(query)) {
      try {
        const res = await fetch('/api/resolve-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();

        if (res.ok && data.videoId) {
          setSelectedTrack({
            videoId: data.videoId,
            title: data.title,
            channelTitle: data.channelTitle,
            thumbnailUrl: data.thumbnailUrl,
          });
          setSearchResults([]);
          setPromptUrlPaste(false);
        } else {
          setFeedbackMsg({ type: 'error', text: data.error || 'Could not resolve YouTube link.' });
        }
      } catch {
        setFeedbackMsg({ type: 'error', text: 'Network error resolving link.' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 3-Tiered Search
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
        setPromptUrlPaste(!!data.promptUrlPaste);
      } else {
        setSearchResults([]);
        setPromptUrlPaste(true);
        setFeedbackMsg({
          type: 'error',
          text: 'No tracks found. Paste the exact YouTube link for instant queuing!',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Search failed. Please paste the direct YouTube URL.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectTrack = (item: any) => {
    triggerHaptic(20);
    setSelectedTrack({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    });
    setSearchResults([]);
    setInputQuery('');
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrack) return;

    if (globalState.isLocked) {
      setFeedbackMsg({ type: 'error', text: 'Song requests are temporarily paused by the DJ!' });
      triggerHaptic([50, 50, 50]);
      return;
    }

    if (cooldownRemainingMs > 0) {
      setFeedbackMsg({
        type: 'error',
        text: `Please wait ${formatCooldown(cooldownRemainingMs)} before submitting another request!`,
      });
      triggerHaptic([50, 50, 50]);
      return;
    }

    setIsProcessing(true);
    setFeedbackMsg(null);

    const guestName = requestedBy.trim() || 'Desi Guest';

    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': myClientId,
        },
        body: JSON.stringify({
          youtube_id: selectedTrack.videoId,
          title: selectedTrack.title,
          channel_title: selectedTrack.channelTitle,
          thumbnail_url: selectedTrack.thumbnailUrl,
          requested_by: guestName,
          client_id: myClientId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to submit song request.' });
        triggerHaptic([60, 40, 60]);
      } else {
        triggerHaptic([40, 40, 60]);
        // Save guest name
        try {
          localStorage.setItem('desibeats_guest_name', guestName);
          localStorage.setItem('desibeats_last_request_time', Date.now().toString());
        } catch {}

        if (data.alreadyExisted) {
          setFeedbackMsg({
            type: 'success',
            text: `"${selectedTrack.title}" is already in line — upvoted to push it higher! 🔥`,
          });
        } else {
          setFeedbackMsg({
            type: 'success',
            text: `Added "${selectedTrack.title}" to the live queue! Ask friends to upvote it! 💃`,
          });
        }

        // Auto-record upvote in local state
        const updatedUpvotes = new Set(upvotedIds);
        updatedUpvotes.add(data.id);
        setUpvotedIds(updatedUpvotes);
        try {
          localStorage.setItem('desibeats_upvoted_ids', JSON.stringify(Array.from(updatedUpvotes)));
        } catch {}

        setSelectedTrack(null);
        setInputQuery('');
        setActiveTab('queue');
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network connection failed. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpvote = async (trackId: string, trackTitle: string) => {
    if (upvotedIds.has(trackId)) {
      setFeedbackMsg({ type: 'error', text: 'You have already upvoted this song!' });
      triggerHaptic(40);
      return;
    }

    triggerHaptic([25, 15, 30]);

    try {
      const res = await fetch(`/api/queue/${trackId}/upvote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': myClientId,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to upvote track.' });
      } else {
        const nextSet = new Set(upvotedIds);
        nextSet.add(trackId);
        setUpvotedIds(nextSet);
        try {
          localStorage.setItem('desibeats_upvoted_ids', JSON.stringify(Array.from(nextSet)));
        } catch {}

        setFeedbackMsg({
          type: 'success',
          text: `Upvoted "${trackTitle}"! 🔥`,
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error upvoting track.' });
    }
  };

  // Send real-time emoji reaction to stage TV display
  const sendEmojiReaction = (emoji: string) => {
    triggerHaptic(20);
    socket.emit('send-reaction', {
      emoji,
      sender: requestedBy.trim() || 'Guest'
    });
    setReactionFeedback(`Sent ${emoji} to stage!`);
    setTimeout(() => setReactionFeedback(null), 1800);
  };

  // Find user's pending request for the pinned "Where is My Song?" tracker
  const myPendingTracks = queue.filter(
    (q) => q.status === 'pending' && q.client_id && q.client_id === myClientId
  );
  
  // Sorted queue items (pinned VIP first, then highest upvotes, then master list)
  const sortedPendingQueue = queue
    .filter((q) => q.status === 'pending')
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_master_list === b.is_master_list) return b.upvotes - a.upvotes;
      return a.is_master_list ? 1 : -1;
    });

  const currentlyPlaying = queue.find((q) => q.status === 'playing');
  const myTotalUpvotesEarned = queue
    .filter((q) => q.client_id === myClientId)
    .reduce((sum, q) => sum + q.upvotes, 0);

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-black text-neutral-100 flex flex-col justify-between pb-36 select-none font-sans overflow-x-hidden antialiased"
    >
      {/* Pull-to-refresh indicator banner */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-all"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 50 }}
        >
          <div className="bg-neutral-900 border border-indigo-500/40 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing live queue...' : pullDistance > 45 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        </div>
      )}

      {/* Main Content Container - responsive with clean mobile padding */}
      <div className="w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-3 sm:pt-5 space-y-3.5">
        
        {/* Compact Mobile Top App Bar */}
        <header className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-sky-500 p-[2px] shadow-md shadow-indigo-500/20 shrink-0">
              <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
                <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent truncate leading-tight">
                  DesiBeats
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shrink-0">
                  Live Indo-DE
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium truncate">
                Crowd DJ Song Requests
              </p>
            </div>
          </div>

          {/* Quick Hype Reactions to Stage TV with accessible min-touch-targets */}
          <div className="flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 p-1 rounded-2xl shrink-0">
            {['🔥', '💃', '🕺', '🎉'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendEmojiReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center text-base rounded-xl hover:bg-neutral-800 active:scale-90 transition-all cursor-pointer"
                title={`Send ${emoji} to stage display`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </header>

        {/* Reaction sent toast */}
        {reactionFeedback && (
          <div className="bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-xs font-semibold py-1 px-3 rounded-full text-center animate-fade-in shadow-md">
            {reactionFeedback}
          </div>
        )}

        {/* Top 3 Party MVP Ceremony Banner (Visible when DJ launches ceremony) */}
        {globalState.mvpRevealActive && (
          <div className="p-4 rounded-3xl bg-gradient-to-r from-neutral-950 via-indigo-950/60 to-neutral-950 border-2 border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.25)] space-y-2 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-black uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              <span>PARTY MVP AWARDS LIVE ON TV!</span>
            </div>
            <h3 className="text-base font-black text-white">The Night's Top Song Selectors</h3>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {leaderboard.slice(0, 3).map((item, idx) => (
                <div key={item.client_id} className="bg-black/60 p-2 rounded-2xl border border-indigo-500/30">
                  <div className="text-base">{idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}</div>
                  <div className="text-xs font-black text-white truncate">{item.name}</div>
                  <div className="text-[10px] text-indigo-300 font-bold">{item.totalUpvotes} upvotes</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global DJ Announcement Bar */}
        {globalState.announcement && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-neutral-900 via-indigo-950/40 to-neutral-900 border border-indigo-500/30 backdrop-blur-md flex items-center gap-2.5 shadow-md">
            <Megaphone className="w-4 h-4 text-indigo-400 flex-shrink-0 animate-bounce" />
            <span className="text-xs font-semibold text-indigo-200">
              {globalState.announcement}
            </span>
          </div>
        )}

        {/* Locked Status Banner */}
        {globalState.isLocked && (
          <div className="p-3 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>Requests are temporarily paused by the DJ. You can still upvote pending songs!</span>
          </div>
        )}

        {/* "Where is My Song?" Pinned Live Position Card */}
        {myPendingTracks.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-neutral-900 to-violet-950/40 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.12)] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                YOUR ACTIVE REQUEST TRACKER
              </span>
              <span className="text-indigo-300 font-mono">
                {myTotalUpvotesEarned} Total Upvotes Tonight 🔥
              </span>
            </div>
            {myPendingTracks.slice(0, 1).map((track) => {
              const queuePosition = sortedPendingQueue.findIndex((q) => q.id === track.id) + 1;
              return (
                <div key={track.id} className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{track.title}</p>
                    <p className="text-[11px] text-neutral-400">
                      Position: <strong className="text-indigo-400 font-black">#{queuePosition}</strong> in line (~{queuePosition * 3} mins away)
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-black flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{track.upvotes}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* User Feedback Toast */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-600 text-emerald-200'
                : 'bg-red-950/80 border border-red-700 text-red-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span className="flex-1">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Mobile Navigation Tabs (Segmented Control with 44px touch targets) */}
        <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-2xl">
          <button
            onClick={() => {
              triggerHaptic(15);
              setActiveTab('request');
            }}
            className={`flex-1 h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'request'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Request</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(15);
              setActiveTab('queue');
            }}
            className={`flex-1 h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Queue ({sortedPendingQueue.length})</span>
          </button>
          {/* Top MVPs Tab is hidden from guests until the DJ launches the ceremony at the end */}
          {globalState.mvpRevealActive && (
            <button
              onClick={() => {
                triggerHaptic(15);
                setActiveTab('leaderboard');
              }}
              className={`flex-1 h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Top MVPs</span>
            </button>
          )}
        </div>

        {/* --- TAB 1: REQUEST A SONG --- */}
        {activeTab === 'request' && (
          <div className="space-y-4">
            {/* Search Input Box with Mobile-first touch ergonomic styling */}
            <form onSubmit={handleSearchOrResolve} className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Song name or YouTube / YT Music link..."
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-10 pr-24 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !inputQuery.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 disabled:opacity-40 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  {isProcessing ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Direct Paste Notice */}
              {promptUrlPaste && (
                <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    Searching low on quota! Paste the exact YouTube link for 100% instant matching.
                  </span>
                </div>
              )}
            </form>

            {/* Quick Pick Anthem Chips */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Trending Party Anthems:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickSuggestions.map((sug) => (
                  <button
                    key={sug.title}
                    type="button"
                    onClick={() => {
                      setInputQuery(sug.query);
                      handleSearchOrResolve(undefined, sug.query);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white hover:border-indigo-500/50 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>+</span>
                    <span>{sug.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results Dropdown List */}
            {searchResults.length > 0 && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-2 space-y-1.5 max-h-72 overflow-y-auto">
                <p className="text-[11px] font-bold text-neutral-400 px-2 py-1">
                  Tap to select your song:
                </p>
                {searchResults.map((item) => (
                  <button
                    key={item.id.videoId}
                    onClick={() => handleSelectTrack(item)}
                    className="w-full min-h-[56px] p-2 rounded-xl hover:bg-neutral-800 active:bg-neutral-800/90 flex items-center gap-3 text-left transition-colors cursor-pointer"
                  >
                    <img
                      src={item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url}
                      alt={item.snippet.title}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-neutral-700"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{item.snippet.title}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{item.snippet.channelTitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Selected Track Confirmation Form */}
            {selectedTrack && (
              <form onSubmit={handleSubmitRequest} className="bg-neutral-900/90 border border-indigo-500/40 rounded-3xl p-4 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Track Ready to Queue
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={selectedTrack.thumbnailUrl}
                    alt={selectedTrack.title}
                    className="w-14 h-14 rounded-2xl object-cover border border-neutral-700 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white line-clamp-2 leading-snug">{selectedTrack.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{selectedTrack.channelTitle}</p>
                  </div>
                </div>

                {/* Requester Name Input */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1.5">
                    Your Name or Group (optional - shown on stage):
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Rahul, Ladkiwale Squad, Ananya"
                      value={requestedBy}
                      onChange={(e) => setRequestedBy(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Submit button with 48px min-height */}
                <button
                  type="submit"
                  disabled={isProcessing || cooldownRemainingMs > 0 || globalState.isLocked}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm hover:opacity-95 disabled:opacity-40 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {cooldownRemainingMs > 0
                      ? `Cooldown (${formatCooldown(cooldownRemainingMs)})`
                      : 'Submit Request to DJ'}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* --- TAB 2: LIVE QUEUE & UPVOTING --- */}
        {activeTab === 'queue' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <span>Sorted by highest crowd upvotes</span>
              <span className="font-bold text-indigo-300">{sortedPendingQueue.length} Tracks Waiting</span>
            </div>

            {sortedPendingQueue.length > 0 ? (
              sortedPendingQueue.map((item, index) => {
                const hasUpvoted = upvotedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`min-h-[64px] p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                      item.is_pinned
                        ? 'bg-amber-950/25 border-amber-500/40 shadow-sm'
                        : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-xs font-black text-neutral-500 w-5 text-center shrink-0">
                        #{index + 1}
                      </span>
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-neutral-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-white truncate">{item.title}</p>
                          {item.is_pinned && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 shrink-0">
                              VIP
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          Requested by <strong className="text-neutral-200">{item.requested_by}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Upvote Touch Button: 44px minimum touch target for mobile thumb */}
                    <button
                      onClick={() => handleUpvote(item.id, item.title)}
                      disabled={hasUpvoted}
                      className={`min-h-[44px] min-w-[56px] px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs active:scale-90 transition-all cursor-pointer ${
                        hasUpvoted
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 cursor-default'
                          : 'bg-neutral-800 hover:bg-indigo-600 text-neutral-200 hover:text-white border border-neutral-700'
                      }`}
                    >
                      <Flame className={`w-4 h-4 shrink-0 ${hasUpvoted ? 'fill-indigo-400 text-indigo-400' : ''}`} />
                      <span>{item.upvotes}</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl text-neutral-500 text-xs">
                No songs in queue yet! Switch to <strong>Request</strong> to kick off the party.
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: LEADERBOARD / PARTY MVPS (Only displayed once revealed at the end) --- */}
        {globalState.mvpRevealActive && activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Rankings of guests whose requested tracks got the most upvotes tonight!</span>
            </div>

            {leaderboard.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.map((user, idx) => (
                  <div
                    key={user.client_id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      idx === 0
                        ? 'bg-amber-950/30 border-amber-400/50'
                        : idx === 1
                        ? 'bg-neutral-900 border-neutral-700'
                        : 'bg-neutral-900/50 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-black/60 border border-neutral-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-neutral-400">
                          {user.acceptedSongs} {user.acceptedSongs === 1 ? 'song requested' : 'songs requested'}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-black text-xs flex items-center gap-1.5 shrink-0">
                      <Flame className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{user.totalUpvotes} upvotes</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl text-neutral-500 text-xs">
                No upvotes recorded yet! Upvote songs in the queue to build the leaderboard.
              </div>
            )}
          </div>
        )}
      </div>

      {/* FIXED MOBILE FOOTER: NOW PLAYING COMPACT BAR (Complies with 15% sticky cap) */}
      {currentlyPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-md border-t border-indigo-500/20 px-3 py-2.5 pb-safe shadow-2xl">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-indigo-500/30">
                <img
                  src={currentlyPlaying.thumbnail_url}
                  alt={currentlyPlaying.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                    ON STAGE NOW
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">{currentlyPlaying.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold shrink-0">
              <Flame className="w-3.5 h-3.5 text-indigo-400" />
              <span>{currentlyPlaying.upvotes}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
