import type { FileCategory } from '../shared/files'

/** 内部管理目录不进入文件清单，也不作为扫描入口。 */
export const INTERNAL_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  '.git',
  '.docwork',
  'node_modules',
  '.svn',
  '.hg'
])

/** 常见系统临时文件不作为业务文件展示。 */
export const INTERNAL_FILE_NAMES: ReadonlySet<string> = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini'
])

const CATEGORY_BY_EXTENSION: Readonly<Record<string, FileCategory>> = {
  doc: 'document',
  docx: 'document',
  odt: 'document',
  pages: 'document',
  rtf: 'document',
  ppt: 'presentation',
  pptx: 'presentation',
  key: 'presentation',
  odp: 'presentation',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  numbers: 'spreadsheet',
  pdf: 'pdf',
  md: 'text',
  markdown: 'text',
  txt: 'text',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image'
}

export function isInternalDirectoryName(name: string): boolean {
  return INTERNAL_DIRECTORY_NAMES.has(name)
}

export function isInternalFileName(name: string): boolean {
  return INTERNAL_FILE_NAMES.has(name)
}

/** 从文件名推导展示类型与分类；不做文件内容检查。 */
export function classifyFileName(fileName: string): {
  type: string
  category: FileCategory
} {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return { type: '无扩展名', category: 'other' }
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase()
  return {
    type: extension.toUpperCase(),
    category: CATEGORY_BY_EXTENSION[extension] ?? 'other'
  }
}
