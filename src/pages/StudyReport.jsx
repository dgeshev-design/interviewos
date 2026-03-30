import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'

export default function StudyReport() {
  const { token } = useParams()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Comment form
  const [authorName, setAuthorName]       = useState('')
  const [commentBody, setCommentBody]     = useState('')
  const [taggedPId, setTaggedPId]         = useState('')
  const [quote, setQuote]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [commentError, setCommentError]   = useState('')

  useEffect(() => {
    fetch(`/api/public?action=get-report&token=${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load report.'); setLoading(false) })
  }, [token])

  const handleComment = async (e) => {
    e.preventDefault()
    if (!authorName.trim() || !commentBody.trim()) { setCommentError('Name and comment are required.'); return }
    setSubmitting(true); setCommentError('')
    try {
      const res = await fetch('/api/public?action=add-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, authorName, body: commentBody, participantId: taggedPId || null, quote: quote || null }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(prev => ({ ...prev, comments: [...(prev.comments || []), d] }))
      setAuthorName(''); setCommentBody(''); setTaggedPId(''); setQuote('')
    } catch (e) { setCommentError(e.message) }
    setSubmitting(false)
  }

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
    input:   { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
    btn:     { padding: '9px 20px', borderRadius: 8, background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 500, border: 'none', cursor: 'pointer' },
    quoteBlock: { background: '#f9fafb', borderLeft: '3px solid #6366f1', padding: '10px 14px', borderRadius: '0 8px 8px 0', fontStyle: 'italic', fontSize: 13.5, color: '#374151' },
    err: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 },
  }

  const statusColor = { booked: '#6366f1', completed: '#10b981', cancelled: '#ef4444', 'no-show': '#f59e0b', screened: '#8b5cf6' }

  if (loading) return <div style={s.page}><div style={{...s.wrap, color:'#9ca3af',fontSize:14}}>Loading report…</div></div>
  if (error)   return <div style={s.page}><div style={s.wrap}><div style={s.err}>{error}</div></div></div>

  const { study, participants, comments } = data

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
            <span style={s.label}>Study synthesis</span>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{study.synthesis}</div>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{p.name}</div>
                  {p.booked_at && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {format(parseISO(p.booked_at), 'MMM d, yyyy · h:mm a')}
                    </div>
                  )}
                </div>
                <span style={s.tag(statusColor[p.status] || '#6b7280')}>{p.status}</span>
              </div>

              {p.summary && (
                <>
                  <hr style={s.divider} />
                  <span style={s.label}>Summary</span>
                  <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.summary}</div>
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

        {/* Comments */}
        <div>
          <h2 style={{ ...s.h2, marginBottom: 16 }}>Comments</h2>

          {(comments || []).map(c => (
            <div key={c.id} style={{ ...s.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  {c.author_name[0].toUpperCase()}
                </div>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: '#111827' }}>{c.author_name}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{format(parseISO(c.created_at), 'MMM d, yyyy')}</span>
                </div>
                {c.participant_name && (
                  <span style={{ marginLeft: 'auto', ...s.tag('#6366f1'), fontSize: 11 }}>@{c.participant_name}</span>
                )}
              </div>
              {c.quote && <div style={{ ...s.quoteBlock, marginBottom: 8 }}>"{c.quote}"</div>}
              <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}

          {/* Add comment form */}
          <div style={{ ...s.card, marginTop: 8 }}>
            <span style={s.label}>Leave a comment</span>
            <form onSubmit={handleComment} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {commentError && <div style={s.err}>{commentError}</div>}
              <input style={s.input} placeholder="Your name" value={authorName} onChange={e => setAuthorName(e.target.value)} />
              <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} placeholder="Write a comment…" value={commentBody} onChange={e => setCommentBody(e.target.value)} />
              {participants.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...s.input, flex: 1 }} value={taggedPId} onChange={e => setTaggedPId(e.target.value)}>
                    <option value="">Tag a participant (optional)</option>
                    {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input style={{ ...s.input, flex: 2 }} placeholder="Quote (optional)" value={quote} onChange={e => setQuote(e.target.value)} />
                </div>
              )}
              <div>
                <button type="submit" style={s.btn} disabled={submitting}>{submitting ? 'Posting…' : 'Post comment'}</button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
