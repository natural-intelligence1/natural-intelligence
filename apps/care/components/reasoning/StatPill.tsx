export function StatPill({
  label,
  value,
  alert,
}: {
  label: string
  value: string
  alert?: boolean
}) {
  return (
    <div style={{
      padding:    '8px 14px',
      background: alert ? '#FEF2F2' : '#F4F3F0',
      borderRadius: '8px',
      border:     `1px solid ${alert ? '#FECACA' : '#E8E6E0'}`,
    }}>
      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A8880', margin: '0 0 2px', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: alert ? '#DC2626' : '#1A1917' }}>
        {value}
      </p>
    </div>
  )
}
