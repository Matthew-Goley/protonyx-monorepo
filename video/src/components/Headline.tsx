import { useCurrentFrame } from 'remotion'
import { color, type } from '../theme'
import { rise } from './motion'

export const Headline = ({ text, sub, start = 6 }: { text: string; sub?: string; start?: number }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      <div
        style={{
          fontSize: type.headline,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          ...rise(frame, start),
        }}
      >
        {text}
      </div>
      {sub ? (
        <div style={{ fontSize: type.sub, color: color.dim, marginTop: 28, ...rise(frame, start + 12) }}>{sub}</div>
      ) : null}
    </div>
  )
}
