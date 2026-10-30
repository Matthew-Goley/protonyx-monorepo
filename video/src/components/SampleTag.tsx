import { SAMPLE_TAG } from '../config'
import { color, GUTTER, type } from '../theme'

// Persistent label on every scene that shows engine data.
export const SampleTag = () => (
  <div
    style={{
      position: 'absolute',
      top: 56,
      right: GUTTER,
      fontSize: type.tag,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: color.dim,
      border: `1px solid ${color.faint}`,
      borderRadius: 999,
      padding: '10px 22px',
    }}
  >
    {SAMPLE_TAG}
  </div>
)
