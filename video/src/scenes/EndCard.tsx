import { Img, staticFile, useCurrentFrame } from 'remotion'
import { FULL_CUT } from '../config'
import { Stage } from '../components/Stage'
import { progress, rise } from '../components/motion'
import { fill } from '../data'
import { color, GUTTER, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'end')!.copy

// Logo, address, and the educational-use disclaimer. The disclaimer is up from
// the first second so it is readable for the whole card.
export const EndCard = () => {
  const frame = useCurrentFrame()
  const line = progress(frame, 18, 36)
  return (
    <Stage center>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Img src={staticFile('lens-arc-white.png')} alt={copy.headline} style={{ height: 96, ...rise(frame, 4, 32, 16) }} />
        <div style={{ width: 280 * line, height: 2, backgroundColor: color.accent, margin: '48px 0', opacity: line }} />
        <div style={{ fontSize: type.sub, color: color.text, letterSpacing: '0.02em', ...rise(frame, 16, 32, 12) }}>{copy.url}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: GUTTER,
          right: GUTTER,
          bottom: 80,
          textAlign: 'center',
          fontSize: type.label,
          lineHeight: 1.5,
          maxWidth: 1400,
          margin: '0 auto',
          color: color.dim,
          ...rise(frame, 10, 24, 0),
        }}
      >
        {fill(copy.disclaimer)}
      </div>
    </Stage>
  )
}
