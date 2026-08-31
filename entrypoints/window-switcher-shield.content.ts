import { createWindowSwitcherKeyboardCapture } from '../src/lib/window-switcher-capture'
import { createWindowSwitcherFocusGuard } from '../src/lib/window-switcher-focus'
import {
  isWindowSwitcherPageMessage,
  WINDOW_SWITCHER_EVENT_SOURCE,
  type WindowSwitcherPageMessage,
} from '../src/lib/window-switcher-events'

interface ShieldScope extends Window {
  __tabloomWindowSwitcherShieldV2Installed?: boolean
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const scope = window as ShieldScope
    if (scope.__tabloomWindowSwitcherShieldV2Installed) return
    scope.__tabloomWindowSwitcherShieldV2Installed = true

    function post(message: WindowSwitcherPageMessage): void {
      window.postMessage(message, '*')
    }

    const focusGuard = createWindowSwitcherFocusGuard(document)
    const keyboardCapture = createWindowSwitcherKeyboardCapture({
      target: window,
      onActiveChange: focusGuard.setActive,
      onOpen: () => {
        post({
          source: WINDOW_SWITCHER_EVENT_SOURCE,
          type: 'open',
        })
      },
      onNavigate: (key) => {
        post({
          source: WINDOW_SWITCHER_EVENT_SOURCE,
          type: 'navigate',
          key,
        })
      },
    })

    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (event.source !== window || !isWindowSwitcherPageMessage(event.data)) {
        return
      }
      if (event.data.type === 'mode') {
        keyboardCapture.setActive(event.data.active)
      }
    })
  },
})
