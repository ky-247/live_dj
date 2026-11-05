import React, { createElement, useState, useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { QueueItem } from '../types';

export interface SkipInfo {
  videoId: string;
  startSeconds: number;
  endSeconds?: number;
  source: 'community' | 'fallback';
}

interface UseCrossfadePlayerOptions {
  token: string | null;
  onUnauthorized?: () => void;
  queue: QueueItem[];
}

export function useCrossfadePlayer({ token, onUnauthorized, queue }: UseCrossfadePlayerOptions) {
  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [upcomingTrack, setUpcomingTrack] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [skipInfoLabel, setSkipInfoLabel] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Player references and readiness
  const playerARef = useRef<any>(null);
  const playerBRef = useRef<any>(null);
  const playerAState = useRef<number>(-1);
  const playerBState = useRef<number>(-1);
  const isReadyA = useRef<boolean>(false);
  const isReadyB = useRef<boolean>(false);

  // Crossfade and session trackers
  const isCrossfadingRef = useRef<boolean>(false);
  const isFirstSessionTrackRef = useRef<boolean>(true);
  const activeSkipInfoRef = useRef<SkipInfo | null>(null);
  const upcomingSkipInfoRef = useRef<SkipInfo | null>(null);

  // Active fade intervals
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getTargetVolume = useCallback(() => (isMuted ? 0 : volume), [isMuted, volume]);

  const getActiveInstance = useCallback(() => {
    return activePlayer === 'A' ? playerARef.current : playerBRef.current;
  }, [activePlayer]);

  const getIdleInstance = useCallback(() => {
    return activePlayer === 'A' ? playerBRef.current : playerARef.current;
  }, [activePlayer]);

  const clearFades = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  // Fetch skip info from server
  const fetchSkipInfo = useCallback(async (videoId: string): Promise<SkipInfo> => {
    try {
      const res = await fetch(`/api/skip-info/${videoId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Failed to fetch skip info for', videoId, err);
    }
    return { videoId, startSeconds: 10, source: 'fallback' };
  }, []);

  // Authorized DJ fetch helper
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...((options.headers as Record<string, string>) || {}),
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return res;
  }, [token, onUnauthorized]);

  // Preload upcoming track into idle player
  const preloadUpcoming = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/player/upcoming');
      if (!res.ok) return;
      const data = await res.json();
      const nextTrack: QueueItem | null = data.track;
      setUpcomingTrack(nextTrack);

      if (nextTrack) {
        const info = await fetchSkipInfo(nextTrack.youtube_id);
        upcomingSkipInfoRef.current = info;
        const idle = getIdleInstance();
        if (idle) {
          try {
            idle.mute();
            idle.setVolume(0);
            idle.cueVideoById({
              videoId: nextTrack.youtube_id,
              startSeconds: info.startSeconds,
              endSeconds: info.endSeconds,
            });
          } catch (e) {
            console.warn('Error cueing next track into idle player:', e);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to preload upcoming track:', err);
    }
  }, [token, authFetch, fetchSkipInfo, getIdleInstance]);

  // Update skip info label
  const updateSkipLabel = (info: SkipInfo | null) => {
    if (!info) {
      setSkipInfoLabel(null);
      return;
    }
    if (info.source === 'community') {
      setSkipInfoLabel('Intro skipped (community)');
    } else if (info.startSeconds > 0) {
      setSkipInfoLabel(`Intro skipped (${info.startSeconds} s)`);
    } else {
      setSkipInfoLabel(null);
    }
  };

  // Advance to next song via server-authoritative /api/player/advance
  const advanceTrack = useCallback(async () => {
    if (!token) return;
    clearFades();
    isCrossfadingRef.current = false;

    try {
      const res = await authFetch('/api/player/advance', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      const track: QueueItem | null = data.track;

      if (!track) {
        setCurrentTrack(null);
        setIsPlaying(false);
        setSkipInfoLabel(null);
        setErrorNotice(null);
        const activeInst = getActiveInstance();
        if (activeInst) activeInst.stopVideo();
        return;
      }

      setCurrentTrack(track);
      setIsPlaying(true);
      setErrorNotice(null);

      // Fetch skip info
      const skipInfo = await fetchSkipInfo(track.youtube_id);
      activeSkipInfoRef.current = skipInfo;
      updateSkipLabel(skipInfo);

      const activeInst = getActiveInstance();
      if (activeInst) {
        const targetVol = getTargetVolume();

        if (isFirstSessionTrackRef.current) {
          // The very first song of a session fades in over 3 seconds
          isFirstSessionTrackRef.current = false;
          activeInst.setVolume(0);
          activeInst.unMute();
          const playPromise = activeInst.loadVideoById({
            videoId: track.youtube_id,
            startSeconds: skipInfo.startSeconds,
            endSeconds: skipInfo.endSeconds,
          });
          if (playPromise !== undefined) {
            Promise.resolve(playPromise).catch(() => setAutoplayBlocked(true));
          }

          // 3-second fade in (30 steps of 100ms)
          let step = 0;
          const totalSteps = 30;
          fadeIntervalRef.current = setInterval(() => {
            step++;
            const currentVol = Math.round((step / totalSteps) * targetVol);
            try {
              activeInst.setVolume(currentVol);
            } catch {}
            if (step >= totalSteps) {
              clearFades();
              activeInst.setVolume(targetVol);
            }
          }, 100);
        } else {
          activeInst.setVolume(targetVol);
          activeInst.unMute();
          const playPromise = activeInst.loadVideoById({
            videoId: track.youtube_id,
            startSeconds: skipInfo.startSeconds,
            endSeconds: skipInfo.endSeconds,
          });
          if (playPromise !== undefined) {
            Promise.resolve(playPromise).catch(() => setAutoplayBlocked(true));
          }
        }
      }

      // Preload next track into idle player
      setTimeout(() => preloadUpcoming(), 1000);
    } catch (err) {
      console.error('Failed to advance track:', err);
    }
  }, [token, authFetch, fetchSkipInfo, getActiveInstance, getTargetVolume, clearFades, preloadUpcoming]);

  // Execute crossfade transition between Active and Idle players
  const startCrossfade = useCallback(() => {
    if (isCrossfadingRef.current) return;
    const activeInst = getActiveInstance();
    const idleInst = getIdleInstance();
    if (!activeInst || !idleInst || !upcomingTrack) {
      // Fallback: advance directly if idle is not ready
      advanceTrack();
      return;
    }

    isCrossfadingRef.current = true;
    clearFades();

    const targetVol = getTargetVolume();
    idleInst.setVolume(0);
    idleInst.unMute();

    const startFadeRamp = () => {
      let step = 0;
      const totalSteps = 60; // 6 seconds in steps of 100ms
      fadeIntervalRef.current = setInterval(() => {
        step++;
        const activeVol = Math.max(0, Math.round(targetVol * (1 - step / totalSteps)));
        const idleVol = Math.min(targetVol, Math.round(targetVol * (step / totalSteps)));

        try {
          activeInst.setVolume(activeVol);
          idleInst.setVolume(idleVol);
        } catch {}

        if (step >= totalSteps) {
          clearFades();
          try {
            activeInst.stopVideo();
          } catch {}

          // Switch active and idle player
          const newActive = activePlayer === 'A' ? 'B' : 'A';
          setActivePlayer(newActive);
          setCurrentTrack(upcomingTrack);
          activeSkipInfoRef.current = upcomingSkipInfoRef.current;
          updateSkipLabel(upcomingSkipInfoRef.current);
          upcomingSkipInfoRef.current = null;
          isCrossfadingRef.current = false;

          // Call server /api/player/advance to keep state synchronized
          authFetch('/api/player/advance', { method: 'POST' }).then(() => {
            preloadUpcoming();
          });
        }
      }, 100);
    };

    // Start idle player and begin fade ramp once playing
    try {
      idleInst.playVideo();
    } catch {}

    // Check when idle starts reporting PLAYING (state 1)
    let checkAttempts = 0;
    const checkPlaying = setInterval(() => {
      checkAttempts++;
      const idleState = activePlayer === 'A' ? playerBState.current : playerAState.current;
      if (idleState === 1 || checkAttempts > 15) {
        clearInterval(checkPlaying);
        startFadeRamp();
      }
    }, 100);
  }, [activePlayer, getActiveInstance, getIdleInstance, upcomingTrack, getTargetVolume, clearFades, advanceTrack, authFetch, preloadUpcoming]);

  // User manual skip or DJ "next": 2-second fade instead of cutting
  const handleSkip = useCallback(() => {
    clearFades();
    const activeInst = getActiveInstance();
    const targetVol = getTargetVolume();

    if (!activeInst || !isPlaying) {
      advanceTrack();
      return;
    }

    let step = 0;
    const totalSteps = 20; // 2 seconds at 100ms
    fadeIntervalRef.current = setInterval(() => {
      step++;
      const currentVol = Math.max(0, Math.round(targetVol * (1 - step / totalSteps)));
      try {
        activeInst.setVolume(currentVol);
      } catch {}

      if (step >= totalSteps) {
        clearFades();
        advanceTrack();
      }
    }, 100);
  }, [clearFades, getActiveInstance, getTargetVolume, isPlaying, advanceTrack]);

  // Every 250ms: Check active playback time and trigger 6s crossfade
  useEffect(() => {
    timeCheckIntervalRef.current = setInterval(() => {
      const activeInst = getActiveInstance();
      if (!activeInst) return;

      try {
        const curTime = activeInst.getCurrentTime?.();
        const dur = activeInst.getDuration?.();
        if (typeof curTime === 'number' && !isNaN(curTime)) setCurrentTime(curTime);
        if (typeof dur === 'number' && !isNaN(dur) && dur > 0) setDuration(dur);

        if (!isPlaying || isCrossfadingRef.current) return;

        const effectiveEnd = activeSkipInfoRef.current?.endSeconds || dur;
        if (effectiveEnd && effectiveEnd > 0 && curTime > 0) {
          const timeLeft = effectiveEnd - curTime;
          // With 6 seconds left, start crossfade
          if (timeLeft <= 6.2 && timeLeft > 0) {
            startCrossfade();
          }
        }
      } catch {}
    }, 250);

    return () => {
      if (timeCheckIntervalRef.current) {
        clearInterval(timeCheckIntervalRef.current);
        timeCheckIntervalRef.current = null;
      }
    };
  }, [isPlaying, getActiveInstance, startCrossfade]);

  // Handle Play / Pause Toggle
  const togglePlayPause = useCallback(() => {
    const activeInst = getActiveInstance();
    if (!activeInst) {
      if (!currentTrack) advanceTrack();
      return;
    }

    if (isPlaying) {
      activeInst.pauseVideo();
      setIsPlaying(false);
    } else {
      activeInst.playVideo();
      setIsPlaying(true);
    }
  }, [getActiveInstance, isPlaying, currentTrack, advanceTrack]);

  // Handle Volume Change
  const handleVolumeChange = useCallback((newVol: number) => {
    setVolume(newVol);
    setIsMuted(false);
    const activeInst = getActiveInstance();
    if (activeInst) {
      activeInst.unMute();
      activeInst.setVolume(newVol);
    }
  }, [getActiveInstance]);

  // Handle Mute Toggle
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const activeInst = getActiveInstance();
    if (activeInst) {
      if (nextMuted) {
        activeInst.mute();
      } else {
        activeInst.unMute();
        activeInst.setVolume(volume);
      }
    }
  }, [isMuted, volume, getActiveInstance]);

  // Audio unlock for autoplay restrictions
  const unlockAudio = useCallback(() => {
    setAutoplayBlocked(false);
    const activeInst = getActiveInstance();
    if (activeInst) {
      activeInst.unMute();
      activeInst.setVolume(volume);
      activeInst.playVideo();
      setIsPlaying(true);
    }
  }, [getActiveInstance, volume]);

  // Error code 101/150: Skip immediately
  const handlePlayerError = useCallback((errorCode: number, playerKey: 'A' | 'B') => {
    console.warn(`YouTube player ${playerKey} error code:`, errorCode);
    if (errorCode === 101 || errorCode === 150) {
      setErrorNotice('Embedding blocked by video owner (code 101/150). Skipping to next track immediately...');
      advanceTrack();
    } else {
      setErrorNotice(`Playback error (code ${errorCode}). Skipping to next track...`);
      advanceTrack();
    }
  }, [advanceTrack]);

  // Sync with queue when active song changes
  useEffect(() => {
    const currentFromQueue = queue.find((q) => q.status === 'playing');
    if (currentFromQueue && (!currentTrack || currentTrack.id !== currentFromQueue.id)) {
      setCurrentTrack(currentFromQueue);
    }
  }, [queue, currentTrack]);

  // Hidden YouTube Player Configuration
  const ytOpts = {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1 as const,
      controls: 0 as const,
      disablekb: 1 as const,
      fs: 0 as const,
      modestbranding: 1 as const,
      playsinline: 1 as const,
    },
  };

  // Render hidden YouTube players A and B
  const renderPlayers = () => {
    return createElement(
      'div',
      {
        className: 'absolute -left-[9999px] top-0 opacity-0 pointer-events-none w-1 h-1 overflow-hidden',
        'aria-hidden': 'true',
      },
      createElement(YouTube, {
        videoId: '',
        opts: ytOpts,
        onReady: (e: any) => {
          playerARef.current = e.target;
          isReadyA.current = true;
        },
        onStateChange: (e: any) => {
          playerAState.current = e.data;
          if (activePlayer === 'A') {
            if (e.data === 1) setIsPlaying(true);
            if (e.data === 2) setIsPlaying(false);
            if (e.data === 0) advanceTrack();
          }
        },
        onError: (e: any) => handlePlayerError(e?.data, 'A'),
      }),
      createElement(YouTube, {
        videoId: '',
        opts: ytOpts,
        onReady: (e: any) => {
          playerBRef.current = e.target;
          isReadyB.current = true;
        },
        onStateChange: (e: any) => {
          playerBState.current = e.data;
          if (activePlayer === 'B') {
            if (e.data === 1) setIsPlaying(true);
            if (e.data === 2) setIsPlaying(false);
            if (e.data === 0) advanceTrack();
          }
        },
        onError: (e: any) => handlePlayerError(e?.data, 'B'),
      })
    );
  };

  return {
    currentTrack,
    upcomingTrack,
    isPlaying,
    volume,
    isMuted,
    autoplayBlocked,
    skipInfoLabel,
    errorNotice,
    togglePlayPause,
    handleSkip,
    handleVolumeChange,
    toggleMute,
    unlockAudio,
    advanceTrack,
    renderPlayers,
    currentTime,
    duration,
    seekTo: (seconds: number) => {
      const activeInst = getActiveInstance();
      if (activeInst?.seekTo) {
        activeInst.seekTo(seconds, true);
        setCurrentTime(seconds);
      }
    },
  };
}
