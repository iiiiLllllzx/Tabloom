import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { SidePanelApp } from '../entrypoints/sidepanel/App'
import type { RuntimeRequest } from '../src/types'

function chromeEvent() {
  return {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }
}

function stubChrome() {
  const update = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn().mockResolvedValue(undefined)
  const runtimeListeners: Array<(request: RuntimeRequest) => void> = []
  const runtimeOnMessage = {
    addListener: vi.fn((listener: (request: RuntimeRequest) => void) => {
      runtimeListeners.push(listener)
    }),
    removeListener: vi.fn((listener: (request: RuntimeRequest) => void) => {
      const index = runtimeListeners.indexOf(listener)
      if (index >= 0) runtimeListeners.splice(index, 1)
    }),
  }
  const windows = [
    {
      id: 10,
      focused: true,
      tabs: [
        {
          id: 1,
          active: true,
          title: '训练任务',
          url: 'https://ml.bytedance.net/train',
        },
      ],
    },
    {
      id: 20,
      focused: false,
      tabs: [
        {
          id: 2,
          active: true,
          title: '精度对比',
          url: 'https://code.byted.org/compare',
        },
      ],
    },
    {
      id: 30,
      focused: false,
      tabs: [
        {
          id: 3,
          active: true,
          title: '模型迁移',
          url: 'https://example.com/migrate',
        },
      ],
    },
  ]

  vi.stubGlobal('chrome', {
    windows: {
      getAll: vi.fn().mockResolvedValue(windows),
      getCurrent: vi.fn().mockResolvedValue({ id: 10 }),
      update,
      create: vi.fn().mockResolvedValue(undefined),
      onCreated: chromeEvent(),
      onRemoved: chromeEvent(),
      onFocusChanged: chromeEvent(),
    },
    tabs: {
      onCreated: chromeEvent(),
      onRemoved: chromeEvent(),
      onUpdated: chromeEvent(),
    },
    storage: {
      session: {
        get: vi.fn().mockResolvedValue({
          windowMeta: {
            10: { name: '模型训练', letter: 'A', color: '#2f6bd4' },
            20: { name: '精度对比', letter: 'B', color: '#d44a1b' },
            30: { name: '模型迁移', letter: 'C', color: '#23734f' },
          },
        }),
        set: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: chromeEvent(),
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      onMessage: runtimeOnMessage,
    },
    sidePanel: { close },
  })

  return {
    update,
    close,
    sendRuntimeMessage(request: RuntimeRequest) {
      runtimeListeners.forEach((listener) => listener(request))
    },
  }
}

describe('Side Panel 键盘切换', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('默认选中当前窗口，方向键循环移动选择', async () => {
    stubChrome()
    render(<SidePanelApp />)

    const shell = await screen.findByLabelText('任务窗口切换器')
    const first = screen.getByRole('button', { name: /模型训练/ })
    const second = screen.getByRole('button', { name: /精度对比/ })
    const third = screen.getByRole('button', { name: /模型迁移/ })

    await waitFor(() => expect(first).toHaveClass('selected'))
    expect(shell).toHaveFocus()

    fireEvent.keyDown(shell, { key: 'ArrowDown' })
    expect(second).toHaveClass('selected')

    fireEvent.keyDown(shell, { key: 'ArrowDown' })
    expect(third).toHaveClass('selected')

    fireEvent.keyDown(shell, { key: 'ArrowDown' })
    expect(first).toHaveClass('selected')

    fireEvent.keyDown(shell, { key: 'ArrowUp' })
    expect(third).toHaveClass('selected')
  })

  it('回车聚焦选中窗口并关闭来源窗口的 Side Panel', async () => {
    const { update, close } = stubChrome()
    render(<SidePanelApp />)

    const shell = await screen.findByLabelText('任务窗口切换器')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /模型训练/ })).toHaveClass(
        'selected',
      ),
    )

    fireEvent.keyDown(shell, { key: 'ArrowDown' })
    fireEvent.keyDown(shell, { key: 'Enter' })

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(20, { focused: true })
      expect(close).toHaveBeenCalledWith({ windowId: 10 })
    })
  })

  it('响应普通网页转发的方向键和回车', async () => {
    const { update, close, sendRuntimeMessage } = stubChrome()
    render(<SidePanelApp />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /模型训练/ })).toHaveClass(
        'selected',
      ),
    )

    act(() => {
      sendRuntimeMessage({ type: 'SIDEPANEL_KEY', key: 'ArrowDown' })
    })
    expect(screen.getByRole('button', { name: /精度对比/ })).toHaveClass(
      'selected',
    )

    act(() => {
      sendRuntimeMessage({ type: 'SIDEPANEL_KEY', key: 'Enter' })
    })
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(20, { focused: true })
      expect(close).toHaveBeenCalledWith({ windowId: 10 })
    })
  })

  it('Escape 关闭当前 Side Panel 且不切换窗口', async () => {
    const { update, close } = stubChrome()
    render(<SidePanelApp />)

    const shell = await screen.findByLabelText('任务窗口切换器')
    await waitFor(() => expect(shell).toHaveFocus())
    fireEvent.keyDown(shell, { key: 'Escape' })

    await waitFor(() => expect(close).toHaveBeenCalledWith({ windowId: 10 }))
    expect(update).not.toHaveBeenCalled()
  })
})
