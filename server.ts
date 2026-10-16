import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(express.json());

interface QueueTrack {
  id: string;
  created_at: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  requested_by: string;
  dedication_note?: string;
  upvotes: number;
  is_master_list: boolean;
  status: 'pending' | 'playing' | 'played';
  is_pinned?: boolean;
  client_id?: string;
  played_at?: string;
}

interface DjSettings {
  guestCooldownSeconds: number;
  duplicateLockoutMinutes: number;
  maxQueueCapacity: number;
  maxRequestsPerGuest: number;
  maxUpvotesPerGuest: number;
  profanityFilterEnabled: boolean;
  autoCleanupPlayed: boolean;
  peakTimeFastMode: boolean;
  vibeTagFilter?: string;
}

interface PlayedHistoryEntry {
  youtube_id: string;
  title: string;
  played_at: number; // timestamp in ms
}

export interface PartyContributor {
  client_id: string;
  name: string;
  totalUpvotes: number;
  acceptedSongs: number;
  topTrackTitle: string;
  topTrackUpvotes: number;
}

// Curated library of party favorites for Indian events in Germany
const popularTracks = [
  {
    videoId: 'YxWlaYCA8MU',
    title: 'Jhoome Jo Pathaan | Shah Rukh Khan, Deepika Padukone | Arijit Singh',
    channelTitle: 'YRF',
    thumbnail: 'https://i.ytimg.com/vi/YxWlaYCA8MU/hqdefault.jpg'
  },
  {
    videoId: 'kw4tT7SCmaY',
    title: 'Kala Chashma | Baar Baar Dekho | Sidharth M, Katrina K | Badshah, Neha Kakkar',
    channelTitle: 'Zee Music Company',
    thumbnail: 'https://i.ytimg.com/vi/kw4tT7SCmaY/hqdefault.jpg'
  },
  {
    videoId: 'v_z4-ZkFfzw',
    title: 'Chaleya | Jawan | Shah Rukh Khan | Nayanthara | Anirudh, Arijit Singh',
    channelTitle: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/v_z4-ZkFfzw/hqdefault.jpg'
  },
  {
    videoId: 'RLzC55ai0eo',
    title: 'Tauba Tauba | Bad Newz | Vicky Kaushal, Triptii Dimri | Karan Aujla',
    channelTitle: 'Saregama Music',
    thumbnail: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg'
  },
  {
    videoId: 'h-T6uWzK938',
    title: 'Chammak Challo | Ra.One | Shah Rukh Khan, Kareena Kapoor | Akon',
    channelTitle: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/h-T6uWzK938/hqdefault.jpg'
  },
  {
    videoId: 'OqEC6h7nFfM',
    title: 'Mundian To Bach Ke (The Dhol Club Remix) | Panjabi MC',
    channelTitle: 'Panjabi MC Official',
    thumbnail: 'https://i.ytimg.com/vi/OqEC6h7nFfM/hqdefault.jpg'
  },
  {
    videoId: 'dZ0fwJojhrs',
    title: 'London Thumakda | Queen | Kangana Ranaut | Labh Janjua, Sonu Kakkar, Neha Kakkar',
    channelTitle: 'Zee Music Company',
    thumbnail: 'https://i.ytimg.com/vi/dZ0fwJojhrs/hqdefault.jpg'
  },
  {
    videoId: 'OsUgUoc40wQ',
    title: 'Naatu Naatu | RRR | Ram Charan, Jr NTR | MM Keeravaani',
    channelTitle: 'Lahari Music',
    thumbnail: 'https://i.ytimg.com/vi/OsUgUoc40wQ/hqdefault.jpg'
  },
  {
    videoId: 'D-rT8d1oM5M',
    title: 'Lover | Diljit Dosanjh | Intense | Raj Ranjodh | MoonChild Era',
    channelTitle: 'Diljit Dosanjh',
    thumbnail: 'https://i.ytimg.com/vi/D-rT8d1oM5M/hqdefault.jpg'
  },
  {
    videoId: 'mt9xg0vanLs',
    title: 'Tum Hi Ho | Aashiqui 2 | Arijit Singh',
    channelTitle: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/mt9xg0vanLs/hqdefault.jpg'
  },
  {
    videoId: '5EquExbN6lA',
    title: 'Pasoori | Ali Sethi x Shae Gill | Coke Studio Season 14',
    channelTitle: 'Coke Studio',
    thumbnail: 'https://i.ytimg.com/vi/5EquExbN6lA/hqdefault.jpg'
  },
  {
    videoId: 'V7LwfY5U5WI',
    title: 'Brown Munde | AP Dhillon, Gurinder Gill, Shinda Kahlon',
    channelTitle: 'Run-Up Records',
    thumbnail: 'https://i.ytimg.com/vi/V7LwfY5U5WI/hqdefault.jpg'
  }
];

const initialQueue: QueueTrack[] = [
  {
    id: 'master-1',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    youtube_id: 'YxWlaYCA8MU',
    title: 'Jhoome Jo Pathaan | Shah Rukh Khan, Deepika Padukone | Arijit Singh',
    channel_title: 'YRF',
    thumbnail_url: 'https://i.ytimg.com/vi/YxWlaYCA8MU/hqdefault.jpg',
    requested_by: 'Host / Master Playlist',
    upvotes: 4,
    is_master_list: true,
    status: 'pending'
  },
  {
    id: 'master-2',
    created_at: new Date(Date.now() - 3000000).toISOString(),
    youtube_id: 'kw4tT7SCmaY',
    title: 'Kala Chashma | Baar Baar Dekho | Sidharth M, Katrina K | Badshah, Neha Kakkar',
    channel_title: 'Zee Music Company',
    thumbnail_url: 'https://i.ytimg.com/vi/kw4tT7SCmaY/hqdefault.jpg',
    requested_by: 'Host / Master Playlist',
    upvotes: 6,
    is_master_list: true,
    status: 'pending'
  },
  {
    id: 'guest-req-1',
    created_at: new Date(Date.now() - 1200000).toISOString(),
    youtube_id: 'RLzC55ai0eo',
    title: 'Tauba Tauba | Bad Newz | Vicky Kaushal, Triptii Dimri | Karan Aujla',
    channel_title: 'Saregama Music',
    thumbnail_url: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg',
    requested_by: 'Aman & Friends (Munich)',
    upvotes: 9,
    is_master_list: false,
    status: 'pending',
    client_id: 'client_aman_demo'
  },
  {
    id: 'guest-req-2',
    created_at: new Date(Date.now() - 600000).toISOString(),
    youtube_id: 'OqEC6h7nFfM',
    title: 'Mundian To Bach Ke (The Dhol Club Remix) | Panjabi MC',
    channel_title: 'Panjabi MC Official',
    thumbnail_url: 'https://i.ytimg.com/vi/OqEC6h7nFfM/hqdefault.jpg',
    requested_by: 'Pooja from Frankfurt',
    upvotes: 5,
    is_master_list: false,
    status: 'pending',
    client_id: 'client_pooja_demo'
  }
];

let queue: QueueTrack[] = [...initialQueue];
let playedHistory: PlayedHistoryEntry[] = [];
let adminPin: string = '1234';

// Anti-Spam Tracking Maps
const clientLastRequestTime = new Map<string, number>();
const clientUpvotesMap = new Map<string, Set<string>>(); // clientId -> set of track IDs
// Guest names mapping for leaderboard
const clientNamesMap = new Map<string, string>([
  ['client_aman_demo', 'Aman & Friends (Munich)'],
  ['client_pooja_demo', 'Pooja from Frankfurt']
]);

let globalState = {
  isLocked: false,
  nowPlayingTrackId: null as string | null,
  announcement: null as string | null,
  mvpRevealActive: false, // DJ can activate or reset Top 3 Party MVPs ceremony
  settings: {
    guestCooldownSeconds: 180, // 3 minutes default
    duplicateLockoutMinutes: 30, // 30 minutes lockout
    maxQueueCapacity: 20, // max 20 pending guest tracks
    maxRequestsPerGuest: 2, // max 2 active pending requests per guest
    maxUpvotesPerGuest: 10, // max 10 total upvotes
    profanityFilterEnabled: true,
    autoCleanupPlayed: false,
    peakTimeFastMode: false,
    vibeTagFilter: 'all',
  } as DjSettings
};

// Profanity list covering common vulgarities in English and Hindi/Desi context
const profanityList = [
  'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'bastard',
  'chutiya', 'chutiye', 'bhenchod', 'madarchod', 'gandu', 'harami', 'saala', 'kamina', 'randi', 'lund', 'bhosdike'
];

function sanitizeProfanity(text: string): string {
  if (!text) return text;
  let sanitized = text;
  for (const word of profanityList) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '***');
  }
  return sanitized;
}

// Client Identifier helper (uses x-client-id or fallback to IP)
function getClientIdentifier(req: express.Request): string {
  const headerId = req.headers['x-client-id'] as string;
  if (headerId && headerId.trim().length > 0) {
    return headerId.trim();
  }
  const bodyId = req.body?.client_id;
  if (bodyId && typeof bodyId === 'string' && bodyId.trim().length > 0) {
    return bodyId.trim();
  }
  return (req.ip || req.socket.remoteAddress || 'unknown-client').toString();
}

// Compute Party Leaderboard (Top contributors who got the most upvotes)
function computeLeaderboard(): PartyContributor[] {
  const stats = new Map<string, {
    client_id: string;
    name: string;
    totalUpvotes: number;
    acceptedSongs: number;
    topTrackTitle: string;
    topTrackUpvotes: number;
  }>();

  for (const track of queue) {
    if (track.is_master_list || !track.client_id) continue;
    const cid = track.client_id;
    const guestName = clientNamesMap.get(cid) || track.requested_by || 'Anonymous Guest';

    if (!stats.has(cid)) {
      stats.set(cid, {
        client_id: cid,
        name: guestName,
        totalUpvotes: track.upvotes,
        acceptedSongs: 1,
        topTrackTitle: track.title,
        topTrackUpvotes: track.upvotes,
      });
    } else {
      const existing = stats.get(cid)!;
      existing.totalUpvotes += track.upvotes;
      existing.acceptedSongs += 1;
      if (track.upvotes > existing.topTrackUpvotes) {
        existing.topTrackUpvotes = track.upvotes;
        existing.topTrackTitle = track.title;
      }
    }
  }

  // Sort descending by total upvotes, then by accepted songs
  return Array.from(stats.values()).sort((a, b) => {
    if (b.totalUpvotes !== a.totalUpvotes) {
      return b.totalUpvotes - a.totalUpvotes;
    }
    return b.acceptedSongs - a.acceptedSongs;
  });
}

const emitQueueUpdate = () => {
  io.emit('queue-updated', queue);
  io.emit('leaderboard-updated', computeLeaderboard());
};

const emitStateUpdate = () => {
  io.emit('state-updated', globalState);
};

function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/shorts/')[1].split('/')[0].split('?')[0];
      }
      const v = url.searchParams.get('v');
      if (v && v.length === 11) return v;
    }
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('?')[0].split('/')[0];
      if (id.length === 11) return id;
    }
  } catch {
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(regExp);
    if (match && match[1]) return match[1];
  }
  return null;
}

// === API ROUTES ===

// 1. Get current queue
app.get('/api/queue', (req, res) => {
  res.json(queue);
});

// 2. Resolve link (supports YouTube & YouTube Music)
app.post('/api/resolve-link', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Could not detect a valid YouTube or YouTube Music video ID.' });
  }

  const known = popularTracks.find(t => t.videoId === videoId);
  if (known) {
    return res.json({
      videoId: known.videoId,
      title: known.title,
      channelTitle: known.channelTitle,
      thumbnailUrl: known.thumbnail,
      source: 'curated'
    });
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(3500) });
    if (response.ok) {
      const data = await response.json();
      return res.json({
        videoId,
        title: data.title || `Track (${videoId})`,
        channelTitle: data.author_name || 'YouTube Music Artist',
        thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        source: 'oembed'
      });
    }
  } catch (err) {
    console.warn('oEmbed resolve timed out or failed, using fallback thumbnail & videoId', err);
  }

  return res.json({
    videoId,
    title: `YouTube Track [${videoId}]`,
    channelTitle: 'YouTube / YouTube Music',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    source: 'fallback'
  });
});

// 3. Add to Queue with Advanced Anti-Spam Validation
app.post('/api/queue', (req, res) => {
  if (globalState.isLocked) {
    return res.status(403).json({ error: 'Song requests are currently paused by the DJ.' });
  }

  const clientId = getClientIdentifier(req);
  const now = Date.now();
  const settings = globalState.settings;

  const { 
    youtube_id, 
    title, 
    channel_title, 
    thumbnail_url, 
    requested_by, 
    is_master_list 
  } = req.body;

  if (!youtube_id) {
    return res.status(400).json({ error: 'Missing youtube_id' });
  }

  // A. Max Queue Capacity Constraint (for live guest requests)
  if (!is_master_list) {
    const activeGuestQueueCount = queue.filter(q => q.status === 'pending' && !q.is_master_list).length;
    if (activeGuestQueueCount >= settings.maxQueueCapacity) {
      return res.status(429).json({ 
        error: `Queue is currently full! Limit is ${settings.maxQueueCapacity} pending requests. Please wait for upcoming songs to finish.`
      });
    }

    // B. Per-Guest Cooldown Timer Constraint
    const lastRequest = clientLastRequestTime.get(clientId);
    if (lastRequest) {
      const elapsedSeconds = Math.floor((now - lastRequest) / 1000);
      if (elapsedSeconds < settings.guestCooldownSeconds) {
        const waitLeft = settings.guestCooldownSeconds - elapsedSeconds;
        return res.status(429).json({ 
          error: `Cooldown active: Please wait ${waitLeft} more seconds before submitting another request to give everyone a turn!` 
        });
      }
    }

    // C. Max Active Requests Per Guest Constraint
    const guestPendingCount = queue.filter(q => q.status === 'pending' && q.client_id === clientId).length;
    if (guestPendingCount >= settings.maxRequestsPerGuest) {
      return res.status(429).json({ 
        error: `You already have ${guestPendingCount} song(s) waiting in the queue! Allow other guests a chance before requesting more.` 
      });
    }

    // D. Duplicate Song Lockout Window (Checks active queue and recently played history)
    const existingPending = queue.find(q => q.youtube_id === youtube_id && q.status === 'pending');
    if (existingPending) {
      existingPending.upvotes += 1;
      emitQueueUpdate();
      return res.json({ ...existingPending, alreadyExisted: true });
    }

    const lockoutMs = settings.duplicateLockoutMinutes * 60 * 1000;
    const recentlyPlayed = playedHistory.find(h => h.youtube_id === youtube_id && (now - h.played_at) < lockoutMs);
    if (recentlyPlayed) {
      const minutesAgo = Math.max(1, Math.floor((now - recentlyPlayed.played_at) / 60000));
      return res.status(400).json({ 
        error: `"${recentlyPlayed.title}" was played ${minutesAgo}m ago! Duplicate lockout requires ${settings.duplicateLockoutMinutes}m before replaying.` 
      });
    }
  }

  // E. Profanity Filter Sanitization
  let sanitizedName = (requested_by && requested_by.trim()) ? requested_by.trim() : 'Party Guest';

  if (settings.profanityFilterEnabled) {
    sanitizedName = sanitizeProfanity(sanitizedName);
  }

  // Track name in map for leaderboard
  if (!is_master_list && clientId) {
    clientNamesMap.set(clientId, sanitizedName);
  }

  const newEntry: QueueTrack = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    youtube_id,
    title: title || 'Requested Track',
    channel_title: channel_title || 'YouTube Music',
    thumbnail_url: thumbnail_url || `https://i.ytimg.com/vi/${youtube_id}/hqdefault.jpg`,
    requested_by: sanitizedName,
    upvotes: 1,
    is_master_list: !!is_master_list,
    status: 'pending',
    is_pinned: false,
    client_id: clientId,
  };

  queue.push(newEntry);
  if (!is_master_list) {
    clientLastRequestTime.set(clientId, now);
  }

  // Auto-record upvote for requester
  let upvotesSet = clientUpvotesMap.get(clientId);
  if (!upvotesSet) {
    upvotesSet = new Set<string>();
    clientUpvotesMap.set(clientId, upvotesSet);
  }
  upvotesSet.add(newEntry.id);

  emitQueueUpdate();
  res.json(newEntry);
});

// 4. Upvote with Anti-Spam Constraints
app.post('/api/queue/:id/upvote', (req, res) => {
  const { id } = req.params;
  const clientId = getClientIdentifier(req);
  const settings = globalState.settings;

  let upvotesSet = clientUpvotesMap.get(clientId);
  if (!upvotesSet) {
    upvotesSet = new Set<string>();
    clientUpvotesMap.set(clientId, upvotesSet);
  }

  // Check if client already upvoted this track
  if (upvotesSet.has(id)) {
    return res.status(400).json({ error: 'You have already upvoted this song!' });
  }

  // Check maximum allowed upvotes per guest device
  if (upvotesSet.size >= settings.maxUpvotesPerGuest) {
    return res.status(429).json({ 
      error: `You have reached the maximum allowed limit of ${settings.maxUpvotesPerGuest} upvotes for this event.` 
    });
  }

  const entry = queue.find(q => q.id === id);
  if (entry) {
    entry.upvotes += 1;
    upvotesSet.add(id);
    emitQueueUpdate();
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Track not found in queue' });
  }
});

// 5. Update Status (playing / played)
app.put('/api/queue/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const entry = queue.find(q => q.id === id);

  if (entry) {
    entry.status = status;
    if (status === 'playing') {
      globalState.nowPlayingTrackId = id;
    } else if (status === 'played') {
      entry.played_at = new Date().toISOString();
      playedHistory.push({
        youtube_id: entry.youtube_id,
        title: entry.title,
        played_at: Date.now(),
      });
      if (globalState.nowPlayingTrackId === id) {
        globalState.nowPlayingTrackId = null;
      }
      // Auto-cleanup played tracks if setting is on
      if (globalState.settings.autoCleanupPlayed) {
        queue = queue.filter(q => q.id !== id);
      }
    }
    emitQueueUpdate();
    emitStateUpdate();
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Track not found' });
  }
});

// 6. Delete Track
app.delete('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  if (globalState.nowPlayingTrackId === id) {
    globalState.nowPlayingTrackId = null;
  }
  queue = queue.filter(q => q.id !== id);
  emitQueueUpdate();
  emitStateUpdate();
  res.json({ success: true });
});

// 7. VIP Pin / Unpin Song Toggle (Plays immediately next!)
app.post('/api/queue/:id/pin', (req, res) => {
  const { id } = req.params;
  const entry = queue.find(q => q.id === id);
  if (entry) {
    entry.is_pinned = !entry.is_pinned;
    emitQueueUpdate();
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Track not found' });
  }
});

// 8. Party Leaderboard API (Returns Top Contributors based on total upvotes)
app.get('/api/leaderboard', (req, res) => {
  res.json(computeLeaderboard());
});

// === DJ ADMIN CONTROLS & AUTH ===

// Get Global State & Settings
app.get('/api/state', (req, res) => {
  res.json(globalState);
});

// Verify PIN
app.post('/api/admin/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (pin === adminPin) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Incorrect DJ Passcode' });
});

// Update DJ Settings
app.post('/api/admin/settings', (req, res) => {
  const { pin, settings } = req.body;
  if (pin && pin !== adminPin) {
    return res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
  }

  if (settings && typeof settings === 'object') {
    globalState.settings = {
      ...globalState.settings,
      ...settings,
    };
    emitStateUpdate();
    return res.json(globalState.settings);
  }
  res.status(400).json({ error: 'Invalid settings payload' });
});

// Toggle Lock/Unlock Requests (with alias /api/state/lock)
app.post(['/api/admin/lock', '/api/state/lock'], (req, res) => {
  const { isLocked } = req.body;
  globalState.isLocked = !!isLocked;
  emitStateUpdate();
  res.json(globalState);
});

// DJ Live Stage Announcement (Ticker across /tv, /player, /request)
app.post('/api/admin/announcement', (req, res) => {
  const { pin, announcement } = req.body;
  if (pin && pin !== adminPin) {
    return res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
  }
  globalState.announcement = announcement && typeof announcement === 'string' ? announcement.trim() : null;
  emitStateUpdate();
  res.json({ success: true, announcement: globalState.announcement });
});

// DJ Trigger Top 3 Party MVP Reveal Toggle
app.post('/api/admin/mvp-reveal', (req, res) => {
  const { pin, active } = req.body;
  if (pin && pin !== adminPin) {
    return res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
  }
  globalState.mvpRevealActive = typeof active === 'boolean' ? active : !globalState.mvpRevealActive;
  emitStateUpdate();
  res.json({ success: true, mvpRevealActive: globalState.mvpRevealActive });
});

// Change Admin PIN
app.post('/api/admin/change-pin', (req, res) => {
  const { oldPin, newPin } = req.body;
  if (oldPin !== adminPin) {
    return res.status(401).json({ error: 'Current PIN is incorrect' });
  }
  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
  }
  adminPin = newPin;
  res.json({ success: true, message: 'DJ PIN updated successfully' });
});

// Reset Queue (with alias /api/queue/reset)
app.post(['/api/admin/reset', '/api/queue/reset'], (req, res) => {
  queue = [...initialQueue];
  playedHistory = [];
  clientLastRequestTime.clear();
  clientUpvotesMap.clear();
  globalState.nowPlayingTrackId = null;
  globalState.mvpRevealActive = false;
  emitQueueUpdate();
  emitStateUpdate();
  res.json({ success: true, count: queue.length });
});

// Clear played history to reset duplicate lockout
app.delete('/api/admin/history', (req, res) => {
  playedHistory = [];
  res.json({ success: true, message: 'Played history cleared' });
});

// 9. 3-Tiered Search API (Tier 1: YouTube v3 API -> Tier 2: Invidious Instances -> Tier 3: Local curated + promptUrlPaste)
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  const query = (q as string || '').trim().toLowerCase();

  const directId = extractYouTubeId(query);
  if (directId) {
    const known = popularTracks.find(t => t.videoId === directId);
    if (known) {
      return res.json({
        items: [{
          id: { videoId: known.videoId },
          snippet: {
            title: known.title,
            channelTitle: known.channelTitle,
            thumbnails: { high: { url: known.thumbnail } }
          }
        }],
        source: 'direct_id',
        promptUrlPaste: false
      });
    }
    return res.json({
      items: [{
        id: { videoId: directId },
        snippet: {
          title: `YouTube Video (${directId})`,
          channelTitle: 'YouTube / YouTube Music',
          thumbnails: { high: { url: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg` } }
        }
      }],
      source: 'direct_id',
      promptUrlPaste: false
    });
  }

  // --- TIER 1: Official YouTube Data API v3 ---
  const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (youtubeApiKey && query) {
    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(query)}&key=${youtubeApiKey}`;
      const ytResponse = await fetch(ytUrl, { signal: AbortSignal.timeout(3500) });
      if (ytResponse.ok) {
        const ytData = await ytResponse.json();
        if (ytData.items && ytData.items.length > 0) {
          const items = ytData.items.map((item: any) => ({
            id: { videoId: item.id.videoId },
            snippet: {
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              thumbnails: {
                high: { url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url }
              }
            }
          }));
          return res.json({ items, source: 'youtube_v3', promptUrlPaste: false });
        }
      } else {
        console.warn(`Tier 1 YouTube API responded with status ${ytResponse.status}`);
      }
    } catch (err) {
      console.warn('Tier 1 YouTube API search error, falling back to Tier 2:', err);
    }
  }

  // --- TIER 2: Public Invidious Instances ---
  if (query) {
    const invidiousHosts = [
      'https://yewtu.be',
      'https://invidious.nerdvpn.de',
      'https://inv.nadeko.net'
    ];

    for (const host of invidiousHosts) {
      try {
        const invUrl = `${host}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const invResponse = await fetch(invUrl, { signal: AbortSignal.timeout(3000) });
        if (invResponse.ok) {
          const invData = await invResponse.json();
          if (Array.isArray(invData) && invData.length > 0) {
            const items = invData
              .filter((d: any) => d.videoId)
              .slice(0, 8)
              .map((d: any) => ({
                id: { videoId: d.videoId },
                snippet: {
                  title: d.title,
                  channelTitle: d.author || 'YouTube Artist',
                  thumbnails: {
                    high: { url: d.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${d.videoId}/hqdefault.jpg` }
                  }
                }
              }));
            if (items.length > 0) {
              return res.json({ items, source: 'invidious', promptUrlPaste: false });
            }
          }
        }
      } catch (err) {
        continue;
      }
    }
  }

  // --- TIER 3: Local Curated Catalog with promptUrlPaste banner ---
  const matched = popularTracks.filter(r => 
    !query || 
    r.title.toLowerCase().includes(query) || 
    r.channelTitle.toLowerCase().includes(query)
  );

  const fallbackList = matched.length > 0 ? matched : popularTracks.slice(0, 6);

  const results = fallbackList.map(m => ({
    id: { videoId: m.videoId },
    snippet: {
      title: m.title,
      channelTitle: m.channelTitle,
      thumbnails: { high: { url: m.thumbnail } }
    }
  }));

  return res.json({ 
    items: results, 
    source: 'local_catalog', 
    promptUrlPaste: true,
    message: 'Search is running low on capacity! For best results, copy and paste the exact YouTube / YouTube Music link above.'
  });
});

io.on('connection', (socket) => {
  socket.emit('queue-updated', queue);
  socket.emit('state-updated', globalState);
  socket.emit('leaderboard-updated', computeLeaderboard());

  // Real-time live emoji party reactions from guest phones
  socket.on('send-reaction', (data: { emoji: string; sender?: string }) => {
    io.emit('new-reaction', {
      id: crypto.randomUUID(),
      emoji: data.emoji || '🔥',
      sender: data.sender || 'Guest',
      timestamp: Date.now(),
      xPos: Math.floor(Math.random() * 80) + 10 // randomized horizontal position percentage
    });
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || 3000;

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(join(__dirname, 'dist')));
    app.use('/{*splat}', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      res.sendFile(join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
