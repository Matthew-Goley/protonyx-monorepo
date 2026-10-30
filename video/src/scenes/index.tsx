import type { ComponentType } from 'react'
import type { SceneId } from '../config'
import { Placeholder } from '../components/Placeholder'

const todo = (id: SceneId) => () => <Placeholder id={id} />

// Scene id (config.ts) -> component.
export const SCENES: Record<SceneId, ComponentType> = {
  intro: todo('intro'),
  portfolio: todo('portfolio'),
  analyzers: todo('analyzers'),
  caution: todo('caution'),
  brief: todo('brief'),
  actions: todo('actions'),
  end: todo('end'),
}
