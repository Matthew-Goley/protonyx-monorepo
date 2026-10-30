import { AbsoluteFill, Series } from 'remotion'
import { FULL_CUT, sceneFrames } from './config'
import { SCENES } from './scenes'
import { color } from './theme'

// The full cut: config scenes back to back, each with its configured length.
export const FullCut = () => (
  <AbsoluteFill style={{ backgroundColor: color.bg }}>
    <Series>
      {FULL_CUT.scenes.map((s) => {
        const Scene = SCENES[s.id]
        return (
          <Series.Sequence key={s.id} durationInFrames={sceneFrames(s)} name={s.id}>
            <Scene />
          </Series.Sequence>
        )
      })}
    </Series>
  </AbsoluteFill>
)
