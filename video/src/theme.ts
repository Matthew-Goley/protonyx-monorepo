import { Easing } from 'remotion'
import { loadFont } from '@remotion/google-fonts/Sora'

// Sora is the Lens Arc brand face (lens-app/styling.md).
export const { fontFamily } = loadFont('normal', { weights: ['400', '600'], subsets: ['latin'] })

// Near-black canvas, one brand accent. Everything else is a grey step, so the
// accent always means "this is the finding".
export const color = {
  bg: '#0a0b0e',
  text: '#f0f2f5',
  dim: '#8b90a0',
  faint: '#2a2d35',
  accent: '#38bdf8',
} as const

export const type = {
  hero: 132,
  headline: 92,
  sub: 40,
  body: 44,
  label: 26,
  tag: 22,
} as const

// Slow ease-out used for every entrance (same curve as the app's caution arc).
export const ease = Easing.bezier(0.16, 1, 0.3, 1)

export const GUTTER = 160
