import React, { createElement, useState, useEffect, useRef, useCallback } from 'react';
import YouTube from 'react-youtube';
import { QueueItem, DjSettings } from '../types';
import { socket } from '../lib/socket';

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

const defaultSettings: DjSettings = {
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
};

export function useCrossfadePlayer({ token, onUnauthorized, queue }: UseCrossfadePlayerOptions) {
  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [upcomingTrack, setUpcomingTrack] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [skipInfoLabel, setSkipInfoLabel] = useState<string | null>(null);
  const [switchNoticeLabel, setSwitchNoticeLabel] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [settings, setSettings] = useState<DjSettings>(defaultSettings);

  // References and readiness
  const playerARef = useRef<any>(null);
  const playerBRef = useRef<any>(null);
  const playerAState = useRef<number>(-1);
  const playerBState = useRef<number>(-1);
  const isReadyA = useRef<boolean>(false);
  const isReadyB = useRef<boolean>(false);

  // Crossfade, session, and master switch trackers
  const isCrossfadingRef = useRef<boolean>(false);
  const isFirstSessionTrackRef = useRef<boolean>(true);
  const activeSkipInfoRef = useRef<SkipInfo | null>(null);
  const upcomingSkipInfoRef = useRef<SkipInfo | null>(null);
  const masterSwitchStartTimeRef = useRef<number | null>(null);
  const settingsRef = useRef<DjSettings>(defaultSettings);
  settingsRef.current = settings;

  // Active fade intervals
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize settings with server
  useEffect(() => {
    const handleStateUpdated = (data: any) => {
      if (data?.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    };

    socket.on('state-updated', handleStateUpdated);
    fetch('/api/state')
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {});

    return () => {
      socket.off('state-updated', handleStateUpdated);
    };
  }, []);

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

  // Update skip info label
  const updateSkipLabel = useCallback((info: SkipInfo | null) => {
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
  }, []);

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

  // Load and play a specific track on the active player with precision
  const playTrackInstance = useCallback(async (track: QueueItem, fadeIn: boolean = false) => {
    clearFades();
    isCrossfadingRef.current = false;
    masterSwitchStartTimeRef.current = null;
    setSwitchNoticeLabel(null);
    setCurrentTrack(track);
    setIsPlaying(true);
    setErrorNotice(null);

    const skipInfo = await fetchSkipInfo(track.youtube_id);
    activeSkipInfoRef.current = skipInfo;
    updateSkipLabel(skipInfo);

    const activeInst = getActiveInstance();
    if (activeInst) {
      const targetVol = getTargetVolume();

      if (fadeIn) {
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

        let step = 0;
        const totalSteps = 30; // 3 seconds at 100ms
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

    setTimeout(() => preloadUpcoming(), 1000);
  }, [clearFades, fetchSkipInfo, updateSkipLabel, getActiveInstance, getTargetVolume, preloadUpcoming]);

  // Advance to next song via server-authoritative /api/player/advance
  const advanceTrack = useCallback(async (targetTrackId?: string) => {
    if (!token) return;
    clearFades();
    isCrossfadingRef.current = false;
    masterSwitchStartTimeRef.current = null;
    setSwitchNoticeLabel(null);

    try {
      const res = await authFetch('/api/player/advance', {
        method: 'POST',
        body: JSON.stringify(targetTrackId ? { targetTrackId } : {}),
      });
      if (!res.ok) return;
      const data = await res.json();
      const track: QueueItem | null = data.track;

      if (!track) {
        setCurrentTrack(null);
        setIsPlaying(false);
        setSkipInfoLabel(null);
        setSwitchNoticeLabel(null);
        setErrorNotice(null);
        const activeInst = getActiveInstance();
        if (activeInst) activeInst.stopVideo();
        return;
      }

      const isFirst = isFirstSessionTrackRef.current;
      isFirstSessionTrackRef.current = false;
      await playTrackInstance(track, isFirst);
    } catch (err) {
      console.error('Failed to advance track:', err);
    }
  }, [token, clearFades, authFetch, getActiveInstance, playTrackInstance]);

  // Synchronize immediately whenever server broadcasts track-playing-changed
  useEffect(() => {
    const handleTrackPlayingChanged = (data: { track: QueueItem | null }) => {
      const serverTrack = data?.track;
      if (!serverTrack) {
        if (currentTrack) {
          setCurrentTrack(null);
          setIsPlaying(false);
          setSkipInfoLabel(null);
          setSwitchNoticeLabel(null);
          getActiveInstance()?.stopVideo();
        }
        return;
      }
      if (serverTrack.id !== currentTrack?.id) {
        playTrackInstance(serverTrack, false);
      }
    };

    socket.on('track-playing-changed', handleTrackPlayingChanged);
    return () => {
      socket.off('track-playing-changed', handleTrackPlayingChanged);
    };
  }, [currentTrack, playTrackInstance, getActiveInstance]);

  // Execute crossfade transition between Active and Idle players
  const startCrossfade = useCallback(() => {
    if (isCrossfadingRef.current) return;
    const activeInst = getActiveInstance();
    const idleInst = getIdleInstance();
    if (!activeInst || !idleInst || !upcomingTrack) {
      advanceTrack();
      return;
    }

    isCrossfadingRef.current = true;
    clearFades();
    masterSwitchStartTimeRef.current = null;
    setSwitchNoticeLabel(null);

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

          const newActive = activePlayer === 'A' ? 'B' : 'A';
          const preloaded = upcomingTrack;
          setActivePlayer(newActive);
          setCurrentTrack(preloaded);
          activeSkipInfoRef.current = upcomingSkipInfoRef.current;
          updateSkipLabel(upcomingSkipInfoRef.current);
          upcomingSkipInfoRef.current = null;
          isCrossfadingRef.current = false;

          authFetch('/api/player/advance', {
            method: 'POST',
            body: JSON.stringify({ targetTrackId: preloaded.id }),
          }).then(() => {
            preloadUpcoming();
          });
        }
      }, 100);
    };

    try {
      idleInst.playVideo();
    } catch {}

    let checkAttempts = 0;
    const checkPlaying = setInterval(() => {
      checkAttempts++;
      const idleState = activePlayer === 'A' ? playerBState.current : playerAState.current;
      if (idleState === 1 || checkAttempts > 15) {
        clearInterval(checkPlaying);
        startFadeRamp();
      }
    }, 100);
  }, [activePlayer, getActiveInstance, getIdleInstance, upcomingTrack, getTargetVolume, clearFades, advanceTrack, authFetch, updateSkipLabel, preloadUpcoming]);

  // User manual skip or auto skip (2-second fade)
  const handleSkip = useCallback(() => {
    clearFades();
    masterSwitchStartTimeRef.current = null;
    setSwitchNoticeLabel(null);
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

  // Every 250ms: Check active playback time, max duration rule, switch delay, and 6s end crossfade
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

        const currentSettings = settingsRef.current;
        const isMaster = !!currentTrack?.is_master_list;
        const maxGuestSec = currentSettings.maxGuestTrackDurationSeconds ?? 240;

        // RULE 3: Max play duration limit applies ONLY to guest requests (!isMaster)
        // Master list songs can be 1+ hours and will NOT be cut off by max guest duration limit!
        if (!isMaster && maxGuestSec > 0 && curTime >= maxGuestSec && curTime > 0) {
          console.log(`Max guest request duration of ${maxGuestSec}s reached. Advancing track...`);
          handleSkip();
          return;
        }

        // RULE 4: Master List to Guest Request Switch Delay
        if (isMaster && currentSettings.allowGuestPlayback !== false) {
          const hasPendingGuest = queue.some((q) => q.status === 'pending' && !q.is_master_list);
          if (hasPendingGuest) {
            if (!masterSwitchStartTimeRef.current) {
              masterSwitchStartTimeRef.current = Date.now();
            }
            const delaySec = currentSettings.masterToRequestSwitchDelaySeconds ?? 10;
            const elapsedSec = (Date.now() - masterSwitchStartTimeRef.current) / 1000;
            const remaining = Math.max(0, Math.ceil(delaySec - elapsedSec));

            setSwitchNoticeLabel(`Guest request queued • Switching in ${remaining}s`);

            if (elapsedSec >= delaySec) {
              masterSwitchStartTimeRef.current = null;
              setSwitchNoticeLabel(null);
              handleSkip();
              return;
            }
          } else {
            masterSwitchStartTimeRef.current = null;
            setSwitchNoticeLabel(null);
          }
        } else {
          masterSwitchStartTimeRef.current = null;
          setSwitchNoticeLabel(null);
        }

        // Standard 6s natural track end crossfade
        const effectiveEnd = activeSkipInfoRef.current?.endSeconds || dur;
        if (effectiveEnd && effectiveEnd > 0 && curTime > 0) {
          const timeLeft = effectiveEnd - curTime;
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
  }, [isPlaying, currentTrack, queue, getActiveInstance, startCrossfade, handleSkip]);

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

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    const activeInst = getActiveInstance();
    if (activeInst) {
      if (nextMute) {
        activeInst.mute();
      } else {
        activeInst.unMute();
        activeInst.setVolume(volume);
      }
    }
  }, [isMuted, volume, getActiveInstance]);

  // Audio Unlock Handler for autoplay blocked
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

  // Handle Player Errors (Auto-skip unplayable/copyright-blocked videos)
  const handlePlayerError = useCallback((errCode: number, playerTag: 'A' | 'B') => {
    console.warn(`YouTube Player ${playerTag} error:`, errCode);
    if ([2, 5, 100, 101, 150].includes(errCode)) {
      setErrorNotice('This video cannot be embedded. Auto-skipping to next song...');
      setTimeout(() => {
        advanceTrack();
      }, 1500);
    }
  }, [advanceTrack]);

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
            if (e.data === 0 && !isCrossfadingRef.current) advanceTrack();
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
            if (e.data === 0 && !isCrossfadingRef.current) advanceTrack();
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
    switchNoticeLabel,
    errorNotice,
    togglePlayPause,
    handleSkip,
    handleVolumeChange,
    toggleMute,
    unlockAudio,
    advanceTrack,
    playTrack: playTrackInstance,
    renderPlayers,
    currentTime,
    duration,
    settings,
    seekTo: (seconds: number) => {
      const activeInst = getActiveInstance();
      if (activeInst?.seekTo) {
        activeInst.seekTo(seconds, true);
        setCurrentTime(seconds);
      }
    },
  };
}
