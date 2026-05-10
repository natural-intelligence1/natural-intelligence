export function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return null
  const pct = Math.round(value * 100)
  const fill = value >= 0.7 ? '#15803D' : value >= 0.4 ? '#D97706' : '#DC2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '64px', height: '4px', borderRadius: '2px', background: '#E8E6E0', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: fill, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '12px', color: '#8A8880' }}>{pct}%</span>
    </div>
  )
}
