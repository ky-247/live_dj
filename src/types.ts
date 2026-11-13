export interface QueueItem {
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
  master_order?: number;
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
  fallbackSkipSeconds: number;
  allowGuestPlayback: boolean; // Controls whether guest requested list is played or only master list
  maxGuestTrackDurationSeconds: number; // Max seconds a guest request can play before advancing (0 = no limit; does NOT apply to master list)
  maxMasterTrackDurationSeconds: number; // Max seconds a master list track <= 10 mins can play (0 = no limit; tracks > 10 mins always play in full)
  masterToRequestSwitchDelaySeconds: number; // Delay in seconds before switching from master track to newly arrived guest request
}

export interface PartyContributor {
  client_id: string;
  name: string;
  totalUpvotes: number;
  acceptedSongs: number;
  topTrackTitle: string;
  topTrackUpvotes: number;
}

export interface GlobalState {
  isLocked: boolean;
  nowPlayingTrackId: string | null;
  announcement?: string | null;
  settings: DjSettings;
  mvpRevealActive?: boolean; // DJ activates Party MVP Top 3 reveal at end of event
}
