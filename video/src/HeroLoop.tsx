import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { HERO_LOOP } from './config'
import { SampleTag } from './components/SampleTag'
import { sample } from './data'
import { color, fontFamily } from './theme'

const TAU = Math.PI * 2
const TILE = 96 // tick-grid spacing, px
const SCALE_MAX = 99

// The arc sits right of center so the site headline can overlay the left side.
const CX = 1380
const CY = 540
const R = 300

// Muted homepage hero background. Every motion completes a whole number of
// cycles over the loop (counts in config.ts HERO_LOOP), so frame N wraps into
// frame 0 with no seam. No text beyond the sample tag; the page supplies copy.
export const HeroLoop = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / durationInFrames // 0 -> 1 across the loop

  const drift = TILE * HERO_LOOP.gridDriftTilesPerLoop * t
  const turn = 360 * HERO_LOOP.arcTurnsPerLoop * t
  const arcLen = TAU * R
  const scoreFrac = sample.caution_score / SCALE_MAX

  const bars = sample.analyzers
  const barW = 22
  const barGap = 26
  const barsX = CX - ((bars.length - 1) * (barW + barGap)) / 2
  const topLevel = Math.max(...bars.map((b) => b.level))

  return (
    <AbsoluteFill style={{ backgroundColor: color.bg, fontFamily }}>
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="ticks" width={TILE} height={TILE} patternUnits="userSpaceOnUse" x={drift} y={drift}>
            <path d={`M ${TILE / 2 - 5} ${TILE / 2} h 10 M ${TILE / 2} ${TILE / 2 - 5} v 10`} stroke={color.faint} strokeWidth={1.5} />
          </pattern>
          <radialGradient id="fade" cx="72%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <mask id="vignette">
            <rect width="1920" height="1080" fill="url(#fade)" />
          </mask>
        </defs>

        <rect width="1920" height="1080" fill="url(#ticks)" mask="url(#vignette)" />

        {/* Caution ring: a faint full circle with the score's share in the accent,
            turning slowly. */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color.faint} strokeWidth={2} />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color.accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${arcLen * scoreFrac} ${arcLen}`}
          transform={`rotate(${turn - 90} ${CX} ${CY})`}
          opacity={0.6}
        />
        <circle cx={CX} cy={CY} r={R - 44} fill="none" stroke={color.faint} strokeWidth={1} strokeDasharray="2 10" transform={`rotate(${-turn} ${CX} ${CY})`} />

        {/* One bar per analyzer, height from its severity, breathing gently. */}
        {bars.map((b, i) => {
          const breath = Math.sin(TAU * (HERO_LOOP.barBreathsPerLoop * t + i / bars.length))
          const h = 36 + b.level * 34 + breath * 10
          const strong = b.level === topLevel && topLevel > 0
          return (
            <rect
              key={b.key}
              x={barsX + i * (barW + barGap) - barW / 2}
              y={CY + 40 - h}
              width={barW}
              height={h}
              rx={barW / 2}
              fill={strong ? color.accent : color.faint}
              opacity={strong ? 0.7 : 1}
            />
          )
        })}
      </svg>
      <div style={{ opacity: 0.6 }}>
        <SampleTag />
      </div>
    </AbsoluteFill>
  )
}
