import { useEffect } from 'react'

/*
  Global single-key hotkey. Pressing `key` (case-insensitive) anywhere fires
  `onTrigger` so common actions can be driven from the keyboard (e.g. `a` to add
  a position, `m` to manage holdings on the dashboard).

  Guards: ignored while typing in an input/textarea/select/contenteditable (so
  the key types normally into a field), while any modifier is held (Cmd/Ctrl/Alt
  combos are left for the browser/OS), and while `enabled` is false (pass false
  whenever a modal/drawer is already open so a second press is a no-op).
*/
export function useHotkey(key: string, onTrigger: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const target = key.toLowerCase()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== target) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
          return
        }
      }
      e.preventDefault()
      onTrigger()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, onTrigger, enabled])
}
