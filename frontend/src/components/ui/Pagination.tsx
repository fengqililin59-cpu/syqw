export default function Pagination({
  page,
  pageSize: _pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const totalPages = Math.ceil(total / _pageSize)
  if (totalPages <= 1) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        style={{ padding: '8px 16px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14 }}
      >
        上一页
      </button>
      <span style={{ fontSize: 14, color: '#6B7280' }}>{page} / {totalPages}</span>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        style={{ padding: '8px 16px', border: '1px solid #D1D5DB', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 14 }}
      >
        下一页
      </button>
    </div>
  )
}
