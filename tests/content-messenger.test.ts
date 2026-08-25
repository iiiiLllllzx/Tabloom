import {
  ensureContentScript,
  isInjectableTabUrl,
  sendToTabWithInjection,
} from '../src/lib/content-messenger'

describe('内容脚本消息兜底', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['https://example.com', true],
    ['http://example.com/path', true],
    ['chrome://settings', false],
    ['file:///notes.txt', false],
    [undefined, false],
  ])('判断可注入 URL：%s', (url, expected) => {
    expect(isInjectableTabUrl(url)).toBe(expected)
  })

  it('已有内容脚本时只发送 ping，不重复注入', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true })
    const executeScript = vi.fn()
    vi.stubGlobal('chrome', {
      tabs: { sendMessage },
      scripting: { executeScript },
    })

    await ensureContentScript(7)

    expect(sendMessage).toHaveBeenCalledWith(7, { type: 'CONTENT_PING' })
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('旧内容脚本未响应 ping 时重新注入', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    const executeScript = vi.fn().mockResolvedValue([])
    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage,
        get: vi.fn().mockResolvedValue({
          id: 7,
          url: 'https://example.com',
        }),
      },
      scripting: { executeScript },
    })

    await ensureContentScript(7)

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content-scripts/content.js'],
    })
  })

  it('同一标签页的并发检查只注入一次', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('Receiving end does not exist'))
    const executeScript = vi.fn().mockResolvedValue([])
    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage,
        get: vi.fn().mockResolvedValue({
          id: 8,
          url: 'https://example.com',
        }),
      },
      scripting: { executeScript },
    })

    const first = ensureContentScript(8)
    const second = ensureContentScript(8)
    expect(second).toBe(first)
    await Promise.all([first, second])

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(executeScript).toHaveBeenCalledTimes(1)
  })

  it('旧页面没有接收端时补注入并重试标题消息', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ ok: true })
    const executeScript = vi.fn().mockResolvedValue([])
    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage,
        get: vi.fn().mockResolvedValue({
          id: 7,
          url: 'https://example.com',
        }),
      },
      scripting: { executeScript },
    })

    await sendToTabWithInjection(7, {
      type: 'CONTENT_APPLY_TITLE',
      title: '训练任务',
    })

    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content-scripts/content.js'],
    })
    expect(sendMessage).toHaveBeenLastCalledWith(7, {
      type: 'CONTENT_APPLY_TITLE',
      title: '训练任务',
    })
  })

  it('受限页面明确报错而不是误判接收端', async () => {
    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage: vi
          .fn()
          .mockRejectedValue(new Error('Receiving end does not exist')),
        get: vi.fn().mockResolvedValue({
          id: 7,
          url: 'chrome://settings',
        }),
      },
      scripting: { executeScript: vi.fn() },
    })

    await expect(
      ensureContentScript(7),
    ).rejects.toThrow('此页面受 Chrome 限制，无法修改标题。')
  })
})
