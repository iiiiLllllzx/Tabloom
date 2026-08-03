import type { RuntimeRequest, RuntimeResponse } from '../types'

export class RuntimeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'RuntimeError'
  }
}

export async function sendRequest<T>(request: RuntimeRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as RuntimeResponse<T>
  if (!response?.ok) {
    throw new RuntimeError(
      response?.error?.message ?? '扩展后台没有返回有效结果',
      response?.error?.code ?? 'CHROME_API_ERROR',
    )
  }
  return response.data as T
}
