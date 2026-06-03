export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 360, maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#374151' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 20px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ padding: '8px 20px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
