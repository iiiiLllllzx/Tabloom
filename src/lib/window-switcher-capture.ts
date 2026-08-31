import type { WindowSwitcherNavigationKey } from '../types'
import { isWindowSwitcherShortcut } from './window-switcher'

export const WINDOW_SWITCHER_CAPTURE_TIMEOUT_MS = 10_000

interface WindowSwitcherKeyboardCaptureOptions {
  target: Window
  onOpen: () => void
  onNavigate: (key: WindowSwitcherNavigationKey) => void
  onActiveChange?: (active: boolean) => void
  timeoutMs?: number
}

const NAVIGATION_KEYS = new Set<WindowSwitcherNavigationKey>([
  'ArrowUp',
  'ArrowDown',
  'Enter',
  'Escape',
])

function toNavigationKey(key: string): WindowSwitcherNavigationKey | undefined {
  const normalizedKey = key.toLowerCase()
  if (normalizedKey === 'w') return 'ArrowUp'
  if (normalizedKey === 's') return 'ArrowDown'
  return NAVIGATION_KEYS.has(key as WindowSwitcherNavigationKey)
    ? (key as WindowSwitcherNavigationKey)
    : undefined
}

export function createWindowSwitcherKeyboardCapture({
  target,
  onOpen,
  onNavigate,
  onActiveChange,
  timeoutMs = WINDOW_SWITCHER_CAPTURE_TIMEOUT_MS,
}: WindowSwitcherKeyboardCaptureOptions) {
  let active = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const suppressedUntilKeyUp = new Set<string>()

  function clearTimer(): void {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  function armTimer(): void {
    clearTimer()
    timeoutId = setTimeout(() => {
      timeoutId = undefined
      setActive(false)
    }, timeoutMs)
  }

  function setActive(nextActive: boolean): void {
    const changed = active !== nextActive
    active = nextActive
    if (active) armTimer()
    else clearTimer()
    if (changed) onActiveChange?.(active)
  }

  function suppress(event: KeyboardEvent): void {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  function handleKeyboardEvent(event: KeyboardEvent): void {
    const shortcut = isWindowSwitcherShortcut(event)
    if (shortcut) {
      suppress(event)
      if (event.type === 'keydown') {
        setActive(true)
        onOpen()
      } else if (active) {
        armTimer()
      }
      return
    }

    const keyToken = event.key.toLowerCase()
    if (event.type === 'keyup' && suppressedUntilKeyUp.has(keyToken)) {
      suppressedUntilKeyUp.delete(keyToken)
      suppress(event)
      return
    }

    const key = toNavigationKey(event.key)
    if (!active || key === undefined) return

    suppress(event)
    if (event.type !== 'keydown') return

    suppressedUntilKeyUp.add(keyToken)
    armTimer()
    onNavigate(key)
    if (key === 'Enter' || key === 'Escape') {
      setActive(false)
    }
  }

  target.addEventListener('keydown', handleKeyboardEvent, true)
  target.addEventListener('keyup', handleKeyboardEvent, true)

  return {
    setActive,
    isActive: () => active,
    dispose() {
      clearTimer()
      suppressedUntilKeyUp.clear()
      target.removeEventListener('keydown', handleKeyboardEvent, true)
      target.removeEventListener('keyup', handleKeyboardEvent, true)
    },
  }
}
