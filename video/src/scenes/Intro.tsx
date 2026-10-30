import { Img, staticFile, useCurrentFrame } from 'remotion'
import { FULL_CUT } from '../config'
import { Stage } from '../components/Stage'
import { progress, rise } from '../components/motion'
import { color, type } from '../theme'

const copy = FULL_CUT.scenes.find((s) => s.id === 'intro')!.copy

// One idea: what Lens Arc is.
export const Intro = () => {
  const frame = useCurrentFrame()
  const line = progress(frame, 34, 40)
  return (
    <Stage center>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Img src={staticFile('lens-arc-white.png')} style={{ height: 64, ...rise(frame, 4, 36, 16) }} />
        <div style={{ width: 360 * line, height: 2, backgroundColor: color.accent, margin: '56px 0', opacity: line }} />
        <div style={{ fontSize: type.hero, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, ...rise(frame, 20, 36) }}>
          {copy.headline}
        </div>
        <div style={{ fontSize: type.sub, color: color.dim, marginTop: 36, ...rise(frame, 40, 36) }}>{copy.sub}</div>
      </div>
    </Stage>
  )
}
