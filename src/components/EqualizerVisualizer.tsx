import { useEffect, useState } from 'react';
import { Sparkles, Disc3, Mic2, Heart } from 'lucide-react';
import { QueueItem } from '../types';

interface EqualizerProps {
  track: QueueItem | null;
  isPlaying: boolean;
}

export function EqualizerVisualizer({ track, isPlaying }: EqualizerProps) {
  // Bar heights simulated for audio visualizer
  const numBars = 36;
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: numBars }, () => Math.floor(Math.random() * 40) + 15)
  );

  useEffect(() => {
    if (!isPlaying) {
      setBarHeights(Array.from({ length: numBars }, () => 10));
      return;
    }

    const interval = setInterval(() => {
      setBarHeights((prev) =>
        prev.map((_, i) => {
          // Create musical wave-like patterns with bass peak on left/center
          const centerBias = Math.sin((i / numBars) * Math.PI);
          const randomFactor = Math.random() * 55;
          const height = Math.min(95, Math.max(12, Math.floor(centerBias * 50 + randomFactor)));
          return height;
        })
      );
    }, 120);

    return () => clearInterval(interval);
  }, [isPlaying, numBars]);

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-6">
        <div className="w-24 h-24 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-2xl">
          <Disc3 className="w-12 h-12 text-neutral-600 animate-spin" style={{ animationDuration: '8s' }} />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold text-neutral-300">Ready for Stage Audio</h2>
          <p className="text-neutral-500 text-sm">
            Waiting for live guest requests or falling back to the Master Playlist...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-12 overflow-hidden select-none">
      {/* Ambient background party glow & laser beams */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Top Stage Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs uppercase tracking-widest font-extrabold text-neutral-300 bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800">
            ON AIR • DANCEFLOOR STAGE
          </span>
        </div>

        {track.is_master_list ? (
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Master Playlist Fallback</span>
          </div>
        ) : (
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
            <span>Crowd Request • {track.upvotes} Upvotes</span>
          </div>
        )}
      </div>

      {/* Center: Vinyl turntable / visualizer icon + Big Track Metadata */}
      <div className="relative z-10 my-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14 max-w-5xl mx-auto w-full">
        {/* Animated Spinning DJ Disc with album art */}
        <div className="relative group flex-shrink-0">
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-[0_0_50px_rgba(249,115,22,0.25)] flex items-center justify-center relative overflow-hidden">
            {/* Vinyl grooved circles */}
            <div className="absolute inset-2 rounded-full border border-neutral-800/80"></div>
            <div className="absolute inset-6 rounded-full border border-neutral-800/60"></div>
            <div className="absolute inset-10 rounded-full border border-neutral-800/40"></div>
            
            {/* Spinning artwork disc */}
            <div
              className={`w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-2 border-amber-400/40 shadow-inner ${
                isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
              }`}
            >
              <img
                src={track.thumbnail_url}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Spindle hole */}
            <div className="absolute w-6 h-6 rounded-full bg-neutral-900 border-2 border-neutral-700 shadow-md"></div>
          </div>

          {/* Pulse ring when playing */}
          {isPlaying && (
            <div className="absolute -inset-2 rounded-full border border-orange-500/30 animate-ping pointer-events-none"></div>
          )}
        </div>

        {/* Big Stage Typography */}
        <div className="flex-1 text-center lg:text-left space-y-4 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-xs font-semibold text-orange-400">
            <Mic2 className="w-3.5 h-3.5" />
            <span>NOW BLASTING</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-3">
            {track.title}
          </h1>

          <p className="text-lg text-neutral-400 font-medium truncate">
            {track.channel_title}
          </p>

          {/* Dedication / Guest shoutout banner */}
          <div className="pt-2">
            <div className="inline-block bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-4 text-left max-w-xl backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
                <span>Requested by</span>
                <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  {track.requested_by || 'Guest'}
                </span>
              </div>
              {track.dedication_note ? (
                <p className="text-base sm:text-lg text-pink-200 font-medium italic">
                  "{track.dedication_note}"
                </p>
              ) : (
                <p className="text-xs text-neutral-500 italic">
                  No shoutout note • Dancefloor banger
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Spectacular Multi-Bar Audio Equalizer */}
      <div className="relative z-10 w-full max-w-5xl mx-auto pt-6">
        <div className="bg-neutral-950/60 border border-neutral-800/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="font-mono uppercase font-bold text-neutral-300">Live Stage Spectrum</span>
            </div>
            <span className="font-mono text-neutral-500">20Hz - 20kHz • Bass Booster</span>
          </div>

          {/* Equalizer Frequency Bars */}
          <div className="h-24 sm:h-32 flex items-end justify-between gap-1 sm:gap-1.5 px-1">
            {barHeights.map((height, idx) => (
              <div
                key={idx}
                className="flex-1 flex flex-col justify-end items-center h-full group"
              >
                {/* Peak bounce dot */}
                <div
                  className="w-full max-w-[10px] h-1 rounded-full bg-amber-300 transition-all duration-150 mb-1 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                  style={{ opacity: height > 30 ? 0.9 : 0.3 }}
                />
                {/* Main animated bar */}
                <div
                  className="w-full max-w-[10px] rounded-t-sm transition-all duration-100 ease-out bg-gradient-to-t from-orange-600 via-pink-500 to-amber-300 shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                  style={{
                    height: `${height}%`,
                    minHeight: '6px'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
