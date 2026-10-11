export interface QueueItem {
  id: string;
  created_at: string;
  youtube_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  requested_by: string;
  dedication_note: string;
  upvotes: number;
  is_master_list: boolean;
  status: 'pending' | 'playing' | 'played';
  is_pinned?: boolean;
  client_id?: string;
  played_at?: string;
  vibe_tag?: string;
}

export interface DjSettings {
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

export interface GlobalState {
  isLocked: boolean;
  nowPlayingTrackId: string | null;
  announcement?: string | null;
  settings: DjSettings;
}
