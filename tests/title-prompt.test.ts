import {
  promptForTabTitle,
  requestTitleFromTab,
} from '../src/lib/title-prompt'

describe('标签标题输入框', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('去除标题首尾空白', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('  训练任务  ')

    expect(promptForTabTitle('')).toBe('训练任务')
  })

  it('空标题提示错误且不提交', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ')
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

    expect(promptForTabTitle('')).toBeNull()
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('每次请求只向主 frame 注入一次输入框', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      { frameId: 0, result: '精度对比' },
    ])
    vi.stubGlobal('chrome', {
      scripting: { executeScript },
    })

    await expect(requestTitleFromTab(12, '原标题')).resolves.toBe('精度对比')
    expect(executeScript).toHaveBeenCalledTimes(1)
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 12 },
      func: promptForTabTitle,
      args: ['原标题'],
    })
  })
})
