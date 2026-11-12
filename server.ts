import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { sortQueue } from './src/lib/queue';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env'), override: true });
dotenv.config({ override: true });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(cookieParser());
app.use(express.json());

// Issue persistent server-managed guest identity cookie (db_cid)
app.use((req, res, next) => {
  let cid = req.cookies?.db_cid;
  if (!cid || typeof cid !== 'string' || !cid.trim()) {
    cid = crypto.randomUUID();
    res.cookie('db_cid', cid, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    if (!req.cookies) req.cookies = {};
    req.cookies.db_cid = cid;
  }
  next();
});

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
  vibe_tag?: string;
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
  fallbackSkipSeconds: number;
  allowGuestPlayback?: boolean;
  maxGuestTrackDurationSeconds?: number;
  masterToRequestSwitchDelaySeconds?: number;
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

interface VideoMetadata {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
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

// Initial Master List tracks (empty by default so user can add songs from scratch)
const initialQueue: QueueTrack[] = [];

let queue: QueueTrack[] = [...initialQueue];
let playedHistory: PlayedHistoryEntry[] = [];

// Server-side DJ Auth & Token Storage
let runtimeDjPin: string | undefined = process.env.DJ_PIN ? String(process.env.DJ_PIN).trim().replace(/^["']|["']$/g, '') : undefined;
const validDjTokens = new Set<string>();

// Rate-limiting for failed PIN attempts (at most 5 wrong attempts per IP per minute)
interface PinAttemptInfo {
  count: number;
  resetAt: number;
}
const pinAttemptMap = new Map<string, PinAttemptInfo>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

function requireDj(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid DJ token' });
  }
  const token = authHeader.slice(7).trim();
  if (!token || !validDjTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
  next();
}

// Anti-Spam Tracking Maps
const clientLastRequestTime = new Map<string, number>();
const clientUpvotesMap = new Map<string, Set<string>>(); // clientId -> set of track IDs
const clientNamesMap = new Map<string, string>();

let globalState = {
  isLocked: false,
  nowPlayingTrackId: null as string | null,
  announcement: null as string | null,
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
    vibeTagFilter: 'all',
    fallbackSkipSeconds: 10,
    allowGuestPlayback: true,
    maxGuestTrackDurationSeconds: 240,
    masterToRequestSwitchDelaySeconds: 10,
  } as DjSettings
};

// Persistence state directory and debounce
// Allows explicit override via DATA_DIR environment variable (e.g., if custom mount path is configured on Render)
const DATA_DIR = process.env.DATA_DIR ? process.env.DATA_DIR.trim() : join(__dirname, 'data');
const STATE_FILE = join(DATA_DIR, 'state.json');
const MASTERLIST_FILE = join(DATA_DIR, 'masterlist.json');
const USER_REQUESTS_FILE = join(DATA_DIR, 'user_requests.json');

console.log(`[Persistence] Initialized with DATA_DIR: ${DATA_DIR}`);

function saveStateSync() {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    // Serialize client upvotes and guest names for persistent state
    const upvotesObj: Record<string, string[]> = {};
    clientUpvotesMap.forEach((set, clientId) => {
      upvotesObj[clientId] = Array.from(set);
    });

    const namesObj: Record<string, string> = {};
    clientNamesMap.forEach((name, clientId) => {
      namesObj[clientId] = name;
    });

    const stateToSave = {
      queue,
      playedHistory: playedHistory.slice(-200),
      globalState,
      clientUpvotesMap: upvotesObj,
      clientNamesMap: namesObj,
    };
    writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2), 'utf-8');

    // Save custom master list tracks so they persist across redeploys
    const masterTracks = queue.filter(q => q.is_master_list);
    writeFileSync(MASTERLIST_FILE, JSON.stringify(masterTracks, null, 2), 'utf-8');

    // Save user/guest requested tracks into dedicated user_requests.json for multi-restart persistence
    const userTracks = queue.filter(q => !q.is_master_list);
    writeFileSync(USER_REQUESTS_FILE, JSON.stringify(userTracks, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Persistence] Failed to write state to disk:', err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function scheduleStateSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveStateSync();
  }, 1000);
}

// Graceful shutdown hooks: Ensure any queued state is synchronously written to the persistent disk on restart/redeploy
process.on('SIGTERM', () => {
  console.log('[Persistence] SIGTERM received. Flushing pending state to disk...');
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveStateSync();
});

process.on('SIGINT', () => {
  console.log('[Persistence] SIGINT received. Flushing pending state to disk...');
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveStateSync();
});

function loadPersistedState() {
  try {
    if (existsSync(STATE_FILE)) {
      const content = readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.queue)) {
        queue = data.queue;
      }
      if (Array.isArray(data.playedHistory)) {
        playedHistory = data.playedHistory.slice(-200);
      }
      if (data.globalState && typeof data.globalState === 'object') {
        globalState = {
          ...globalState,
          ...data.globalState,
          settings: {
            ...globalState.settings,
            ...(data.globalState.settings || {}),
          },
        };
      }
      if (data.clientUpvotesMap && typeof data.clientUpvotesMap === 'object') {
        Object.entries(data.clientUpvotesMap).forEach(([cid, arr]) => {
          if (Array.isArray(arr)) {
            clientUpvotesMap.set(cid, new Set(arr as string[]));
          }
        });
      }
      if (data.clientNamesMap && typeof data.clientNamesMap === 'object') {
        Object.entries(data.clientNamesMap).forEach(([cid, name]) => {
          if (typeof name === 'string') {
            clientNamesMap.set(cid, name);
          }
        });
      }
      console.log(`Loaded persisted state: ${queue.length} tracks in queue, ${playedHistory.length} in history.`);
    }

    // Restore and merge user requested songs from user_requests.json
    if (existsSync(USER_REQUESTS_FILE)) {
      const userContent = readFileSync(USER_REQUESTS_FILE, 'utf-8');
      const savedUserTracks: QueueTrack[] = JSON.parse(userContent);
      if (Array.isArray(savedUserTracks)) {
        savedUserTracks.forEach((t) => {
          if (!queue.some((q) => q.id === t.id)) {
            queue.push(t);
          }
        });
      }
    }

    // Restore and merge masterlist songs from masterlist.json
    if (existsSync(MASTERLIST_FILE)) {
      const masterContent = readFileSync(MASTERLIST_FILE, 'utf-8');
      const savedMasterTracks: QueueTrack[] = JSON.parse(masterContent);
      if (Array.isArray(savedMasterTracks)) {
        savedMasterTracks.forEach((t) => {
          if (!queue.some((q) => q.id === t.id || q.youtube_id === t.youtube_id)) {
            queue.push(t);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not load data files, starting with default queue:', err);
  }
}

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

// Strictly trust server-issued cookie (db_cid)
function getClientIdentifier(req: express.Request): string {
  const cookieId = req.cookies?.db_cid;
  if (cookieId && typeof cookieId === 'string' && cookieId.trim().length > 0) {
    return cookieId.trim();
  }
  return `guest_${getClientIp(req)}`;
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
  scheduleStateSave();
};

const emitStateUpdate = () => {
  io.emit('state-updated', globalState);
  scheduleStateSave();
};

function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const validUrl = (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(validUrl);
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
        if (id && id.length === 11) return id;
      }
      const v = url.searchParams.get('v');
      if (v && v.length === 11) return v;
    }
    if (url.hostname === 'youtu.be' || url.hostname.endsWith('.youtu.be')) {
      const id = url.pathname.slice(1).split('?')[0].split('/')[0];
      if (id.length === 11) return id;
    }
  } catch {}

  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];

  return null;
}

// Shared oEmbed Lookup helper
async function fetchOEmbedMetadata(videoId: string): Promise<VideoMetadata> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(3500) });
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || `Track (${videoId})`,
        channelTitle: data.author_name || 'YouTube Music Artist',
        thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch (err) {
    console.warn(`oEmbed lookup for video ${videoId} timed out or failed:`, err);
  }
  return {
    title: `YouTube Track [${videoId}]`,
    channelTitle: 'YouTube / YouTube Music',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

// In-memory cache for remembered song metadata from search results
const rememberedMetadata = new Map<string, VideoMetadata>();
for (const track of popularTracks) {
  rememberedMetadata.set(track.videoId, {
    title: track.title,
    channelTitle: track.channelTitle,
    thumbnailUrl: track.thumbnail,
  });
}

// In-memory cache for search results (6 hours TTL)
interface SearchCacheEntry {
  data: any;
  timestamp: number;
}
const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_TTL = 6 * 60 * 60 * 1000;

// Daily quota tracking for YouTube Data API search calls
let currentSearchDay = new Date().toISOString().slice(0, 10);
let youtubeSearchCountToday = 0;

// Resolve song metadata in 3-tier order:
// 1. Remembered from search results
// 2. Curated catalog
// 3. Shared oEmbed lookup
async function resolveSongMetadata(videoId: string): Promise<VideoMetadata> {
  if (rememberedMetadata.has(videoId)) {
    return rememberedMetadata.get(videoId)!;
  }
  const known = popularTracks.find((t) => t.videoId === videoId);
  if (known) {
    const meta = {
      title: known.title,
      channelTitle: known.channelTitle,
      thumbnailUrl: known.thumbnail,
    };
    rememberedMetadata.set(videoId, meta);
    return meta;
  }
  const oembed = await fetchOEmbedMetadata(videoId);
  rememberedMetadata.set(videoId, oembed);
  return oembed;
}

// Shared upvote logic (enforces limit, already-upvoted check, and pending-only rule)
function performUpvote(trackId: string, clientId: string): { success: boolean; status?: number; error?: string; entry?: QueueTrack } {
  const entry = queue.find((q) => q.id === trackId);
  if (!entry) {
    return { success: false, status: 404, error: 'Track not found in queue' };
  }

  // Refuse upvotes on tracks that are not pending
  if (entry.status !== 'pending') {
    return { success: false, status: 400, error: 'Cannot upvote songs that are not pending in queue' };
  }

  let upvotesSet = clientUpvotesMap.get(clientId);
  if (!upvotesSet) {
    upvotesSet = new Set<string>();
    clientUpvotesMap.set(clientId, upvotesSet);
  }

  if (upvotesSet.has(trackId)) {
    return { success: false, status: 400, error: 'You have already upvoted this song!' };
  }

  const settings = globalState.settings;
  if (upvotesSet.size >= settings.maxUpvotesPerGuest) {
    return {
      success: false,
      status: 429,
      error: `You have reached the maximum allowed limit of ${settings.maxUpvotesPerGuest} upvotes for this event.`
    };
  }

  entry.upvotes += 1;
  upvotesSet.add(trackId);
  return { success: true, entry };
}

// In-memory cache for SponsorBlock skipSegments results (caches raw SponsorBlock data only)
interface SponsorBlockCacheEntry {
  segments: any[];
  timestamp: number;
}
const sponsorBlockCache = new Map<string, SponsorBlockCacheEntry>();

async function getSponsorSegments(videoId: string): Promise<any[]> {
  if (sponsorBlockCache.has(videoId)) {
    return sponsorBlockCache.get(videoId)!.segments;
  }
  try {
    const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&category=music_offtopic`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        sponsorBlockCache.set(videoId, { segments: data, timestamp: Date.now() });
        return data;
      }
    }
  } catch {
    // 404, timeout or network issue
  }
  sponsorBlockCache.set(videoId, { segments: [], timestamp: Date.now() });
  return [];
}

// === API ROUTES ===

// 0. Guest identity info endpoint
app.get('/api/me', (req, res) => {
  res.json({ clientId: getClientIdentifier(req) });
});

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

  const meta = await resolveSongMetadata(videoId);
  res.json({
    videoId,
    title: meta.title,
    channelTitle: meta.channelTitle,
    thumbnailUrl: meta.thumbnailUrl,
    source: rememberedMetadata.has(videoId) ? 'cached' : 'oembed',
  });
});

// 3. Add to Queue (Server resolves metadata, trims name to 30 chars, applies profanity filter, handles duplicate-request upvote loophole)
app.post('/api/queue', async (req, res) => {
  if (globalState.isLocked) {
    return res.status(403).json({ error: 'Song requests are currently paused by the DJ.' });
  }

  const clientId = getClientIdentifier(req);
  const now = Date.now();
  const settings = globalState.settings;

  const rawId = req.body?.youtube_id || req.body?.url;
  const videoId = extractYouTubeId(rawId);
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid or missing YouTube video ID' });
  }

  const isMaster = !!req.body?.is_master_list;

  if (!isMaster) {
    // A. Max Queue Capacity Constraint (for live guest requests)
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

    // D. Duplicate Song Check:
    // If already pending, route through the exact same logic as normal upvote endpoint
    const existingPending = queue.find(q => q.youtube_id === videoId && q.status === 'pending');
    if (existingPending) {
      const upvoteRes = performUpvote(existingPending.id, clientId);
      if (!upvoteRes.success) {
        return res.status(upvoteRes.status || 400).json({ error: upvoteRes.error });
      }
      // Apply cooldown to duplicate requests as well
      clientLastRequestTime.set(clientId, now);
      emitQueueUpdate();
      return res.json({ ...existingPending, alreadyExisted: true });
    }

    // Check duplicate lockout against recently played history
    const lockoutMs = settings.duplicateLockoutMinutes * 60 * 1000;
    const recentlyPlayed = playedHistory.find(h => h.youtube_id === videoId && (now - h.played_at) < lockoutMs);
    if (recentlyPlayed) {
      const minutesAgo = Math.max(1, Math.floor((now - recentlyPlayed.played_at) / 60000));
      return res.status(400).json({ 
        error: `"${recentlyPlayed.title}" was played ${minutesAgo}m ago! Duplicate lockout requires ${settings.duplicateLockoutMinutes}m before replaying.` 
      });
    }
  }

  // E. Name validation: Trim to 30 characters and run profanity filter
  let rawName = (req.body?.requested_by || '').toString().trim();
  if (rawName.length > 30) {
    rawName = rawName.slice(0, 30).trim();
  }
  let sanitizedName = rawName || 'Party Guest';
  if (settings.profanityFilterEnabled) {
    sanitizedName = sanitizeProfanity(sanitizedName);
  }

  if (!isMaster && clientId) {
    clientNamesMap.set(clientId, sanitizedName);
  }

  // F. Server looks up song metadata itself
  const metadata = await resolveSongMetadata(videoId);

  const newEntry: QueueTrack = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    youtube_id: videoId,
    title: metadata.title,
    channel_title: metadata.channelTitle,
    thumbnail_url: metadata.thumbnailUrl,
    requested_by: sanitizedName,
    upvotes: 1,
    is_master_list: isMaster,
    status: 'pending',
    is_pinned: false,
    client_id: clientId,
  };

  queue.push(newEntry);
  if (!isMaster) {
    clientLastRequestTime.set(clientId, now);
  }

  // Auto-record initial upvote for requester
  let upvotesSet = clientUpvotesMap.get(clientId);
  if (!upvotesSet) {
    upvotesSet = new Set<string>();
    clientUpvotesMap.set(clientId, upvotesSet);
  }
  upvotesSet.add(newEntry.id);

  emitQueueUpdate();
  res.json(newEntry);
});

// 4. Upvote with Anti-Spam Constraints (refuses non-pending tracks)
app.post('/api/queue/:id/upvote', (req, res) => {
  const id = String(req.params.id);
  const clientId = getClientIdentifier(req);
  const result = performUpvote(id, clientId);
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  emitQueueUpdate();
  res.json(result.entry);
});

// 5. Update Status (playing / played) - DJ ONLY
app.put('/api/queue/:id/status', requireDj, (req, res) => {
  const id = String(req.params.id);
  const { status } = req.body;
  const entry = queue.find(q => q.id === id);

  if (entry) {
    if (status === 'playing') {
      const now = Date.now();
      // Ensure all other tracks marked 'playing' are transitioned to 'played'
      queue.forEach(q => {
        if (q.id !== id && q.status === 'playing') {
          q.status = 'played';
          q.played_at = new Date().toISOString();
          playedHistory.push({
            youtube_id: q.youtube_id,
            title: q.title,
            played_at: now,
          });
        }
      });
      entry.status = 'playing';
      globalState.nowPlayingTrackId = id;
      io.emit('track-playing-changed', { track: entry });
    } else if (status === 'played') {
      entry.status = 'played';
      entry.played_at = new Date().toISOString();
      playedHistory.push({
        youtube_id: entry.youtube_id,
        title: entry.title,
        played_at: Date.now(),
      });
      if (playedHistory.length > 200) {
        playedHistory = playedHistory.slice(-200);
      }
      if (globalState.nowPlayingTrackId === id) {
        globalState.nowPlayingTrackId = null;
      }
      if (globalState.settings.autoCleanupPlayed) {
        queue = queue.filter(q => q.id !== id);
      }
    } else {
      entry.status = status;
    }
    scheduleStateSave();
    emitQueueUpdate();
    emitStateUpdate();
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Track not found' });
  }
});

// 6. Delete Track - DJ ONLY
app.delete('/api/queue/:id', requireDj, (req, res) => {
  const id = String(req.params.id);
  if (globalState.nowPlayingTrackId === id) {
    globalState.nowPlayingTrackId = null;
  }
  queue = queue.filter(q => q.id !== id);
  emitQueueUpdate();
  emitStateUpdate();
  res.json({ success: true });
});

// Restore Track - DJ ONLY (Undo functionality)
app.post('/api/queue/restore', requireDj, (req, res) => {
  const { track } = req.body;
  if (!track || !track.id) {
    return res.status(400).json({ error: 'Missing track to restore' });
  }
  const exists = queue.some(q => q.id === track.id);
  if (!exists) {
    queue.push(track);
    emitQueueUpdate();
    emitStateUpdate();
  }
  res.json({ success: true, track });
});

// 7. VIP Pin / Unpin Song Toggle - DJ ONLY
app.post(['/api/queue/:id/pin', '/api/queue/:id/pin/toggle'], requireDj, (req, res) => {
  const id = String(req.params.id);
  const entry = queue.find(q => q.id === id);
  if (entry) {
    entry.is_pinned = !entry.is_pinned;
    emitQueueUpdate();
    res.json(entry);
  } else {
    res.status(404).json({ error: 'Track not found' });
  }
});

// 8. Party Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  res.json(computeLeaderboard());
});

// === SERVER-AUTHORITATIVE TRACK ADVANCE & PRELOAD ===

// POST /api/player/advance (DJ only): Marks current track played, picks next using sortQueue or targetTrackId, marks it playing, and returns it
app.post('/api/player/advance', requireDj, (req, res) => {
  const now = Date.now();
  const { targetTrackId } = req.body || {};

  if (globalState.nowPlayingTrackId) {
    const current = queue.find(q => q.id === globalState.nowPlayingTrackId);
    if (current && current.status === 'playing') {
      current.status = 'played';
      current.played_at = new Date().toISOString();
      playedHistory.push({
        youtube_id: current.youtube_id,
        title: current.title,
        played_at: now,
      });
      if (playedHistory.length > 200) {
        playedHistory = playedHistory.slice(-200);
      }
      if (globalState.settings.autoCleanupPlayed) {
        queue = queue.filter(q => q.id !== current.id);
      }
    }
  }

  // If a specific targetTrackId is requested (e.g. from seamless crossfade preload), use it if valid
  let nextTrack: QueueTrack | undefined;
  if (targetTrackId) {
    nextTrack = queue.find(q => q.id === targetTrackId && q.status === 'pending');
  }

  const allowGuest = globalState.settings.allowGuestPlayback !== false;

  if (!nextTrack) {
    const pending = sortQueue(queue, true, allowGuest);
    if (pending.length > 0) {
      nextTrack = pending[0];
    }
  }

  if (nextTrack) {
    nextTrack.status = 'playing';
    globalState.nowPlayingTrackId = nextTrack.id;
    io.emit('track-playing-changed', { track: nextTrack });
    scheduleStateSave();
    emitQueueUpdate();
    emitStateUpdate();
    return res.json({ track: nextTrack });
  }

  globalState.nowPlayingTrackId = null;
  io.emit('track-playing-changed', { track: null });
  scheduleStateSave();
  emitQueueUpdate();
  emitStateUpdate();
  res.json({ track: null });
});

// POST /api/queue/play-item (DJ only): Immediately play any song (from Running Order, Played History, Master List, etc.)
app.post('/api/queue/play-item', requireDj, (req, res) => {
  const { trackId, track: clientTrack } = req.body || {};
  const now = Date.now();

  let target = queue.find(q => q.id === trackId || (clientTrack && q.id === clientTrack.id));
  if (!target && clientTrack && clientTrack.youtube_id) {
    target = queue.find(q => q.youtube_id === clientTrack.youtube_id);
  }

  // If not found in live queue, reconstruct/re-add from client track or playedHistory
  if (!target && clientTrack && clientTrack.youtube_id) {
    target = {
      id: clientTrack.id || `replayed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      youtube_id: clientTrack.youtube_id,
      title: clientTrack.title || 'Replayed Track',
      channel_title: clientTrack.channel_title || 'Replay',
      thumbnail_url: clientTrack.thumbnail_url || `https://i.ytimg.com/vi/${clientTrack.youtube_id}/hqdefault.jpg`,
      requested_by: clientTrack.requested_by || 'DJ Replay',
      upvotes: clientTrack.upvotes || 1,
      is_master_list: !!clientTrack.is_master_list,
      status: 'pending',
    };
    queue.push(target);
  }

  if (target) {
    // Mark previous playing track as played
    queue.forEach(q => {
      if (q.id !== target!.id && q.status === 'playing') {
        q.status = 'played';
        q.played_at = new Date().toISOString();
        playedHistory.push({
          youtube_id: q.youtube_id,
          title: q.title,
          played_at: now,
        });
      }
    });

    target.status = 'playing';
    target.played_at = undefined;
    globalState.nowPlayingTrackId = target.id;
    scheduleStateSave();
    emitQueueUpdate();
    emitStateUpdate();
    io.emit('track-playing-changed', { track: target });
    return res.json({ success: true, track: target });
  }

  return res.status(404).json({ error: 'Track not found to play' });
});

// POST /api/admin/masterlist (DJ only): Add a song to the master list (persisted across restarts and redeploys)
app.post(['/api/admin/masterlist', '/api/masterlist'], requireDj, async (req, res) => {
  const { query, youtube_id, videoId, title, channel_title, thumbnail_url, urlOrId, url } = req.body || {};
  const rawInput = (urlOrId || url || query || youtube_id || videoId || '').toString().trim();

  let yId = youtube_id || videoId;
  let tTitle = title;
  let cTitle = channel_title;
  let tThumb = thumbnail_url;

  if (rawInput) {
    const extracted = extractYouTubeId(rawInput);
    if (extracted) {
      yId = extracted;
    }
  }

  if (yId) {
    const meta = await resolveSongMetadata(yId);
    tTitle = tTitle || meta.title;
    cTitle = cTitle || meta.channelTitle;
    tThumb = tThumb || meta.thumbnailUrl;
  }

  if (!yId || !tTitle) {
    return res.status(400).json({ error: 'Valid YouTube URL, Video ID, or Song Title is required.' });
  }

  const newMasterTrack: QueueTrack = {
    id: `master-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
    youtube_id: yId,
    title: tTitle,
    channel_title: cTitle || 'Master Catalog',
    thumbnail_url: tThumb || `https://i.ytimg.com/vi/${yId}/hqdefault.jpg`,
    requested_by: 'Host / Master Playlist',
    upvotes: 0,
    is_master_list: true,
    status: 'pending',
  };

  queue.push(newMasterTrack);
  scheduleStateSave();
  emitQueueUpdate();
  emitStateUpdate();

  res.json({
    success: true,
    item: newMasterTrack,
    track: newMasterTrack,
    message: 'Song added to Master List and persisted across redeploys!'
  });
});

// POST /api/queue/restart-playlist (DJ only): Restarts playlist from played history (includes both masterlist and requested songs)
app.post('/api/queue/restart-playlist', requireDj, (req, res) => {
  const restartedTracks: QueueTrack[] = [];

  // 1. Reset all tracks currently in queue that have status 'played'
  queue.forEach(t => {
    if (t.status === 'played') {
      t.status = 'pending';
      t.played_at = undefined;
      restartedTracks.push(t);
    }
  });

  // 2. If queue was emptied or lacks played tracks, recreate from playedHistory or initial master list
  if (restartedTracks.length === 0 && queue.filter(q => q.status === 'pending').length === 0) {
    if (playedHistory.length > 0) {
      const recreated: QueueTrack[] = playedHistory.map((item, idx) => ({
        id: `restarted-${idx}-${Date.now()}`,
        created_at: new Date().toISOString(),
        youtube_id: item.youtube_id,
        title: item.title,
        channel_title: 'DesiBeats Replay',
        thumbnail_url: `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`,
        requested_by: 'Party Replay',
        upvotes: 1,
        is_master_list: true,
        status: 'pending' as const,
      }));
      queue.push(...recreated);
      restartedTracks.push(...recreated);
    } else {
      // Re-seed original catalog
      queue = [...initialQueue];
      restartedTracks.push(...queue);
    }
  }

  // 3. Clear duplicate lockout history for fresh setlist rotation
  playedHistory = [];

  // 4. If nothing is currently playing, start the first track in the restarted queue immediately
  let nowPlayingTrack: QueueTrack | null = null;
  const allowGuest = globalState.settings.allowGuestPlayback !== false;
  const pending = sortQueue(queue, true, allowGuest);
  if (pending.length > 0 && !globalState.nowPlayingTrackId) {
    const first = pending[0];
    first.status = 'playing';
    globalState.nowPlayingTrackId = first.id;
    nowPlayingTrack = first;
  }

  scheduleStateSave();
  emitQueueUpdate();
  emitStateUpdate();

  if (nowPlayingTrack) {
    io.emit('track-playing-changed', { track: nowPlayingTrack });
  }

  res.json({
    success: true,
    count: restartedTracks.length,
    currentTrack: nowPlayingTrack,
    message: `Playlist restarted with ${restartedTracks.length} songs from history.`
  });
});

// GET /api/player/upcoming (DJ only): Returns track that would play next without changing anything
app.get('/api/player/upcoming', requireDj, (req, res) => {
  const allowGuest = globalState.settings.allowGuestPlayback !== false;
  const pending = sortQueue(queue, true, allowGuest);
  res.json({ track: pending.length > 0 ? pending[0] : null });
});

// GET /api/skip-info/:videoId: SponsorBlock music_offtopic integration with fallback
app.get('/api/skip-info/:videoId', async (req, res) => {
  const videoId = String(req.params.videoId);
  const segments = await getSponsorSegments(videoId);
  const fallback = globalState.settings.fallbackSkipSeconds ?? 10;

  let startSeconds = fallback;
  let source: 'community' | 'fallback' = 'fallback';

  // Check if a music_offtopic segment starts within the first 5 seconds
  const introSegment = segments.find((s: any) => Array.isArray(s.segment) && s.segment[0] <= 5);
  if (introSegment && introSegment.segment[1] > 0) {
    startSeconds = Math.round(introSegment.segment[1]);
    source = 'community';
  }

  // Check if a music_offtopic segment runs to the end of the video
  let endSeconds: number | undefined = undefined;
  const outroSegment = segments.find((s: any) => {
    if (!Array.isArray(s.segment)) return false;
    const [, end] = s.segment;
    if (s.videoDuration && s.videoDuration > 0) {
      return end >= s.videoDuration - 3;
    }
    return false;
  });

  if (outroSegment) {
    endSeconds = Math.round(outroSegment.segment[0]);
  }

  res.json({
    videoId,
    startSeconds,
    endSeconds,
    source,
  });
});

// === DJ ADMIN CONTROLS & AUTH ===

// Get Global State & Settings
app.get('/api/state', (req, res) => {
  res.json(globalState);
});

// Verify PIN: Read from DJ_PIN environment variable, at most 5 failed attempts per IP per minute, returns session token
app.post('/api/admin/verify-pin', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  let attempt = pinAttemptMap.get(ip);
  if (!attempt || now > attempt.resetAt) {
    attempt = { count: 0, resetAt: now + 60 * 1000 };
    pinAttemptMap.set(ip, attempt);
  }

  if (attempt.count >= 5) {
    const secondsLeft = Math.max(1, Math.ceil((attempt.resetAt - now) / 1000));
    return res.status(429).json({ 
      error: `Too many failed PIN attempts. Please wait ${secondsLeft}s before trying again.` 
    });
  }

  if (!runtimeDjPin) {
    console.error('DJ_PIN environment variable is not configured.');
    return res.status(500).json({ error: 'DJ_PIN is not configured on the server environment.' });
  }

  const cleanPin = String(req.body?.pin || '').trim();
  const cleanExpectedPin = String(runtimeDjPin || process.env.DJ_PIN || '').trim().replace(/^["']|["']$/g, '');

  if (cleanPin && cleanExpectedPin && cleanPin === cleanExpectedPin) {
    pinAttemptMap.delete(ip);
    const token = crypto.randomUUID();
    validDjTokens.add(token);
    return res.json({ success: true, token });
  }

  attempt.count += 1;
  return res.status(401).json({ error: 'Incorrect DJ Passcode' });
});

// Update DJ Settings - DJ ONLY
app.post(['/api/admin/settings', '/api/settings'], requireDj, (req, res) => {
  const { settings } = req.body;
  if (settings && typeof settings === 'object') {
    if (typeof settings.fallbackSkipSeconds === 'number') {
      settings.fallbackSkipSeconds = Math.max(0, Math.min(60, Math.round(settings.fallbackSkipSeconds)));
    }
    if (typeof settings.maxGuestTrackDurationSeconds === 'number') {
      settings.maxGuestTrackDurationSeconds = Math.max(0, Math.min(1800, Math.round(settings.maxGuestTrackDurationSeconds)));
    }
    if (typeof settings.masterToRequestSwitchDelaySeconds === 'number') {
      settings.masterToRequestSwitchDelaySeconds = Math.max(0, Math.min(60, Math.round(settings.masterToRequestSwitchDelaySeconds)));
    }
    if (typeof settings.allowGuestPlayback === 'boolean') {
      settings.allowGuestPlayback = settings.allowGuestPlayback;
    }

    globalState.settings = {
      ...globalState.settings,
      ...settings,
    };
    scheduleStateSave();
    emitStateUpdate();
    emitQueueUpdate();
    return res.json(globalState.settings);
  }
  res.status(400).json({ error: 'Invalid settings payload' });
});

// Toggle Lock/Unlock Requests - DJ ONLY
app.post(['/api/admin/lock', '/api/state/lock', '/api/queue/lock'], requireDj, (req, res) => {
  const { isLocked } = req.body;
  globalState.isLocked = !!isLocked;
  emitStateUpdate();
  res.json(globalState);
});

// DJ Live Stage Announcement - DJ ONLY
app.post(['/api/admin/announcement', '/api/announcement'], requireDj, (req, res) => {
  const { announcement } = req.body;
  globalState.announcement = announcement && typeof announcement === 'string' ? announcement.trim() : null;
  emitStateUpdate();
  res.json({ success: true, announcement: globalState.announcement });
});

// DJ Trigger Top 3 Party MVP Reveal Toggle - DJ ONLY
app.post('/api/admin/mvp-reveal', requireDj, (req, res) => {
  const { active } = req.body;
  globalState.mvpRevealActive = typeof active === 'boolean' ? active : !globalState.mvpRevealActive;
  emitStateUpdate();
  res.json({ success: true, mvpRevealActive: globalState.mvpRevealActive });
});

// Change Admin PIN - DJ ONLY
app.post('/api/admin/change-pin', requireDj, (req, res) => {
  const { newPin } = req.body;
  if (!newPin || String(newPin).trim().length < 4) {
    return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
  }
  runtimeDjPin = String(newPin).trim();
  res.json({ success: true, message: 'DJ PIN updated successfully' });
});

// Reset Queue - DJ ONLY (Clears queue completely to empty array and wipes persistent files)
app.post(['/api/admin/reset', '/api/queue/reset'], requireDj, (req, res) => {
  queue = [];
  playedHistory = [];
  clientLastRequestTime.clear();
  clientUpvotesMap.clear();
  globalState.nowPlayingTrackId = null;
  globalState.mvpRevealActive = false;

  try {
    if (existsSync(STATE_FILE)) {
      writeFileSync(STATE_FILE, JSON.stringify({ queue: [], playedHistory: [], globalState }, null, 2), 'utf-8');
    }
    if (existsSync(MASTERLIST_FILE)) {
      writeFileSync(MASTERLIST_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (existsSync(USER_REQUESTS_FILE)) {
      writeFileSync(USER_REQUESTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch {}

  emitQueueUpdate();
  emitStateUpdate();
  res.json({ success: true, count: 0, message: 'Queue completely cleared. Add songs from scratch!' });
});

// Clear played history to reset duplicate lockout - DJ ONLY
app.delete(['/api/admin/history', '/api/history/clear'], requireDj, (req, res) => {
  playedHistory = [];
  scheduleStateSave();
  res.json({ success: true, message: 'Played history cleared' });
});

// 9. Search API: Cached with 6-hr memory, quota daily tracking, remembers video metadata in Map
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  const query = (q as string || '').trim().toLowerCase();

  const directId = extractYouTubeId(query);
  if (directId) {
    const meta = await resolveSongMetadata(directId);
    return res.json({
      items: [{
        id: { videoId: directId },
        snippet: {
          title: meta.title,
          channelTitle: meta.channelTitle,
          thumbnails: { high: { url: meta.thumbnailUrl } }
        }
      }],
      source: 'direct_id',
      promptUrlPaste: false
    });
  }

  // Check 6-hour memory cache
  const cached = searchCache.get(query);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < SEARCH_CACHE_TTL) {
    return res.json(cached.data);
  }

  // --- TIER 1: Official YouTube Data API v3 ---
  const youtubeApiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (youtubeApiKey && query) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== currentSearchDay) {
        currentSearchDay = today;
        youtubeSearchCountToday = 0;
      }
      youtubeSearchCountToday++;
      console.log(`[YouTube API] Search call #${youtubeSearchCountToday} today for "${query}"`);

      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(query)}&key=${youtubeApiKey}`;
      const ytResponse = await fetch(ytUrl, { signal: AbortSignal.timeout(3500) });
      if (ytResponse.ok) {
        const ytData = await ytResponse.json();
        if (ytData.items && ytData.items.length > 0) {
          const items = ytData.items.map((item: any) => {
            const vId = item.id.videoId;
            const title = item.snippet.title;
            const channelTitle = item.snippet.channelTitle;
            const thumbnailUrl = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
            // Remember metadata in Map for subsequent requests
            rememberedMetadata.set(vId, { title, channelTitle, thumbnailUrl });
            return {
              id: { videoId: vId },
              snippet: {
                title,
                channelTitle,
                thumbnails: { high: { url: thumbnailUrl } }
              }
            };
          });
          const responsePayload = { items, source: 'youtube_v3', promptUrlPaste: false };
          searchCache.set(query, { data: responsePayload, timestamp: now });
          return res.json(responsePayload);
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
              .map((d: any) => {
                const vId = d.videoId;
                const title = d.title;
                const channelTitle = d.author || 'YouTube Artist';
                const thumbnailUrl = d.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
                rememberedMetadata.set(vId, { title, channelTitle, thumbnailUrl });
                return {
                  id: { videoId: vId },
                  snippet: {
                    title,
                    channelTitle,
                    thumbnails: { high: { url: thumbnailUrl } }
                  }
                };
              });
            if (items.length > 0) {
              const responsePayload = { items, source: 'invidious', promptUrlPaste: false };
              searchCache.set(query, { data: responsePayload, timestamp: now });
              return res.json(responsePayload);
            }
          }
        }
      } catch {
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

  const results = fallbackList.map(m => {
    rememberedMetadata.set(m.videoId, {
      title: m.title,
      channelTitle: m.channelTitle,
      thumbnailUrl: m.thumbnail,
    });
    return {
      id: { videoId: m.videoId },
      snippet: {
        title: m.title,
        channelTitle: m.channelTitle,
        thumbnails: { high: { url: m.thumbnail } }
      }
    };
  });

  const responsePayload = { 
    items: results, 
    source: 'local_catalog', 
    promptUrlPaste: true,
    message: 'Search is running low on capacity! For best results, copy and paste the exact YouTube / YouTube Music link above.'
  };
  searchCache.set(query, { data: responsePayload, timestamp: now });
  return res.json(responsePayload);
});

// Socket connection
io.on('connection', (socket) => {
  socket.emit('queue-updated', queue);
  socket.emit('state-updated', globalState);
  socket.emit('leaderboard-updated', computeLeaderboard());

  // Real-time live emoji reactions from guests
  socket.on('send-reaction', (data: { emoji: string; sender?: string }) => {
    io.emit('new-reaction', {
      id: crypto.randomUUID(),
      emoji: data.emoji || '🔥',
      sender: data.sender || 'Guest',
      timestamp: Date.now(),
    });
  });
});

async function startServer() {
  loadPersistedState();

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
