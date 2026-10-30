import { interpolate } from 'remotion'
import { ease } from '../theme'

// Eased 0 -> 1 progress over [start, start + duration] frames, clamped.
export const progress = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

// Standard slow entrance: fade up while rising a short distance.
export const rise = (frame: number, start: number, duration = 30, distance = 28) => {
  const p = progress(frame, start, duration)
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` }
}
