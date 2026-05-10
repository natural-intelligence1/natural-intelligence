import { EntryTypeBadge } from './EntryTypeBadge'
import { ConfidenceBar }  from './ConfidenceBar'
import { AGENT_LABELS }   from './constants'

export interface TimelineEntryProps {
  entry: {
    id:           string
    agent_name:   string
    entry_type:   string
    system_area:  string | null
    content:      string
    confidence:   number | null
    priority:     number | null
    visibility:   string
  }
  index: number
}

export function TimelineEntry({ entry, index }: TimelineEntryProps) {
  const isFirst = index === 0
  return (
    <div style={{
      padding:          '16px 18px',
      background:       '#FFFFFF',
      border:           '1px solid #E8E6E0',
      borderTopWidth:   isFirst ? '1px' : '0',
      borderRadius:     isFirst ? '8px 8px 0 0' : '0',
      display:          'grid',
      gridTemplateColumns: '1fr auto',
      gap:              '12px',
      alignItems:       'start',
    }}>
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <EntryTypeBadge type={entry.entry_type} />
          <span style={{ fontSize: '12px', color: '#8A8880' }}>
            {AGENT_LABELS[entry.agent_name] ?? entry.agent_name}
          </span>
          {entry.system_area && (
            <span style={{ fontSize: '11px', background: '#F4F3F0', padding: '2px 6px', borderRadius: '3px', color: '#555350' }}>
              {entry.system_area}
            </span>
          )}
          {entry.visibility !== 'practitioner' && (
            <span style={{ fontSize: '10px', background: '#EEF6FF', color: '#2563EB', padding: '1px 5px', borderRadius: '3px', border: '1px solid #BFDBFE' }}>
              {entry.visibility}
            </span>
          )}
        </div>
        <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#1A1917' }}>
          {entry.content}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        {entry.priority !== null && (
          <span style={{ fontSize: '11px', color: '#8A8880' }}>P{entry.priority}</span>
        )}
        <ConfidenceBar value={entry.confidence} />
      </div>
    </div>
  )
}
