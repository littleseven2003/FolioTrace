/**
 * main、preload 与 renderer 共享的调用结果。
 * 失败只返回稳定错误码与可读中文消息，不把内部异常或堆栈传给界面。
 */

export type FolioErrorCode =
  | 'INTERNAL_ERROR'
  | 'UNTRUSTED_SOURCE'
  | 'PROJECT_NOT_FOUND'
  | 'INVALID_PROJECT_PATH'
  | 'PERMISSION_DENIED'
  | 'PATH_OUTSIDE_ROOT'

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
  untrustedSource: '当前页面无权访问本地应用接口。',
  projectNotFound: '项目授权已失效，请重新选择文件夹。',
  invalidProjectPath: '所选路径不是可读取的文件夹。',
  permissionDenied: '没有读取该文件夹的权限。',
  projectOpenFailed: '无法打开文件夹选择器，请稍后重试。',
  scanFailed: '扫描文件失败，请稍后重试。'
} as const

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T = never>(code: FolioErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } }
}
