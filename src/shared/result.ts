/**
 * main、preload 与 renderer 共享的调用结果。
 * 失败只返回稳定错误码与可读中文消息，不把内部异常或堆栈传给界面。
 */

export type FolioErrorCode = 'INTERNAL_ERROR' | 'UNTRUSTED_SOURCE'

export interface FolioError {
  code: FolioErrorCode
  message: string
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: FolioError }

export const ERROR_MESSAGES = {
  snapshotUnavailable: '暂时无法读取项目快照，请稍后重试。',
  runtimeUnavailable: '暂时无法读取运行时信息。',
  bridgeUnavailable: '无法连接主进程，请稍后重试。',
  untrustedSource: '当前页面无权访问本地应用接口。'
} as const

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T = never>(code: FolioErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } }
}
