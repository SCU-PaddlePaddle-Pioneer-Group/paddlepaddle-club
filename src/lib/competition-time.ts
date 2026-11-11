/**
 * ISO 8601 → 北京时间展示文本（YYYY-MM-DD HH:mm）。
 * 界面按北京时间展示是契约要求（细则 §8）。
 */
export function formatBeijingTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replaceAll('/', '-')
}

/**
 * ISO 8601 → datetime-local 输入框值（北京时间，YYYY-MM-DDTHH:mm:ss）。
 * 保留秒数（PR #14 复查意见：编辑保存不丢秒），配合输入框 step=1 使用。
 */
export function isoToLocalInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return (
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(date)
      .replaceAll('/', '-')
      .replace(' ', 'T')
  )
}

/**
 * datetime-local 无时区值 → UTC ISO 8601 字符串。
 * 按北京时间（+08:00）解释输入值，转换结果与机器时区无关（契约：拒绝无时区本地时间）。
 * 供编辑表单提交前调用；无效输入返回空字符串。
 */
export function isoFromLocalInput(local: string): string {
  if (!local) return ''
  // datetime-local 默认精度到分钟（16 字符），含秒（19 字符）时原样使用
  const withSeconds = local.length === 16 ? `${local}:00` : local
  const date = new Date(`${withSeconds}+08:00`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
