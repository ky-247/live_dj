import { QueueItem } from '../types';

/**
 * Standard play-order priority sorting across DesiBeats:
 * 1. Pinned VIP tracks first
 * 2. Live guest requests before master fallback tracks
 * 3. Highest upvotes
 * 4. Earliest submission timestamp (FIFO tie-breaker)
 */
export function sortQueue(items: QueueItem[], pendingOnly = false): QueueItem[] {
  const target = pendingOnly ? items.filter((q) => q.status === 'pending') : [...items];
  return target.sort((a, b) => {
    // 1. VIP Pinned tracks first
    const aPinned = !!a.is_pinned;
    const bPinned = !!b.is_pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    // 2. Live guest requests before pre-loaded master tracks
    const aMaster = !!a.is_master_list;
    const bMaster = !!b.is_master_list;
    if (aMaster !== bMaster) return aMaster ? 1 : -1;

    // 3. Highest upvoted first
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;

    // 4. Earlier requests first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}
