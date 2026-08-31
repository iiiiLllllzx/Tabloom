import type { WindowSwitcherNavigationKey } from '../types'
import { isWindowSwitcherShortcut } from './window-switcher'

export const WINDOW_SWITCHER_CAPTURE_TIMEOUT_MS = 10_000

interface WindowSwitcherKeyboardCaptureOptions {
  target: Window
  onOpen: () => void
  onNavigate: (key: WindowSwitcherNavigationKey) => void
  timeoutMs?: number
}

const NAVIGATION_KEYS = new Set<WindowSwitcherNavigationKey>([
  'ArrowUp',
  'ArrowDown',
  'Enter',
  'Escape',
])

export function createWindowSwitcherKeyboardCapture({
  target,
  onOpen,
  onNavigate,
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
      active = false
      timeoutId = undefined
    }, timeoutMs)
  }

  function setActive(nextActive: boolean): void {
    active = nextActive
    if (active) armTimer()
    else clearTimer()
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

    if (event.type === 'keyup' && suppressedUntilKeyUp.has(event.key)) {
      suppressedUntilKeyUp.delete(event.key)
      suppress(event)
      return
    }

    const key = event.key as WindowSwitcherNavigationKey
    if (!active || !NAVIGATION_KEYS.has(key)) return

    suppress(event)
    if (event.type !== 'keydown') return

    suppressedUntilKeyUp.add(key)
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
