export function formatShortDateLabel(value: string | null | undefined) {
  if (!value) {
    return '--/--'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '--/--'
  }

  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${month}/${day}`
}

export function formatTokyoDateTime(value: string | null | undefined) {
  if (!value) {
    return '未知'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '未知'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
