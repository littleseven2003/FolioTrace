const generatedAtFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

export function formatGeneratedAt(isoTime: string): string {
  const timestamp = Date.parse(isoTime)
  if (Number.isNaN(timestamp)) return '时间未知'
  return generatedAtFormatter.format(timestamp)
}
