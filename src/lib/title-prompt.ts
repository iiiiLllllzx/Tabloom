export function promptForTabTitle(initialValue: string): string | null {
  const nextTitle = window.prompt(
    '为当前标签页设置一个容易识别的标题：',
    initialValue || document.title,
  )
  if (nextTitle === null) {
    return null
  }

  const title = nextTitle.trim()
  if (!title) {
    window.alert('标题不能为空；如需恢复原始标题，请在 Tabloom 弹窗中点击“恢复”。')
    return null
  }
  return title
}

export async function requestTitleFromTab(
  tabId: number,
  initialValue: string,
): Promise<string | null> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: promptForTabTitle,
    args: [initialValue],
  })
  return injection?.result ?? null
}
