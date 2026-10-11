import { useState, useEffect } from 'react';
import { 
  Search, 
  ThumbsUp, 
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
  Check, 
  Crown, 
  Megaphone 
} from 'lucide-react';
import { QueueItem, GlobalState } from '../types';
import { socket } from '../lib/socket';

export function RequestPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>({ isLocked: false, nowPlayingTrackId: null, settings: {} as any });
  const [activeTab, setActiveTab] = useState<'request' | 'queue' | 'master'>('request');
  
  // Input fields
  const [inputQuery, setInputQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<{
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
  } | null>(null);

  const [requestedBy, setRequestedBy] = useState('');
  const [dedicationNote, setDedicationNote] = useState('');
  const [isMasterListTrack, setIsMasterListTrack] = useState(false);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Client-side rate-limiting and persistence
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [promptUrlPaste, setPromptUrlPaste] = useState(false);

  // Popular Quick-Pick Suggestions for Indian parties in Germany
  const quickSuggestions = [
    { title: 'Tauba Tauba', query: 'Tauba Tauba' },
    { title: 'Kala Chashma', query: 'Kala Chashma' },
    { title: 'Chaleya', query: 'Chaleya' },
    { title: 'Mundian To Bach Ke', query: 'Mundian To Bach Ke' },
    { title: 'Jhoome Jo Pathaan', query: 'Jhoome Jo Pathaan' },
    { title: 'Brown Munde', query: 'Brown Munde' }
  ];

  // Load upvoted track IDs and cooldown timestamp from localStorage
  useEffect(() => {
    try {
      const storedUpvotes = localStorage.getItem('desibeats_upvoted_ids');
      if (storedUpvotes) {
        const parsed = JSON.parse(storedUpvotes);
        if (Array.isArray(parsed)) {
          setUpvotedIds(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn('Failed to load stored upvotes:', e);
    }

    // Check last request cooldown
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

  // Shared Socket connection with proper unsubscription
  useEffect(() => {
    const handleQueueUpdated = (newQueue: QueueItem[]) => {
      setQueue(newQueue);
    };

    const handleStateUpdated = (newState: GlobalState) => {
      setGlobalState(newState);
    };

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);

    fetch('/api/queue').then((res) => res.json()).then(setQueue).catch(() => {});
    fetch('/api/state').then((res) => res.json()).then(setGlobalState).catch(() => {});

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
    };
  }, []);

  // Clear feedback message after 4s
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // Check if query is a YouTube or YouTube Music URL
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
          setFeedbackMsg({
            type: 'success',
            text: 'YouTube / YouTube Music track recognized! Add your name and dedication.',
          });
        } else {
          setFeedbackMsg({
            type: 'error',
            text: data.error || 'Could not parse this YouTube Music link.',
          });
        }
      } catch {
        setFeedbackMsg({
          type: 'error',
          text: 'Failed to resolve link. Please try again or search by song title.',
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Otherwise standard search
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.items || []);
      setPromptUrlPaste(Boolean(data.promptUrlPaste));

      if (!data.items || data.items.length === 0) {
        setFeedbackMsg({
          type: 'error',
          text: 'No matching tracks found. Try pasting the direct YouTube Music link!',
        });
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Error searching tracks.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitSongRequest = async () => {
    if (!selectedTrack || globalState.isLocked) return;

    const dynamicCooldownMs = (globalState.settings?.guestCooldownSeconds || 180) * 1000;

    // Rate Limiting Check: per-guest cooldown
    if (cooldownRemainingMs > 0 && !isMasterListTrack) {
      setFeedbackMsg({
        type: 'error',
        text: `Rate Limit: Please wait ${formatCooldown(cooldownRemainingMs)} before submitting another request to give everyone a chance!`,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_id: selectedTrack.videoId,
          title: selectedTrack.title,
          channel_title: selectedTrack.channelTitle,
          thumbnail_url: selectedTrack.thumbnailUrl,
          requested_by: requestedBy.trim() || 'Party Guest',
          dedication_note: dedicationNote.trim(),
          is_master_list: isMasterListTrack,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        // Record rate-limit timestamp in localStorage
        const now = Date.now();
        localStorage.setItem('desibeats_last_request_time', now.toString());
        setCooldownRemainingMs(dynamicCooldownMs);

        // Record as upvoted by requester
        const updatedUpvotes = new Set(upvotedIds).add(result.id);
        setUpvotedIds(updatedUpvotes);
        localStorage.setItem('desibeats_upvoted_ids', JSON.stringify(Array.from(updatedUpvotes)));

        if (result.alreadyExisted) {
          setFeedbackMsg({
            type: 'success',
            text: `"${selectedTrack.title}" was already in the queue! Upvoted to ${result.upvotes} votes! 🔥`,
          });
        } else {
          setFeedbackMsg({
            type: 'success',
            text: `Song added to queue! Guests can now upvote your track. 🚀`,
          });
        }

        // Reset form
        setSelectedTrack(null);
        setInputQuery('');
        setSearchResults([]);
        setDedicationNote('');
      } else {
        setFeedbackMsg({
          type: 'error',
          text: result.error || 'Failed to submit request.',
        });
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Network error. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpvote = async (id: string) => {
    // Prevent duplicate upvoting from the same browser
    if (upvotedIds.has(id)) {
      setFeedbackMsg({
        type: 'error',
        text: 'You have already upvoted this song!',
      });
      return;
    }

    // Optimistic UI update & persist to localStorage
    const updated = new Set(upvotedIds).add(id);
    setUpvotedIds(updated);
    try {
      localStorage.setItem('desibeats_upvoted_ids', JSON.stringify(Array.from(updated)));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    try {
      await fetch(`/api/queue/${id}/upvote`, { method: 'POST' });
    } catch (err) {
      console.error('Upvote failed:', err);
    }
  };

  // Currently playing track
  const nowPlaying = queue.find((q) => q.status === 'playing');

  // Pending live crowd requests (prioritize VIP pinned tracks!)
  const liveRequests = queue
    .filter((q) => q.status === 'pending' && !q.is_master_list)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.upvotes - a.upvotes;
    });

  // Master list tracks
  const masterListTracks = queue
    .filter((q) => q.status === 'pending' && q.is_master_list)
    .sort((a, b) => b.upvotes - a.upvotes);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-neutral-950 text-neutral-100 p-4 sm:p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* DJ Live Announcement Ticker */}
        {globalState.announcement && (
          <div className="bg-gradient-to-r from-purple-900/90 via-pink-900/90 to-amber-900/90 border border-pink-500/40 rounded-2xl p-4 flex items-center gap-3 shadow-xl animate-in fade-in">
            <Megaphone className="w-5 h-5 text-amber-300 animate-bounce flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider mr-1.5">
                DJ Announcement:
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                {globalState.announcement}
              </span>
            </div>
          </div>
        )}

        {/* Header Hero */}
        <div className="text-center py-4 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Crowdsourced DJ Live Request • Indian Events</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Request Your Favorite Song
          </h1>
          <p className="text-neutral-400 text-sm max-w-md mx-auto">
            Paste any <strong className="text-neutral-200">YouTube Music</strong> or YouTube link, or search for your favorite hits. Top upvoted tracks play automatically!
          </p>
        </div>

        {/* Now Playing Banner (if active) */}
        {nowPlaying && (
          <div className="bg-gradient-to-r from-orange-950/40 via-neutral-900 to-pink-950/40 border border-orange-500/30 rounded-2xl p-4 shadow-xl flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-800 flex-shrink-0 relative">
              <img src={nowPlaying.thumbnail_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-orange-400 animate-bounce" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full border border-orange-500/20">
                  BLASTING ON STAGE NOW
                </span>
              </div>
              <p className="font-bold text-sm text-white truncate mt-1">{nowPlaying.title}</p>
              <p className="text-xs text-neutral-400 truncate">
                Req: <span className="text-amber-300 font-medium">{nowPlaying.requested_by}</span>
                {nowPlaying.dedication_note && ` • "${nowPlaying.dedication_note}"`}
              </p>
            </div>
          </div>
        )}

        {/* Queue Locked Alert */}
        {globalState.isLocked && (
          <div className="bg-red-950/60 border border-red-500/50 text-red-200 p-4 rounded-2xl text-center font-medium text-sm flex items-center justify-center gap-2 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>The DJ has temporarily paused new requests. You can still upvote existing tracks below!</span>
          </div>
        )}

        {/* Cooldown Timer Banner */}
        {cooldownRemainingMs > 0 && !globalState.isLocked && (
          <div className="bg-amber-950/40 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Request cooldown active to prevent spam</span>
            </div>
            <span className="bg-amber-500/20 px-2.5 py-1 rounded-full text-amber-300 font-mono font-bold">
              {formatCooldown(cooldownRemainingMs)}
            </span>
          </div>
        )}

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl text-sm font-medium flex items-center gap-3 transition-all ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/70 border border-red-500/40 text-red-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Section Tabs: New Request vs Live Queue vs Master */}
        <div className="flex items-center bg-neutral-900 border border-neutral-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('request')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'request'
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Add / Request Song</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'queue'
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Live Requests ({liveRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('master')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'master'
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Master List ({masterListTracks.length})</span>
          </button>
        </div>

        {/* TAB 1: ADD / REQUEST SONG */}
        {activeTab === 'request' && (
          <div className="space-y-5 bg-neutral-900/90 border border-neutral-800 rounded-3xl p-5 sm:p-7 shadow-xl">
            {!selectedTrack ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-orange-400" />
                    <span>Paste YouTube / YouTube Music Link or Search</span>
                  </label>
                  <p className="text-[12px] text-neutral-400">
                    Supports <span className="text-amber-300 font-mono">music.youtube.com</span>, standard YouTube links, or track titles.
                  </p>
                </div>

                <form onSubmit={(e) => handleSearchOrResolve(e)} className="relative">
                  <input
                    type="text"
                    disabled={globalState.isLocked}
                    placeholder="https://music.youtube.com/watch?v=... or 'Tauba Tauba'"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700/80 rounded-2xl py-3.5 pl-4 pr-24 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing || !inputQuery.trim() || globalState.isLocked}
                    className="absolute right-2 top-2 bottom-2 px-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{isProcessing ? 'Checking...' : isUrl(inputQuery) ? 'Fetch' : 'Search'}</span>
                  </button>
                </form>

                {/* Quick Pick Chips */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-500" />
                    <span>Trending at Indian Parties:</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {quickSuggestions.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => {
                          setInputQuery(item.query);
                          handleSearchOrResolve(undefined, item.query);
                        }}
                        className="text-xs bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl border border-neutral-800 transition-colors"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Yellow Capacity Notice Banner */}
                {promptUrlPaste && (
                  <div className="bg-amber-950/60 border border-amber-500/60 text-amber-200 p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 shadow-lg animate-in fade-in">
                    <span className="text-lg leading-none select-none">💡</span>
                    <div className="flex-1 space-y-1">
                      <p className="font-extrabold text-amber-300">
                        Search is running low on capacity!
                      </p>
                      <p className="text-amber-200/90 text-xs font-medium">
                        For best results, copy and paste the exact YouTube / YouTube Music link above.
                      </p>
                    </div>
                  </div>
                )}

                {/* Search Results List */}
                {searchResults.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-neutral-800">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      Select Song to Request
                    </h3>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {searchResults.map((item) => (
                        <button
                          key={item.id.videoId}
                          onClick={() => {
                            setSelectedTrack({
                              videoId: item.id.videoId,
                              title: item.snippet.title,
                              channelTitle: item.snippet.channelTitle,
                              thumbnailUrl: item.snippet.thumbnails.high.url,
                            });
                          }}
                          className="w-full flex items-center gap-3 bg-neutral-950 hover:bg-neutral-800/80 p-3 rounded-2xl border border-neutral-800/80 transition-all text-left group"
                        >
                          <img
                            src={item.snippet.thumbnails.high.url}
                            alt=""
                            className="w-16 h-12 object-cover rounded-xl flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-neutral-200 group-hover:text-white truncate">
                              {item.snippet.title}
                            </p>
                            <p className="text-xs text-neutral-500 truncate mt-0.5">
                              {item.snippet.channelTitle}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                            Choose
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Selected Song Form: Dedication Note and Guest Name */
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Music className="w-4 h-4" />
                    <span>Selected Track Details</span>
                  </span>
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="text-xs text-neutral-400 hover:text-white underline"
                  >
                    Change song
                  </button>
                </div>

                {/* Track Card Preview */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-3.5 flex gap-3.5 items-center">
                  <img
                    src={selectedTrack.thumbnailUrl}
                    alt=""
                    className="w-20 h-14 object-cover rounded-xl flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">{selectedTrack.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{selectedTrack.channelTitle}</p>
                    <span className="inline-block mt-1 text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                      ID: {selectedTrack.videoId}
                    </span>
                  </div>
                </div>

                {/* Guest Input Form */}
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Your Name or Group:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul & Wedding Squad (Munich)"
                      value={requestedBy}
                      onChange={(e) => setRequestedBy(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2.5 px-3.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Shoutout / Dedication Note (Will show on stage screen!):
                    </label>
                    <textarea
                      placeholder="e.g. 'For the bride team doing sangeet dance! 💃🕺'"
                      value={dedicationNote}
                      onChange={(e) => setDedicationNote(e.target.value)}
                      rows={2}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2.5 px-3.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-orange-500 resize-none"
                    />
                  </div>

                  {/* Pre-event Master List Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={isMasterListTrack}
                      onChange={(e) => setIsMasterListTrack(e.target.checked)}
                      className="rounded accent-orange-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Add to Master Playlist (Fallback playlist for DJ)</span>
                  </label>

                  <button
                    onClick={submitSongRequest}
                    disabled={isProcessing || cooldownRemainingMs > 0}
                    className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-amber-500 hover:opacity-95 disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-orange-500/25 transition-all text-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'Submitting to Queue...'
                        : cooldownRemainingMs > 0
                        ? `Cooldown (${formatCooldown(cooldownRemainingMs)})`
                        : 'Submit Song Request'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE QUEUE (Sorted by upvotes, rate-limited upvoting) */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Current Live Requests</span>
                  <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    Sorted by Upvotes
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Tap 👍 to boost a song. The stage player automatically plays the highest-upvoted track next!
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {liveRequests.length === 0 ? (
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-3">
                  <Music className="w-10 h-10 text-neutral-600 mx-auto" />
                  <p className="font-semibold text-neutral-300">No live guest requests in queue yet.</p>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Be the first guest to request a track! The DJ will fall back to the Master Playlist in the meantime.
                  </p>
                  <button
                    onClick={() => setActiveTab('request')}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
                  >
                    <span>Request a Track Now</span>
                  </button>
                </div>
              ) : (
                liveRequests.map((item, idx) => {
                  const hasUpvoted = upvotedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-2xl p-4 flex gap-3.5 items-center relative overflow-hidden transition-all ${
                        item.is_pinned
                          ? 'bg-amber-950/25 border-amber-500/50 shadow-md shadow-amber-500/10'
                          : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {/* Rank badge / VIP Crown */}
                      <div className="w-7 text-center font-black text-sm flex-shrink-0">
                        {item.is_pinned ? (
                          <Crown className="w-4 h-4 text-amber-400 mx-auto" />
                        ) : (
                          <span className="text-neutral-500">#{idx + 1}</span>
                        )}
                      </div>

                      {/* Thumbnail */}
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        className="w-16 h-12 object-cover rounded-xl flex-shrink-0 bg-neutral-900"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-neutral-100 truncate">{item.title}</p>
                          {item.is_pinned && (
                            <span className="text-[9px] font-bold bg-amber-500 text-black px-1.5 py-0.2 rounded-sm flex-shrink-0">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 flex-wrap">
                          <span className="text-neutral-300 font-medium">{item.requested_by}</span>
                          {item.dedication_note && (
                            <>
                              <span className="text-neutral-600">•</span>
                              <span className="truncate italic text-pink-300">
                                "{item.dedication_note}"
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Upvote Button with saved persistence state */}
                      <button
                        onClick={() => handleUpvote(item.id)}
                        disabled={hasUpvoted}
                        className={`flex flex-col items-center justify-center min-w-[58px] h-14 rounded-xl px-2 transition-all ${
                          hasUpvoted
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 cursor-default'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer active:scale-95'
                        }`}
                        title={hasUpvoted ? 'You already upvoted this song' : 'Upvote this song'}
                      >
                        {hasUpvoted ? (
                          <Check className="w-4 h-4 text-orange-400" />
                        ) : (
                          <ThumbsUp className="w-4 h-4" />
                        )}
                        <span className="text-xs font-black mt-1">{item.upvotes}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MASTER PLAYLIST */}
        {activeTab === 'master' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Pre-event Master Playlist</span>
                  <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    DJ Fallback
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  These songs play automatically whenever the live request queue runs out.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {masterListTracks.map((item, idx) => {
                const hasUpvoted = upvotedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 flex gap-3.5 items-center"
                  >
                    <div className="w-6 text-center font-bold text-neutral-600 text-xs">
                      {idx + 1}
                    </div>
                    <img
                      src={item.thumbnail_url}
                      alt=""
                      className="w-16 h-12 object-cover rounded-xl flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-neutral-200 truncate">{item.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{item.channel_title}</p>
                    </div>
                    <button
                      onClick={() => handleUpvote(item.id)}
                      disabled={hasUpvoted}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        hasUpvoted
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 cursor-default'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 cursor-pointer'
                      }`}
                    >
                      {hasUpvoted ? <Check className="w-3.5 h-3.5" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                      <span>{item.upvotes}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
