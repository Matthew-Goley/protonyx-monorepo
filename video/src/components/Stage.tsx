import type { ReactNode } from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { FULL_CUT } from '../config'
import { color, fontFamily, GUTTER } from '../theme'

// Full-frame scene shell: near-black canvas, brand font, and a slow fade in
// and out at the scene's own edges so scenes join through black.
export const Stage = ({ children, center = false }: { children: ReactNode; center?: boolean }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const opacity = interpolate(
    frame,
    [0, FULL_CUT.fadeInFrames, durationInFrames - FULL_CUT.fadeOutFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  return (
    <AbsoluteFill style={{ backgroundColor: color.bg, fontFamily, color: color.text }}>
      <AbsoluteFill
        style={{
          opacity,
          padding: `120px ${GUTTER}px`,
          justifyContent: center ? 'center' : 'flex-start',
          alignItems: center ? 'center' : 'stretch',
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
