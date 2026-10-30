import type { ComponentType } from 'react'
import type { SceneId } from '../config'
import { Placeholder } from '../components/Placeholder'
import { Intro } from './Intro'
import { Portfolio } from './Portfolio'

const todo = (id: SceneId) => () => <Placeholder id={id} />

// Scene id (config.ts) -> component.
export const SCENES: Record<SceneId, ComponentType> = {
  intro: Intro,
  portfolio: Portfolio,
  analyzers: todo('analyzers'),
  caution: todo('caution'),
  brief: todo('brief'),
  actions: todo('actions'),
  end: todo('end'),
}
