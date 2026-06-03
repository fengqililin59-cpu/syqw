/**
 * @file 浏览器端 CSV 下载（UTF-8 BOM，Excel 友好）。
 */
export function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: unknown) => `"${String(cell ?? '').replace(/"/g, '""')}"`
  const body = rows.map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
