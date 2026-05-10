export function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E8E6E0', borderRadius: '8px' }}>
      <p style={{ fontSize: '11px', color: '#8A8880', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: '15px', fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  )
}
