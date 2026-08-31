import {
  isWindowSwitcherPageMessage,
  WINDOW_SWITCHER_EVENT_SOURCE,
  type WindowSwitcherPageMessage,
} from '../src/lib/window-switcher-events'
import type {
  ContentRequest,
  RuntimeRequest,
  RuntimeResponse,
} from '../src/types'

interface CaptureScope extends Window {
  __tabloomWindowSwitcherCaptureV2Installed?: boolean
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    const scope = window as CaptureScope
    if (scope.__tabloomWindowSwitcherCaptureV2Installed) return
    scope.__tabloomWindowSwitcherCaptureV2Installed = true
    let active = false

    window.addEventListener(
      'message',
      (event: MessageEvent<unknown>) => {
        if (
          event.source !== window ||
          !isWindowSwitcherPageMessage(event.data)
        ) {
          return
        }
        if (event.data.type === 'open') {
          active = true
          const request: RuntimeRequest = { type: 'SIDEPANEL_OPEN' }
          void chrome.runtime.sendMessage(request)
        } else if (event.data.type === 'navigate' && active) {
          if (event.data.key === 'Enter' || event.data.key === 'Escape') {
            active = false
          }
          const request: RuntimeRequest = {
            type: 'SIDEPANEL_KEY',
            key: event.data.key,
          }
          void chrome.runtime.sendMessage(request)
        }
      },
      false,
    )

    chrome.runtime.onMessage.addListener(
      (
        request: ContentRequest,
        _sender,
        sendResponse: (response: RuntimeResponse) => void,
      ) => {
        if (request.type !== 'CONTENT_WINDOW_SWITCHER_MODE') return
        const message: WindowSwitcherPageMessage = {
          source: WINDOW_SWITCHER_EVENT_SOURCE,
          type: 'mode',
          active: request.active,
        }
        active = request.active
        window.postMessage(message, '*')
        sendResponse({ ok: true })
      },
    )
  },
})
