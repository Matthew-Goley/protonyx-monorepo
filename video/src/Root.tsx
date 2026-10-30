import { Composition } from 'remotion'
import { FPS, fullCutFrames, HEIGHT, HERO_LOOP, WIDTH } from './config'
import { FullCut } from './FullCut'
import { HeroLoop } from './HeroLoop'

export const Root = () => (
  <>
    <Composition id="FullCut" component={FullCut} durationInFrames={fullCutFrames()} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition
      id="HeroLoop"
      component={HeroLoop}
      durationInFrames={Math.round(HERO_LOOP.seconds * FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
)
