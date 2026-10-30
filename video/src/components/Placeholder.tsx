import { Stage } from './Stage'
import { color, type } from '../theme'

// Stand-in for a scene that has not been built yet.
export const Placeholder = ({ id }: { id: string }) => (
  <Stage center>
    <div style={{ fontSize: type.sub, color: color.faint }}>{id}</div>
  </Stage>
)
