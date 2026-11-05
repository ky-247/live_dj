import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Send, 
  Music, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Clock, 
  Megaphone,
  RefreshCw,
  Trophy,
  X,
  ListMusic,
  TrendingUp,
  User,
  ExternalLink
} from 'lucide-react';
import { QueueItem, GlobalState, PartyContributor } from '../types';
import { socket } from '../lib/socket';
import { sortQueue } from '../lib/queue';

export function RequestPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ 
    isLocked: false, 
    nowPlayingTrackId: null, 
    mvpRevealActive: false,
    settings: {
      guestCooldownSeconds: 180,
      duplicateLockoutMinutes: 30,
      maxQueueCapacity: 20,
      maxRequestsPerGuest: 2,
      maxUpvotesPerGuest: 10,
      profanityFilterEnabled: true,
      autoCleanupPlayed: false,
      peakTimeFastMode: false,
      fallbackSkipSeconds: 10,
    } as any 
  });
  const [leaderboard, setLeaderboard] = useState<PartyContributor[]>([]);
  const [activeTab, setActiveTab] = useState<'request' | 'queue' | 'leaderboard'>('request');
  
  // Search & track selection
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
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Persistence & anti-spam state
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [promptUrlPaste, setPromptUrlPaste] = useState(false);
  const [myClientId, setMyClientId] = useState<string>('');

  // Reactions feedback toast
  const [reactionToast, setReactionToast] = useState<string | null>(null);

  // Pull-to-refresh mobile gesture
  const [pullStartY, setPullStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Quick-Pick Radio Favourites (Curated party staples)
  const quickSuggestions = [
    { title: 'Tauba Tauba', query: 'Tauba Tauba' },
    { title: 'Kala Chashma', query: 'Kala Chashma' },
    { title: 'Chaleya', query: 'Chaleya' },
    { title: 'Mundian To Bach Ke', query: 'Mundian To Bach Ke' },
    { title: 'Jhoome Jo Pathaan', query: 'Jhoome Jo Pathaan' },
    { title: 'Brown Munde', query: 'Brown Munde' }
  ];

  const triggerHaptic = (pattern: number | number[] = 25) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {}
  };

  // Initialize client ID from server cookie, saved name, and stored upvotes
  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.clientId) setMyClientId(data.clientId);
      })
      .catch((err) => console.warn('Could not fetch guest identity:', err));

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

  // Clear feedback message after 5s
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Pull-to-refresh mobile gesture
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
        setPullDistance(Math.min(70, diff * 0.4));
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
      } catch {}
      finally {
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
          triggerHaptic(30);
        } else {
          setFeedbackMsg({
            type: 'error',
            text: data.error || 'Could not resolve this YouTube link. Please check the URL.',
          });
        }
      } catch {
        setFeedbackMsg({ type: 'error', text: 'Network error resolving link.' });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Regular keyword search query
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (res.ok && data.items && data.items.length > 0) {
        const results = data.items.map((it: any) => ({
          videoId: it.id.videoId,
          title: it.snippet.title,
          channelTitle: it.snippet.channelTitle,
          thumbnailUrl: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url,
        }));
        setSearchResults(results);
        setPromptUrlPaste(!!data.promptUrlPaste);
      } else {
        setSearchResults([]);
        setFeedbackMsg({
          type: 'info',
          text: 'No tracks found. Try typing the artist or paste a YouTube / YouTube Music link.',
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error performing search.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit selected track to server queue
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrack) return;

    if (globalState.isLocked) {
      setFeedbackMsg({ type: 'error', text: 'Song requests are currently paused by the DJ.' });
      return;
    }

    if (cooldownRemainingMs > 0) {
      setFeedbackMsg({
        type: 'error',
        text: `Cooldown active: Please wait ${formatCooldown(cooldownRemainingMs)} before submitting another request.`,
      });
      return;
    }

    setIsProcessing(true);
    const guestName = requestedBy.trim();

    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_id: selectedTrack.videoId,
          requested_by: guestName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to submit song request.' });
        triggerHaptic([60, 40, 60]);
      } else {
        triggerHaptic([40, 40, 60]);
        if (guestName) {
          try {
            localStorage.setItem('desibeats_guest_name', guestName);
          } catch {}
        }
        try {
          localStorage.setItem('desibeats_last_request_time', Date.now().toString());
        } catch {}

        if (data.alreadyExisted) {
          setFeedbackMsg({
            type: 'success',
            text: `"${selectedTrack.title}" was already in the queue — added your upvote!`,
          });
        } else {
          setFeedbackMsg({
            type: 'success',
            text: `Request queued: "${selectedTrack.title}". Tell your friends to vote for it!`,
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
        setSearchResults([]);
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
      setFeedbackMsg({ type: 'info', text: 'You have already upvoted this song.' });
      triggerHaptic(40);
      return;
    }

    triggerHaptic([25, 15, 30]);

    try {
      const res = await fetch(`/api/queue/${trackId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          text: `Upvoted "${trackTitle}".`,
        });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Network error upvoting track.' });
    }
  };

  // Send real-time emoji reaction to stage display
  const sendEmojiReaction = (emoji: string) => {
    triggerHaptic(20);
    socket.emit('send-reaction', {
      emoji,
      sender: requestedBy.trim() || 'Guest'
    });
    setReactionToast(`Sent ${emoji} to stage`);
    setTimeout(() => setReactionToast(null), 1800);
  };

  // Find user's own requests (own-request status tracker)
  const myPendingTracks = queue.filter(
    (q) => q.status === 'pending' && q.client_id && q.client_id === myClientId
  );
  const myPlayingTrack = queue.find(
    (q) => q.status === 'playing' && q.client_id && q.client_id === myClientId
  );

  // Authoritative sort order
  const sortedPendingQueue = sortQueue(queue, true);
  const currentlyPlaying = queue.find((q) => q.status === 'playing');

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-[#efefdf] text-[#191c18] font-sans pb-28 select-none antialiased"
    >
      {/* Pull-to-refresh mobile gesture indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-all"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 45 }}
        >
          <div className="bg-[#191c18] text-[#efefdf] font-mono text-xs px-3 py-1 rounded-sm flex items-center gap-2 shadow-md">
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing setlist...' : pullDistance > 45 ? 'Release to refresh' : 'Pull to refresh'}</span>
          </div>
        </div>
      )}

      {/* Main Page Content - Contemporary printed setlist layout */}
      <div className="max-w-xl mx-auto px-4 pt-4 sm:pt-6 space-y-4">
        
        {/* Header - Radio cue sheet header */}
        <header className="border-b-2 border-[#191c18] pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg sm:text-xl tracking-tight text-[#191c18]">
                  DESIBEATS LIVE CUE
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-[#191c18] text-[#dfed66]">
                  ON AIR
                </span>
              </div>
              <p className="text-xs text-[#5e6357] font-mono mt-0.5">
                Crowdsourced DJ Queue · Indo-German Event Stream
              </p>
            </div>

            {/* Quick Party Reactions Bar */}
            <div className="flex items-center gap-1 bg-[#e5e5d5] border border-[#d8d8c6] p-1 rounded-sm">
              {['🔥', '💃', '🕺', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendEmojiReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-sm rounded-sm hover:bg-[#d8d8c6] active:scale-95 transition-transform cursor-pointer"
                  title={`Send ${emoji} to stage display`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Reaction confirmation toast */}
          {reactionToast && (
            <div className="mt-2 text-center text-xs font-mono py-1 px-2 bg-[#191c18] text-[#dfed66] rounded-sm">
              {reactionToast}
            </div>
          )}
        </header>

        {/* Global DJ Live Announcement Banner */}
        {globalState.announcement && (
          <div className="p-3 bg-[#191c18] text-[#efefdf] border-l-4 border-[#dfed66] rounded-sm flex items-start gap-2.5">
            <Megaphone className="w-4 h-4 text-[#dfed66] shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-mono uppercase font-bold text-[#dfed66] mr-1.5">[DJ BROADCAST]:</span>
              <span className="font-medium">{globalState.announcement}</span>
            </div>
          </div>
        )}

        {/* Paused Requests Notice */}
        {globalState.isLocked && (
          <div className="p-3 bg-[#e05d52]/15 border border-[#e05d52] rounded-sm text-[#191c18] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#e05d52] shrink-0" />
            <span>Requests are currently paused by the DJ. Upvoting existing songs is still open.</span>
          </div>
        )}

        {/* Top 3 Party MVP Ceremony Banner (Visible when DJ launches ceremony) */}
        {globalState.mvpRevealActive && leaderboard.length > 0 && (
          <div className="p-3.5 bg-[#191c18] text-[#efefdf] border border-[#dfed66] rounded-sm space-y-2">
            <div className="flex items-center justify-between font-mono text-xs text-[#dfed66]">
              <span className="font-bold flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#dfed66]" />
                PARTY MVP AWARDS LIVE ON STAGE
              </span>
              <span>TOP CONTRIBUTORS</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {leaderboard.slice(0, 3).map((item, idx) => (
                <div key={item.client_id} className="bg-[#22251f] border border-[#44493e] p-2 rounded-sm text-center">
                  <div className="text-xs font-mono text-[#dfed66] font-bold">
                    {idx === 0 ? '01 · 👑' : idx === 1 ? '02 · 🥈' : '03 · 🥉'}
                  </div>
                  <div className="text-xs font-bold text-white truncate mt-0.5">{item.name}</div>
                  <div className="text-[10px] text-[#aeb3a5] font-mono">{item.totalUpvotes} votes</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div 
            className={`p-3 rounded-sm text-xs font-mono flex items-center gap-2 border ${
              feedbackMsg.type === 'error'
                ? 'bg-[#e05d52]/15 text-[#191c18] border-[#e05d52]'
                : feedbackMsg.type === 'success'
                ? 'bg-[#191c18] text-[#dfed66] border-[#191c18]'
                : 'bg-[#e5e5d5] text-[#191c18] border-[#d8d8c6]'
            }`}
          >
            {feedbackMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#e05d52] shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#dfed66] shrink-0" />
            )}
            <span className="flex-1 font-medium">{feedbackMsg.text}</span>
            <button 
              onClick={() => setFeedbackMsg(null)}
              className="text-[#5e6357] hover:text-[#191c18]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Own-Request Status Tracker (Pinned card showing where user's song is) */}
        {(myPlayingTrack || myPendingTracks.length > 0) && (
          <div className="p-3 bg-[#e5e5d5] border border-[#191c18] rounded-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-[#191c18]">
              <span>YOUR REQUEST STATUS</span>
              <span className="text-[10px] bg-[#191c18] text-[#dfed66] px-1.5 py-0.5 rounded-sm">
                TRACKER
              </span>
            </div>

            {myPlayingTrack && (
              <div className="p-2 bg-[#191c18] text-[#efefdf] rounded-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono text-[#dfed66] block font-bold">PLAYING ON STAGE NOW</span>
                  <p className="text-xs font-bold truncate">{myPlayingTrack.title}</p>
                </div>
                <span className="text-xs font-mono font-bold text-[#dfed66] shrink-0">▲ {myPlayingTrack.upvotes}</span>
              </div>
            )}

            {myPendingTracks.map((pt) => {
              const position = sortedPendingQueue.findIndex((q) => q.id === pt.id) + 1;
              return (
                <div key={pt.id} className="p-2 bg-white border border-[#d8d8c6] rounded-sm flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-[#191c18] text-[#dfed66] rounded-sm shrink-0">
                      #{position}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#191c18] truncate">{pt.title}</p>
                      <p className="text-[10px] text-[#5e6357] font-mono">In queue · Position #{position}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#191c18] shrink-0">▲ {pt.upvotes}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Segmented Control / Navigation between Search & Queue */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#e5e5d5] border border-[#d8d8c6] rounded-sm font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`py-2 text-center rounded-sm transition-all font-bold cursor-pointer ${
              activeTab === 'request'
                ? 'bg-[#191c18] text-[#efefdf]'
                : 'text-[#5e6357] hover:text-[#191c18]'
            }`}
          >
            01. REQUEST A SONG
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`py-2 text-center rounded-sm transition-all font-bold cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-[#191c18] text-[#efefdf]'
                : 'text-[#5e6357] hover:text-[#191c18]'
            }`}
          >
            02. LIVE QUEUE ({sortedPendingQueue.length})
          </button>
        </div>

        {/* TAB 1: REQUEST A SONG (Search First Layout) */}
        {activeTab === 'request' && (
          <div className="space-y-4">
            
            {/* If a track is selected, show Selection Form */}
            {selectedTrack ? (
              <form onSubmit={handleSubmitRequest} className="p-4 bg-white border-2 border-[#191c18] rounded-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#d8d8c6] pb-2 font-mono text-xs font-bold text-[#191c18]">
                  <span>CONFIRM SONG REQUEST</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(null)}
                    className="text-[#5e6357] hover:text-[#191c18] flex items-center gap-1 text-[11px]"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear selection</span>
                  </button>
                </div>

                {/* Track Preview */}
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 rounded-sm overflow-hidden bg-[#191c18] shrink-0 border border-[#d8d8c6]">
                    <img 
                      src={selectedTrack.thumbnailUrl} 
                      alt={selectedTrack.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#191c18] line-clamp-1">{selectedTrack.title}</h3>
                    <p className="text-xs text-[#5e6357] font-mono truncate">{selectedTrack.channelTitle}</p>
                  </div>
                </div>

                {/* Optional Requester Name */}
                <div className="space-y-1">
                  <label htmlFor="requester-name" className="block font-mono text-xs text-[#5e6357] uppercase">
                    Your Name or Shoutout (Optional):
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3 text-[#5e6357]" />
                    <input
                      id="requester-name"
                      type="text"
                      maxLength={30}
                      placeholder="e.g. Priya & Friends, Table 4"
                      value={requestedBy}
                      onChange={(e) => setRequestedBy(e.target.value)}
                      className="w-full bg-[#efefdf] border border-[#d8d8c6] rounded-sm pl-8 pr-3 py-2 text-xs text-[#191c18] placeholder-[#5e6357] focus:outline-none focus:border-[#191c18]"
                    />
                  </div>
                  <p className="text-[10px] text-[#5e6357] font-mono">Max 30 characters · Displays on stage TV</p>
                </div>

                {/* Cooldown notice if applicable */}
                {cooldownRemainingMs > 0 && (
                  <div className="p-2 bg-[#e5e5d5] border border-[#d8d8c6] rounded-sm text-xs font-mono flex items-center justify-between text-[#191c18]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Next request available in:
                    </span>
                    <span className="font-bold">{formatCooldown(cooldownRemainingMs)}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(null)}
                    className="flex-1 py-2.5 px-3 rounded-sm border border-[#d8d8c6] text-xs font-mono font-bold text-[#191c18] hover:bg-[#e5e5d5] transition-colors cursor-pointer"
                  >
                    Change song
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || globalState.isLocked || cooldownRemainingMs > 0}
                    className="flex-2 py-2.5 px-4 rounded-sm bg-[#191c18] text-[#dfed66] text-xs font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-[#22251f] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isProcessing ? 'Submitting...' : 'Queue Song'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Search First Form */
              <div className="space-y-4">
                <form onSubmit={handleSearchOrResolve} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-[#5e6357]">
                    <span className="uppercase font-bold text-[#191c18]">SEARCH TRACK OR PASTE YOUTUBE URL</span>
                    <span>Search or Paste</span>
                  </div>

                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-[#5e6357]" />
                      <input
                        type="text"
                        placeholder="Song name, artist, or YouTube link..."
                        value={inputQuery}
                        onChange={(e) => setInputQuery(e.target.value)}
                        className="w-full bg-white border-2 border-[#191c18] rounded-sm pl-9 pr-8 py-2.5 text-xs text-[#191c18] placeholder-[#5e6357] font-medium focus:outline-none focus:ring-1 focus:ring-[#191c18]"
                      />
                      {inputQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setInputQuery('');
                            setSearchResults([]);
                          }}
                          className="absolute right-2.5 top-3 text-[#5e6357] hover:text-[#191c18]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing || !inputQuery.trim()}
                      className="px-4 py-2.5 rounded-sm bg-[#191c18] text-[#dfed66] text-xs font-mono font-bold hover:bg-[#22251f] disabled:opacity-40 transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Find</span>
                    </button>
                  </div>
                </form>

                {/* Search Results Display */}
                {searchResults.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between font-mono text-xs text-[#5e6357] border-b border-[#d8d8c6] pb-1">
                      <span>SEARCH RESULTS ({searchResults.length})</span>
                      <span>SELECT TO CUE</span>
                    </div>

                    <div className="space-y-2">
                      {searchResults.map((item) => (
                        <div
                          key={item.videoId}
                          className="p-2.5 bg-white border border-[#d8d8c6] hover:border-[#191c18] rounded-sm flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-14 h-10 rounded-sm overflow-hidden bg-[#191c18] shrink-0 border border-[#d8d8c6]">
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-[#191c18] line-clamp-1">{item.title}</h4>
                              <p className="text-[11px] text-[#5e6357] font-mono truncate">{item.channelTitle}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTrack(item);
                              triggerHaptic(25);
                            }}
                            className="px-3 py-1.5 rounded-sm bg-[#191c18] text-[#dfed66] text-xs font-mono font-bold hover:bg-[#22251f] transition-all shrink-0 cursor-pointer"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt URL paste banner if search catalog falls back */}
                {promptUrlPaste && searchResults.length > 0 && (
                  <div className="p-2.5 bg-[#e5e5d5] border border-[#d8d8c6] rounded-sm text-xs font-mono text-[#5e6357]">
                    For exact remixes or unlisted tracks, you can paste the YouTube or YouTube Music link directly into the search bar.
                  </div>
                )}

                {/* Radio Favourites / Curated Staples (When search query is empty) */}
                {searchResults.length === 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between font-mono text-xs text-[#5e6357]">
                      <span className="uppercase font-bold text-[#191c18]">POPULAR RADIO FAVOURITES</span>
                      <span>Instant Search</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {quickSuggestions.map((item) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => {
                            setInputQuery(item.query);
                            handleSearchOrResolve(undefined, item.query);
                          }}
                          className="px-2.5 py-1.5 rounded-sm bg-white border border-[#d8d8c6] hover:border-[#191c18] text-xs font-mono text-[#191c18] transition-colors cursor-pointer"
                        >
                          + {item.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE QUEUE & VOTING */}
        {activeTab === 'queue' && (
          <div className="space-y-3">
            {/* On Air Now Banner */}
            {currentlyPlaying && (
              <div className="p-3 bg-[#191c18] text-[#efefdf] rounded-sm border border-[#191c18] space-y-1">
                <div className="flex items-center justify-between font-mono text-[10px] text-[#dfed66]">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#dfed66] animate-pulse" />
                    ON AIR NOW
                  </span>
                  <span>LIVE TRANSMISSION</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{currentlyPlaying.title}</h3>
                    <p className="text-xs text-[#aeb3a5] font-mono truncate">
                      {currentlyPlaying.channel_title} {currentlyPlaying.requested_by ? `· Cued by ${currentlyPlaying.requested_by}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#dfed66] font-bold shrink-0">
                    ▲ {currentlyPlaying.upvotes}
                  </span>
                </div>
              </div>
            )}

            {/* Queue Table Header */}
            <div className="flex items-center justify-between font-mono text-xs text-[#5e6357] border-b border-[#d8d8c6] pb-1 pt-1">
              <span>UPCOMING CUES ({sortedPendingQueue.length})</span>
              <span>VOTE TO PLAY NEXT</span>
            </div>

            {/* List of pending songs */}
            <div className="space-y-2">
              {sortedPendingQueue.map((item, idx) => {
                const isVoted = upvotedIds.has(item.id);
                const isMySong = item.client_id === myClientId;

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-sm border transition-all flex items-center justify-between gap-3 ${
                      isMySong
                        ? 'bg-[#e5e5d5] border-[#191c18]'
                        : item.is_pinned
                        ? 'bg-white border-[#191c18]'
                        : 'bg-white border-[#d8d8c6]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Queue Index */}
                      <span className="font-mono text-xs font-bold text-[#5e6357] w-6 shrink-0 text-center">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Thumbnail */}
                      <div className="w-12 h-10 rounded-sm overflow-hidden bg-[#191c18] shrink-0 border border-[#d8d8c6] relative">
                        <img 
                          src={item.thumbnail_url} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                        />
                        {item.is_pinned && (
                          <span className="absolute top-0 right-0 bg-[#191c18] text-[#dfed66] text-[8px] font-mono px-1 font-bold">
                            VIP
                          </span>
                        )}
                      </div>

                      {/* Title & Metadata (Clean unboxed text) */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-[#191c18] line-clamp-1">{item.title}</h4>
                        </div>
                        <div className="text-[11px] text-[#5e6357] font-mono truncate">
                          <span>{item.channel_title}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{item.requested_by || 'Host'}</span>
                          {isMySong && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <strong className="text-[#191c18]">Your Song</strong>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Upvote Button with clear touch target >= 44px */}
                    <button
                      type="button"
                      disabled={isVoted}
                      onClick={() => handleUpvote(item.id, item.title)}
                      className={`min-h-[44px] min-w-[58px] px-3 py-1.5 rounded-sm font-mono text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isVoted
                          ? 'bg-[#191c18] text-[#dfed66]'
                          : 'bg-[#efefdf] text-[#191c18] border border-[#d8d8c6] hover:border-[#191c18] active:bg-[#e5e5d5]'
                      }`}
                      title={isVoted ? 'You have upvoted this song' : 'Upvote song'}
                    >
                      <span className="text-xs">▲ {item.upvotes}</span>
                      <span className="text-[9px] uppercase font-normal">{isVoted ? 'Voted' : 'Vote'}</span>
                    </button>
                  </div>
                );
              })}

              {sortedPendingQueue.length === 0 && (
                <div className="text-center py-12 border border-dashed border-[#d8d8c6] rounded-sm p-6 space-y-2">
                  <Music className="w-8 h-8 text-[#5e6357] mx-auto" />
                  <p className="font-mono text-xs font-bold text-[#191c18]">QUEUE IS CURRENTLY EMPTY</p>
                  <p className="text-xs text-[#5e6357]">
                    Search for your favourite song above to get it queued up for the DJ!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('request')}
                    className="mt-2 px-3 py-1.5 rounded-sm bg-[#191c18] text-[#dfed66] font-mono text-xs font-bold"
                  >
                    Search Songs
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
