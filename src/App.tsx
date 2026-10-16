/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequestPage } from './pages/RequestPage';
import { PlayerPage } from './pages/PlayerPage';
import { DjPage } from './pages/DjPage';
import { TvPage } from './pages/TvPage';
import { Navigation } from './components/Navigation';
import { QueueItem, GlobalState } from './types';
import { socket } from './lib/socket';

const defaultState: GlobalState = {
  isLocked: false,
  nowPlayingTrackId: null,
  settings: {
    guestCooldownSeconds: 180,
    duplicateLockoutMinutes: 30,
    maxQueueCapacity: 20,
    maxRequestsPerGuest: 2,
    maxUpvotesPerGuest: 10,
    profanityFilterEnabled: true,
    autoCleanupPlayed: false,
    peakTimeFastMode: false,
  },
};

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalState, setGlobalState] = useState<GlobalState>(defaultState);

  useEffect(() => {
    // Initial data fetch
    fetch('/api/queue')
      .then((res) => res.json())
      .then(setQueue)
      .catch((err) => console.error('Failed to fetch initial queue:', err));

    fetch('/api/state')
      .then((res) => res.json())
      .then(setGlobalState)
      .catch((err) => console.error('Failed to fetch initial state:', err));

    // Shared Socket event listeners with strict cleanup to prevent leaks
    const handleQueueUpdated = (newQueue: QueueItem[]) => {
      setQueue(newQueue);
    };

    const handleStateUpdated = (newState: GlobalState) => {
      setGlobalState(newState);
    };

    socket.on('queue-updated', handleQueueUpdated);
    socket.on('state-updated', handleStateUpdated);

    return () => {
      socket.off('queue-updated', handleQueueUpdated);
      socket.off('state-updated', handleStateUpdated);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
        {/* Global Navigation Header with 4 Views */}
        <Navigation queue={queue} isLocked={globalState.isLocked} />

        {/* Routed Pages */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/request" replace />} />
            <Route path="/request" element={<RequestPage />} />
            <Route path="/player" element={<PlayerPage />} />
            <Route path="/dj" element={<DjPage />} />
            <Route path="/tv" element={<TvPage />} />
            <Route path="*" element={<Navigate to="/request" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
