import { ENTRY_TYPE_COLORS, ENTRY_TYPE_LABELS } from './constants'

export function EntryTypeBadge({ type }: { type: string }) {
  const style = ENTRY_TYPE_COLORS[type] ?? { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
  return (
    <span style={{
      display:      'inline-block',
      padding:      '2px 8px',
      borderRadius: '4px',
      fontSize:     '11px',
      fontWeight:   600,
      background:   style.bg,
      color:        style.text,
      border:       `1px solid ${style.border}`,
    }}>
      {ENTRY_TYPE_LABELS[type] ?? type}
    </span>
  )
}
