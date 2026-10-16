import { useEffect, useRef, useState } from 'react';
import { 
  BarChart3, 
  CircleDot, 
  Activity, 
  Layers, 
  Grid3X3, 
  Sparkles,
  RefreshCw,
  Palette,
  Maximize2
} from 'lucide-react';

export type EqualizerMode = 
  | 'neon-bars' 
  | 'led-rack' 
  | 'radial-halo' 
  | 'mirrored-wave' 
  | 'oscilloscope' 
  | 'dot-matrix';

export type ColorTheme = 
  | 'cyber-desi' 
  | 'tokyo-neon' 
  | 'inferno' 
  | 'acid-emerald';

export type SizePreset = 'default' | 'large' | 'jumbo' | 'colossal';

interface StageEqualizerProps {
  isPlaying?: boolean;
  intensity?: number;
  heightClass?: string;
  showControls?: boolean;
  className?: string;
  allowSizeScaling?: boolean;
}

const MODES: { id: EqualizerMode; label: string; icon: any }[] = [
  { id: 'neon-bars', label: 'Neon Bars', icon: BarChart3 },
  { id: 'led-rack', label: 'LED VU Rack', icon: Layers },
  { id: 'radial-halo', label: 'Radial Halo', icon: CircleDot },
  { id: 'mirrored-wave', label: 'Mirrored Wave', icon: Activity },
  { id: 'oscilloscope', label: 'Oscilloscope', icon: Sparkles },
  { id: 'dot-matrix', label: 'Dot Matrix', icon: Grid3X3 },
];

const THEMES: { id: ColorTheme; label: string; colors: [string, string, string] }[] = [
  { id: 'cyber-desi', label: 'Cyber Bollywood', colors: ['#ec4899', '#f97316', '#fbbf24'] },
  { id: 'tokyo-neon', label: 'Tokyo Cyber', colors: ['#06b6d4', '#8b5cf6', '#ec4899'] },
  { id: 'inferno', label: 'Inferno Drop', colors: ['#ef4444', '#f97316', '#eab308'] },
  { id: 'acid-emerald', label: 'Acid Rave', colors: ['#10b981', '#06b6d4', '#a855f7'] },
];

const SIZE_PRESETS: { id: SizePreset; label: string; heightClass: string }[] = [
  { id: 'default', label: 'Normal', heightClass: 'h-48 sm:h-64' },
  { id: 'large', label: 'Large (XL)', heightClass: 'h-64 sm:h-80 md:h-96' },
  { id: 'jumbo', label: 'Jumbo (2XL)', heightClass: 'h-80 sm:h-96 md:h-[420px]' },
  { id: 'colossal', label: 'Colossal (3XL)', heightClass: 'h-[400px] sm:h-[520px] md:h-[620px]' },
];

export function StageEqualizer({
  isPlaying = true,
  heightClass,
  showControls = true,
  className = '',
  allowSizeScaling = true,
}: StageEqualizerProps) {
  const [mode, setMode] = useState<EqualizerMode>('neon-bars');
  const [theme, setTheme] = useState<ColorTheme>('cyber-desi');
  const [autoCycle, setAutoCycle] = useState(false);
  const [sizePreset, setSizePreset] = useState<SizePreset>('default');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Auto-cycle through visualizer modes every 20 seconds if enabled
  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setMode((current) => {
        const idx = MODES.findIndex((m) => m.id === current);
        const nextIdx = (idx + 1) % MODES.length;
        return MODES[nextIdx].id;
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [autoCycle]);

  // Keyboard shortcuts (1-6 for mode, c for cycle, t for theme, s for size)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key >= '1' && e.key <= '6') {
        const targetMode = MODES[parseInt(e.key) - 1];
        if (targetMode) setMode(targetMode.id);
      } else if (e.key.toLowerCase() === 'c') {
        setAutoCycle((prev) => !prev);
      } else if (e.key.toLowerCase() === 't') {
        setTheme((current) => {
          const idx = THEMES.findIndex((t) => t.id === current);
          return THEMES[(idx + 1) % THEMES.length].id;
        });
      } else if (e.key.toLowerCase() === 's') {
        setSizePreset((current) => {
          const idx = SIZE_PRESETS.findIndex((s) => s.id === current);
          return SIZE_PRESETS[(idx + 1) % SIZE_PRESETS.length].id;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine active height: if sizePreset has been toggled away from default or heightClass not provided
  const activeHeightClass = heightClass && sizePreset === 'default'
    ? heightClass
    : SIZE_PRESETS.find((s) => s.id === sizePreset)?.heightClass || 'h-64 sm:h-80';

  // Audio simulation state with realistic physics and retina 4K canvas scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let clientW = canvas.parentElement?.clientWidth || 800;
    let clientH = canvas.parentElement?.clientHeight || 300;

    const updateDimensions = () => {
      if (!canvas || !canvas.parentElement) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      clientW = canvas.parentElement.clientWidth;
      clientH = canvas.parentElement.clientHeight;
      canvas.width = Math.floor(clientW * dpr);
      canvas.height = Math.floor(clientH * dpr);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Audio frequency bands simulation (56 bands for wide rich spectrum)
    const BANDS_COUNT = 56;
    const values = new Float32Array(BANDS_COUNT);
    const targetValues = new Float32Array(BANDS_COUNT);
    const peakValues = new Float32Array(BANDS_COUNT);
    const peakDecay = new Float32Array(BANDS_COUNT);

    let phase = 0;
    let beatTimer = 0;
    let isBeatDrop = false;

    const render = () => {
      phase += 0.045;
      beatTimer += 0.055;

      // Simulate live DJ dynamic tempo & rhythm peaks
      if (beatTimer > Math.PI * 2) {
        beatTimer = 0;
        isBeatDrop = Math.random() > 0.65;
      }

      // Height-proportional dynamic range: fills 88-92% of full canvas height
      const maxAmplitude = clientH * 0.90;

      // Update frequency simulations
      for (let i = 0; i < BANDS_COUNT; i++) {
        if (!isPlaying) {
          targetValues[i] = 8;
        } else {
          // Parabolic center-bell curve with energetic sub-bass and crisp upper brilliance
          const centerWeight = Math.sin((i / BANDS_COUNT) * Math.PI);
          const subBassWeight = Math.max(0, 1 - i / (BANDS_COUNT * 0.35)) * 0.45;
          const wave1 = Math.sin(phase * 2.2 + i * 0.28) * (maxAmplitude * 0.16);
          const wave2 = Math.cos(phase * 1.6 - i * 0.22) * (maxAmplitude * 0.12);
          const noise = Math.random() * (isBeatDrop ? maxAmplitude * 0.40 : maxAmplitude * 0.24);
          const baseHeight = (centerWeight * 0.45 + subBassWeight) * maxAmplitude + (maxAmplitude * 0.15);

          targetValues[i] = Math.max(12, Math.min(maxAmplitude, baseHeight + wave1 + wave2 + noise));
        }

        // Smooth spring interpolation
        values[i] += (targetValues[i] - values[i]) * 0.24;

        // Peak hold physics
        if (values[i] > peakValues[i]) {
          peakValues[i] = values[i];
          peakDecay[i] = 0;
        } else {
          peakDecay[i] += 0.20;
          peakValues[i] = Math.max(0, peakValues[i] - peakDecay[i]);
        }
      }

      // Clear frame with crisp DPR scaling
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, clientW, clientH);

      // Current theme colors
      const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];
      const [col1, col2, col3] = currentTheme.colors;

      // DRAW SELECTED VISUALIZER MODE
      switch (mode) {
        case 'neon-bars': {
          drawNeonBars(ctx, clientW, clientH, values, peakValues, BANDS_COUNT, col1, col2, col3);
          break;
        }
        case 'led-rack': {
          drawLedRack(ctx, clientW, clientH, values, peakValues, BANDS_COUNT, col1, col2, col3);
          break;
        }
        case 'radial-halo': {
          drawRadialHalo(ctx, clientW, clientH, values, phase, col1, col2, col3);
          break;
        }
        case 'mirrored-wave': {
          drawMirroredWave(ctx, clientW, clientH, values, BANDS_COUNT, col1, col2, col3);
          break;
        }
        case 'oscilloscope': {
          drawOscilloscope(ctx, clientW, clientH, values, phase, col1, col2, col3);
          break;
        }
        case 'dot-matrix': {
          drawDotMatrix(ctx, clientW, clientH, values, BANDS_COUNT, col1, col2, col3);
          break;
        }
      }

      ctx.restore();
      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [mode, theme, isPlaying, activeHeightClass]);

  return (
    <div className={`relative w-full rounded-2xl sm:rounded-3xl bg-neutral-950/90 border border-pink-500/35 backdrop-blur-xl p-3 sm:p-5 shadow-[0_0_40px_rgba(236,72,153,0.22)] flex flex-col justify-between overflow-hidden select-none transition-all duration-300 ${className}`}>
      {/* Top Header / Mode Switcher bar */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-neutral-800/80 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse shadow-[0_0_10px_#ec4899]" />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-pink-300">
              {MODES.find((m) => m.id === mode)?.label}
            </span>
            <span className="text-[10px] text-neutral-400 uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 hidden sm:inline">
              60 FPS Reactive
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Mode selection buttons */}
            <div className="flex items-center bg-black/70 rounded-xl p-1 border border-neutral-800">
              {MODES.map((m) => {
                const Icon = m.icon;
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    title={m.label}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-pink-600 to-orange-500 text-white shadow-[0_0_14px_rgba(236,72,153,0.6)]'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline text-[11px]">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Size Scale Preset Toggle */}
            {allowSizeScaling && (
              <button
                onClick={() => {
                  const idx = SIZE_PRESETS.findIndex((s) => s.id === sizePreset);
                  setSizePreset(SIZE_PRESETS[(idx + 1) % SIZE_PRESETS.length].id);
                }}
                title={`Scale Equalizer Size (Key: S, Current: ${SIZE_PRESETS.find((s) => s.id === sizePreset)?.label})`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-pink-500/50 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <Maximize2 className="w-3 h-3 text-orange-400" />
                <span className="text-[11px]">{SIZE_PRESETS.find((s) => s.id === sizePreset)?.label}</span>
              </button>
            )}

            {/* Auto Cycle Button */}
            <button
              onClick={() => setAutoCycle((prev) => !prev)}
              title="Auto rotate equalizer visualizers every 20s (Key: C)"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                autoCycle
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(251,191,36,0.35)] animate-pulse'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${autoCycle ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              <span className="text-[11px] hidden sm:inline">Auto Cycle</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                const idx = THEMES.findIndex((t) => t.id === theme);
                setTheme(THEMES[(idx + 1) % THEMES.length].id);
              }}
              title={`Switch color palette (Key: T, Current: ${THEMES.find((t) => t.id === theme)?.label})`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white hover:border-pink-500/40 transition-colors cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-[11px] hidden md:inline">Theme</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Canvas Visualizer Element */}
      <div className={`relative w-full ${activeHeightClass} flex items-center justify-center transition-all duration-300`}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Ambient background bloom */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-25 blur-3xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${THEMES.find((t) => t.id === theme)?.colors[0]}, transparent 75%)`
          }}
        />
      </div>

      {/* Bottom frequency marker labels */}
      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-neutral-400 pt-2 border-t border-neutral-900 px-1">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 inline-block" />
          30Hz • SUB-BASS
        </span>
        <span className="hidden sm:inline">120Hz • PUNCH</span>
        <span>500Hz • BODY</span>
        <span className="hidden sm:inline">2.5kHz • VOCALS</span>
        <span>8kHz • AIR</span>
        <span className="flex items-center gap-1">
          16kHz • BRILLIANCE
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   RENDERERS FOR EQUALIZER PRESETS (HEIGHT & WIDTH PROPORTIONALLY SCALED)
   ========================================================================== */

/** 1. NEON BARS: High-density gradient frequency columns with peak gravity caps */
function drawNeonBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: Float32Array,
  peaks: Float32Array,
  count: number,
  col1: string,
  col2: string,
  col3: string
) {
  const barGap = Math.max(2, Math.floor(width / (count * 4)));
  const barWidth = Math.max(4, (width - (count - 1) * barGap) / count);

  for (let i = 0; i < count; i++) {
    const x = i * (barWidth + barGap);
    const barHeight = Math.min(height - 12, values[i]);
    const peakHeight = Math.min(height - 12, peaks[i]);
    const y = height - barHeight;

    // Gradient fill from base to peak
    const grad = ctx.createLinearGradient(0, height, 0, y);
    grad.addColorStop(0, col1);
    grad.addColorStop(0.55, col2);
    grad.addColorStop(1, col3);

    ctx.fillStyle = grad;
    ctx.shadowColor = col1;
    ctx.shadowBlur = 12;

    // Rounded top bar
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [5, 5, 0, 0]);
    ctx.fill();

    // Floating Peak Cap
    const peakY = height - peakHeight - 5;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = col3;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(x, Math.max(2, peakY), barWidth, 3.5, [2, 2, 2, 2]);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

/** 2. LED RACK: Segmented discrete LED meters like Pioneer / hardware gear */
function drawLedRack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: Float32Array,
  peaks: Float32Array,
  count: number,
  col1: string,
  col2: string,
  col3: string
) {
  const columns = Math.min(count, 36);
  const colGap = Math.max(3, Math.floor(width / (columns * 5)));
  const colWidth = Math.max(5, (width - (columns - 1) * colGap) / columns);
  // Scale segments proportionally with height
  const segments = Math.max(16, Math.min(32, Math.floor(height / 14)));
  const segGap = 3;
  const segHeight = Math.max(3, (height - (segments - 1) * segGap) / segments);

  for (let c = 0; c < columns; c++) {
    const x = c * (colWidth + colGap);
    const valPercent = values[c] / height;
    const activeSegments = Math.floor(valPercent * segments);
    const peakSegment = Math.min(segments - 1, Math.floor((peaks[c] / height) * segments));

    for (let s = 0; s < segments; s++) {
      const y = height - (s + 1) * (segHeight + segGap);
      const isActive = s <= activeSegments;
      const isPeak = s === peakSegment;

      if (isActive) {
        if (s > segments - 5) {
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
        } else if (s > segments - 10) {
          ctx.fillStyle = col3;
          ctx.shadowColor = col3;
        } else {
          ctx.fillStyle = col1;
          ctx.shadowColor = col1;
        }
        ctx.shadowBlur = 7;
      } else if (isPeak) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
      } else {
        // Dim background unlit LED ghost
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, colWidth, segHeight, [2, 2, 2, 2]);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

/** 3. RADIAL HALO: 360-degree circular equalizer bursting outward with angular spokes */
function drawRadialHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: Float32Array,
  phase: number,
  col1: string,
  col2: string,
  col3: string
) {
  const centerX = width / 2;
  const centerY = height / 2;
  // Scaled base radius taking full advantage of the larger height
  const minDim = Math.min(width, height);
  const baseRadius = minDim * 0.26;
  const raysCount = 72;

  // Center glowing orb
  const centerGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius);
  centerGrad.addColorStop(0, col3);
  centerGrad.addColorStop(0.5, col1);
  centerGrad.addColorStop(1, 'rgba(0,0,0,0.85)');

  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing neon halo outline
  ctx.strokeStyle = col2;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = col2;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseRadius + Math.sin(phase * 3) * 6, 0, Math.PI * 2);
  ctx.stroke();

  // Draw radial rays bursting out to the edge of the canvas
  const maxRayLen = (minDim / 2) - baseRadius - 10;
  for (let i = 0; i < raysCount; i++) {
    const angle = (i / raysCount) * Math.PI * 2 + phase * 0.2;
    const valueIndex = i % values.length;
    const rayLength = Math.min(maxRayLen, (values[valueIndex] / height) * maxRayLen * 1.35 + 8);

    const xStart = centerX + Math.cos(angle) * (baseRadius + 5);
    const yStart = centerY + Math.sin(angle) * (baseRadius + 5);
    const xEnd = centerX + Math.cos(angle) * (baseRadius + 5 + rayLength);
    const yEnd = centerY + Math.sin(angle) * (baseRadius + 5 + rayLength);

    ctx.strokeStyle = i % 2 === 0 ? col1 : col3;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = col1;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(xStart, yStart);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    // End glowing bead
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(xEnd, yEnd, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

/** 4. MIRRORED WAVE: Bilateral symmetrical soundwave exploding up & down from laser center */
function drawMirroredWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: Float32Array,
  count: number,
  col1: string,
  col2: string,
  col3: string
) {
  const centerY = height / 2;
  const barGap = Math.max(2, Math.floor(width / (count * 4)));
  const barWidth = Math.max(4, (width - (count - 1) * barGap) / count);

  // Center laser guideline
  ctx.strokeStyle = col2;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = col2;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  for (let i = 0; i < count; i++) {
    const x = i * (barWidth + barGap);
    // Expand to 90% of available half-height
    const halfH = Math.min(height * 0.46, (values[i] / height) * (height * 0.46) + 4);

    const grad = ctx.createLinearGradient(0, centerY - halfH, 0, centerY + halfH);
    grad.addColorStop(0, col3);
    grad.addColorStop(0.5, col1);
    grad.addColorStop(1, col3);

    ctx.fillStyle = grad;
    ctx.shadowColor = col1;
    ctx.shadowBlur = 10;

    // Upward bar
    ctx.beginPath();
    ctx.roundRect(x, centerY - halfH, barWidth, halfH, [4, 4, 0, 0]);
    ctx.fill();

    // Downward bar (mirrored)
    ctx.beginPath();
    ctx.roundRect(x, centerY, barWidth, halfH, [0, 0, 4, 4]);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

/** 5. OSCILLOSCOPE: Multi-harmonic laser ribbon wave with neon persistence */
function drawOscilloscope(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: Float32Array,
  phase: number,
  col1: string,
  col2: string,
  col3: string
) {
  const centerY = height / 2;
  const amplitude = height * 0.42;

  const layers = [
    { freq: 0.010, speed: 2.2, color: col1, width: 4.5, blur: 18, ampMult: 0.95 },
    { freq: 0.016, speed: -1.8, color: col2, width: 3.5, blur: 14, ampMult: 0.75 },
    { freq: 0.024, speed: 2.8, color: col3, width: 2.5, blur: 10, ampMult: 0.55 },
    { freq: 0.035, speed: -2.5, color: '#ffffff', width: 1.5, blur: 6, ampMult: 0.35 },
  ];

  layers.forEach((layer) => {
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = layer.width;
    ctx.shadowColor = layer.color;
    ctx.shadowBlur = layer.blur;

    ctx.beginPath();
    for (let x = 0; x <= width; x += 3) {
      const freqSample = values[Math.floor((x / width) * values.length)] || (height * 0.25);
      const localAmp = (amplitude * layer.ampMult) * (freqSample / (height * 0.65));
      const y = centerY + Math.sin(x * layer.freq + phase * layer.speed) * localAmp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  ctx.shadowBlur = 0;
}

/** 6. DOT MATRIX: Cyberpunk LED dot array reminiscent of festival arena screens */
function drawDotMatrix(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: Float32Array,
  count: number,
  col1: string,
  col2: string,
  col3: string
) {
  const cols = Math.min(count, 42);
  const rows = Math.max(16, Math.min(32, Math.floor(height / 15)));
  const cellW = width / cols;
  const cellH = height / rows;
  const radius = Math.min(cellW, cellH) * 0.36;

  for (let c = 0; c < cols; c++) {
    const valPercent = values[c] / height;
    const activeDots = Math.floor(valPercent * rows);

    for (let r = 0; r < rows; r++) {
      const cx = c * cellW + cellW / 2;
      const cy = height - (r * cellH + cellH / 2);
      const isActive = r <= activeDots;

      if (isActive) {
        if (r > rows - 4) {
          ctx.fillStyle = col3;
          ctx.shadowColor = col3;
        } else if (r > rows - 8) {
          ctx.fillStyle = col2;
          ctx.shadowColor = col2;
        } else {
          ctx.fillStyle = col1;
          ctx.shadowColor = col1;
        }
        ctx.shadowBlur = 9;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}
