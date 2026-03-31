import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'

export default function StudyReport() {
  const { token } = useParams()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch(`/api/public?action=get-report&token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report.'); setLoading(false) })
  }, [token])

  const s = {
    page:    { minHeight: '100vh', background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif', padding: 'clamp(24px,5vw,48px) 16px' },
    wrap:    { maxWidth: 780, margin: '0 auto' },
    h1:      { fontSize: 'clamp(22px,4vw,32px)', fontWeight: 700, color: '#111827', marginBottom: 6 },
    h2:      { fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 12 },
    sub:     { fontSize: 14, color: '#6b7280', marginBottom: 32, lineHeight: 1.6 },
    card:    { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
    label:   { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' },
    tag:     (color) => ({ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: color + '18', color }),
    divider: { border: 'none', borderTop: '1px solid #f3f4f6', margin: '16px 0' },
    quoteBlock: { background: '#f9fafb', borderLeft: '3px solid #6366f1', padding: '10px 14px', borderRadius: '0 8px 8px 0', fontStyle: 'italic', fontSize: 13.5, color: '#374151' },
    err: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 },
  }

  const statusColor = { booked: '#6366f1', completed: '#10b981', cancelled: '#ef4444', 'no-show': '#f59e0b', screened: '#8b5cf6' }

  const renderEditorContent = (value) => {
    if (!value) return null
    // Extract text from a list item — handles both string items and object items { content, items }
    const itemText = (item) => typeof item === 'string' ? item : (item?.content || item?.text || '')
    try {
      const doc = typeof value === 'string' ? JSON.parse(value) : value
      if (!doc?.blocks) throw new Error()
      return (doc.blocks || []).map((block, i) => {
        const text = block.data?.text || ''
        if (block.type === 'header') {
          return <div key={i} style={{ fontWeight: 600, fontSize: block.data?.level <= 2 ? 16 : 14, marginTop: 12, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: text }} />
        }
        if (block.type === 'list') {
          const Tag = block.data?.style === 'ordered' ? 'ol' : 'ul'
          return <Tag key={i} style={{ paddingLeft: 20, marginBottom: 8 }}>{(block.data?.items || []).map((item, j) => <li key={j} dangerouslySetInnerHTML={{ __html: itemText(item) }} />)}</Tag>
        }
        if (block.type === 'checklist') {
          return (
            <ul key={i} style={{ paddingLeft: 0, listStyle: 'none', marginBottom: 8 }}>
              {(block.data?.items || []).map((item, j) => (
                <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <span style={{ marginTop: 2, flexShrink: 0 }}>{item.checked ? '☑' : '☐'}</span>
                  <span dangerouslySetInnerHTML={{ __html: item.text || '' }} />
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'quote') {
          return <blockquote key={i} style={{ borderLeft: '3px solid #6366f1', paddingLeft: 12, margin: '8px 0', fontStyle: 'italic', color: '#4b5563' }} dangerouslySetInnerHTML={{ __html: text }} />
        }
        if (block.type === 'delimiter') {
          return <hr key={i} style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
        }
        return text ? <p key={i} style={{ marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: text }} /> : null
      })
    } catch {
      return <span style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{value}</span>
    }
  }

  if (loading) return <div style={s.page}><div style={{...s.wrap, color:'#9ca3af',fontSize:14}}>Loading report…</div></div>
  if (error)   return <div style={s.page}><div style={s.wrap}><div style={s.err}>{error}</div></div></div>

  const { study, participants } = data

  return (
    <div style={s.page}>
      <div style={s.wrap}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Research Report</div>
          <h1 style={s.h1}>{study.name}</h1>
          {study.description && <p style={s.sub}>{study.description}</p>}
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280' }}>
            <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
            {study.target_count && <span>Target: {study.target_count}</span>}
          </div>
        </div>

        {/* Study synthesis */}
        {study.synthesis && (
          <div style={s.card}>
            <span style={s.label}>Study summary</span>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
              {renderEditorContent(study.synthesis)}
            </div>
          </div>
        )}

        {/* Participants */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ ...s.h2, marginBottom: 16 }}>Participants</h2>
          {participants.length === 0 && (
            <div style={{ ...s.card, color: '#9ca3af', fontSize: 14 }}>No participants yet.</div>
          )}
          {participants.map(p => (
            <div key={p.id} style={s.card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{p.name}</div>
                  {p.booked_at && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {format(parseISO(p.booked_at), 'MMM d, yyyy · h:mm a')}
                    </div>
                  )}
                  {p.rating > 0 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                      {[1,2,3,4,5].map(r => (
                        <span key={r} style={{ fontSize: 14, color: r <= p.rating ? '#f59e0b' : '#e5e7eb' }}>★</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={s.tag(statusColor[p.status] || '#6b7280')}>{p.status}</span>
                  {p.recording_url && (
                    <a href={p.recording_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ▶ Recording
                    </a>
                  )}
                </div>
              </div>

              {p.summary && (
                <>
                  <hr style={s.divider} />
                  <span style={s.label}>Summary</span>
                  <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{renderEditorContent(p.summary)}</div>
                </>
              )}

              {(p.quotes || []).length > 0 && (
                <>
                  <hr style={s.divider} />
                  <span style={s.label}>Key quotes</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {p.quotes.map((q, i) => (
                      <div key={q.id || i} style={s.quoteBlock}>"{q.text}"</div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
