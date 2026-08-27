export const WINDOW_SWITCHER_COMMAND = 'open-window-switcher-v2'
export const WINDOW_SWITCHER_KEY = 'k'

export function isWindowSwitcherShortcut(event: KeyboardEvent): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === WINDOW_SWITCHER_KEY
  )
}

export function openWindowSwitcherFromCommand(
  command: string,
  tab?: chrome.tabs.Tab,
): boolean {
  if (command !== WINDOW_SWITCHER_COMMAND || tab?.windowId === undefined) {
    return false
  }

  // Invoke immediately in the command event stack to retain the user gesture.
  void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined)
  return true
}
