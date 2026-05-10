export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{
        fontSize:      '13px',
        fontWeight:    600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color:         '#8A8880',
        marginBottom:  '14px',
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}
