import type { ComponentType } from 'react'
import type { SceneId } from '../config'
import { Placeholder } from '../components/Placeholder'
import { Actions } from './Actions'
import { Analyzers } from './Analyzers'
import { Brief } from './Brief'
import { Caution } from './Caution'
import { Intro } from './Intro'
import { Portfolio } from './Portfolio'

const todo = (id: SceneId) => () => <Placeholder id={id} />

// Scene id (config.ts) -> component.
export const SCENES: Record<SceneId, ComponentType> = {
  intro: Intro,
  portfolio: Portfolio,
  analyzers: Analyzers,
  caution: Caution,
  brief: Brief,
  actions: Actions,
  end: todo('end'),
}
