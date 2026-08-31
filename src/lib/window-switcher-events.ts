import type { WindowSwitcherNavigationKey } from '../types'

export const WINDOW_SWITCHER_EVENT_SOURCE = 'tabloom-window-switcher-v1'

export type WindowSwitcherPageMessage =
  | {
      source: typeof WINDOW_SWITCHER_EVENT_SOURCE
      type: 'mode'
      active: boolean
    }
  | {
      source: typeof WINDOW_SWITCHER_EVENT_SOURCE
      type: 'open'
    }
  | {
      source: typeof WINDOW_SWITCHER_EVENT_SOURCE
      type: 'navigate'
      key: WindowSwitcherNavigationKey
    }

export function isWindowSwitcherPageMessage(
  value: unknown,
): value is WindowSwitcherPageMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<WindowSwitcherPageMessage>
  return message.source === WINDOW_SWITCHER_EVENT_SOURCE
}
