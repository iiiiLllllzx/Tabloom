import { createWindowSwitcherKeyboardCapture } from '../src/lib/window-switcher-capture'
import type {
  ContentRequest,
  RuntimeRequest,
  RuntimeResponse,
} from '../src/types'

interface CaptureScope extends Window {
  __tabloomWindowSwitcherCaptureInstalled?: boolean
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_start',
  main() {
    const scope = window as CaptureScope
    if (scope.__tabloomWindowSwitcherCaptureInstalled) return
    scope.__tabloomWindowSwitcherCaptureInstalled = true

    const keyboardCapture = createWindowSwitcherKeyboardCapture({
      target: window,
      onOpen: () => {
        const request: RuntimeRequest = { type: 'SIDEPANEL_OPEN' }
        void chrome.runtime.sendMessage(request)
      },
      onNavigate: (key) => {
        const request: RuntimeRequest = { type: 'SIDEPANEL_KEY', key }
        void chrome.runtime.sendMessage(request)
      },
    })

    chrome.runtime.onMessage.addListener(
      (
        request: ContentRequest,
        _sender,
        sendResponse: (response: RuntimeResponse) => void,
      ) => {
        if (request.type === 'CONTENT_WINDOW_SWITCHER_MODE') {
          keyboardCapture.setActive(request.active)
          sendResponse({ ok: true })
        }
      },
    )
  },
})
