import { QueueItem } from '../types';

/**
 * Standard play-order priority sorting across DesiBeats:
 * 1. Pinned VIP tracks first
 * 2. If allowGuestPlayback is true, live guest requests before pre-loaded master tracks
 * 3. Highest upvotes
 * 4. Earliest submission timestamp (FIFO tie-breaker)
 */
export function sortQueue(
  items: QueueItem[], 
  pendingOnly = false, 
  allowGuestPlayback = true
): QueueItem[] {
  let target = pendingOnly ? items.filter((q) => q.status === 'pending') : [...items];

  return target.sort((a, b) => {
    // 1. VIP Pinned tracks first
    const aPinned = !!a.is_pinned;
    const bPinned = !!b.is_pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    // 2. Guest playback toggle rule:
    // If allowGuestPlayback is TRUE, guest requests (!is_master_list) come before master list tracks (is_master_list).
    // If allowGuestPlayback is FALSE, master list tracks (is_master_list) come before guest requests.
    const aMaster = !!a.is_master_list;
    const bMaster = !!b.is_master_list;
    if (aMaster !== bMaster) {
      if (allowGuestPlayback) {
        return aMaster ? 1 : -1; // guest requests first
      } else {
        return aMaster ? -1 : 1; // master list tracks first
      }
    }

    // For Master List tracks, honor DJ drag-and-drop master_order if set
    if (aMaster && bMaster) {
      const aOrder = a.master_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.master_order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }

    // 3. Highest upvoted first
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;

    // 4. Earlier requests first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}
