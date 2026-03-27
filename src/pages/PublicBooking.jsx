import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { submitPublicForm } from '@/lib/api'

export default function PublicBooking() {
  const { studySlug } = useParams()
  const [data, setData]         = useState(null)   // { study, form, slots }
  const [step, setStep]         = useState('form') // form | book | done | disqualified | error
  const [answers, setAnswers]   = useState({})
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch(`/api/public?action=get-study&slug=${studySlug}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load. Please try again.'); setLoading(false) })
  }, [studySlug])

  const activeForm    = data?.forms?.find(f => f.is_active)
  const fields        = activeForm?.fields || []
  const slots         = data?.slots || []
  const brandColor    = activeForm?.primary_color || '#6366f1'
  const bannerUrl     = activeForm?.banner_url || null
  const logoUrl       = activeForm?.logo_url || null

  const checkScreeners = () => {
    if (!fields.length) return true
    for (const field of fields) {
      if (field.is_screener && field.disqualify_if) {
        const answer = answers[field.id]
        if (answer === field.disqualify_if) return false
      }
    }
    return true
  }

  const handleFormSubmit = () => {
    const missing = fields.filter(f => f.required && !answers[f.id]?.toString().trim())
    if (missing.length) { setError(`Please fill in: ${missing.map(f => f.label).join(', ')}`); return }
    setError('')
    if (!checkScreeners()) { setStep('disqualified'); return }
    setStep('book')
  }

  const handleBooking = async () => {
    setSubmitting(true); setError('')
    try {
      const res = await submitPublicForm({ studySlug, formId: activeForm?.id, answers, slotId: selectedSlot })
      if (res.error) throw new Error(res.error)
      setStep('done')
    } catch (e) { setError(e.message) }
    setSubmitting(false)
  }

  const shouldShow = (field) => {
    if (!field.condition_field || !field.condition_value) return true
    return answers[field.condition_field] === field.condition_value
  }

  // ── Inline styles (standalone public page, no auth layout) ──────────────
  const s = {
    page:     { minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', fontFamily: 'Inter, system-ui, sans-serif' },
    wrap:     { width: '100%', maxWidth: 520 },
    logoWrap: { marginBottom: 24 },
    logoText: { fontSize: 18, fontWeight: 700, color: '#111827' },
    accent:   { color: brandColor },
    card:     { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    cardBody: { padding: 32 },
    banner:   { width: '100%', height: 140, objectFit: 'cover', display: 'block' },
    h2:       { fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 4 },
    sub:      { fontSize: 13.5, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
    label:    { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 },
    input:    { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: 13.5, padding: '9px 12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    btn:      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '10px 16px', borderRadius: 8, background: brandColor, color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', marginTop: 20 },
    btnOut:   { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 20px', borderRadius: 8, background: 'transparent', border: '1px solid #d1d5db', color: '#6b7280', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
    err:      { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginTop: 12 },
    slot:     (sel) => ({ border: `1px solid ${sel ? brandColor : '#e5e7eb'}`, background: sel ? `${brandColor}18` : '#fff', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', marginBottom: 8, transition: '0.15s' }),
    fieldWrap:{ marginBottom: 16 },
  }

  // Reusable logo element
  const Logo = () => (
    <div style={s.logoWrap}>
      {logoUrl
        ? <img src={logoUrl} alt="Logo" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />
        : <div style={s.logoText}>Interview<span style={s.accent}>OS</span></div>
      }
    </div>
  )

  // Reusable card with optional banner
  const CardWrap = ({ children }) => (
    <div style={s.card}>
      {bannerUrl && <img src={bannerUrl} alt="" style={s.banner} />}
      <div style={s.cardBody}>{children}</div>
    </div>
  )

  if (loading) return <div style={s.page}><div style={{color:'#9ca3af',fontSize:14}}>Loading…</div></div>
  if (error && !data) return <div style={s.page}><div style={s.wrap}><Logo /><div style={s.err}>{error}</div></div></div>

  if (step === 'disqualified') return (
    <div style={s.page}><div style={s.wrap}>
      <Logo />
      <CardWrap>
        <div style={{fontSize:32,marginBottom:12}}>🙏</div>
        <div style={s.h2}>Thanks for your interest</div>
        <p style={s.sub}>Unfortunately you don't meet the criteria for this research study. We appreciate your time!</p>
      </CardWrap>
    </div></div>
  )

  if (step === 'done') return (
    <div style={s.page}><div style={s.wrap}>
      <Logo />
      <CardWrap>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>✅</div>
          <div style={s.h2}>You're booked!</div>
          <p style={s.sub}>Thanks for signing up. You'll receive a confirmation with your session details shortly.</p>
          <p style={{fontSize:12,color:'#9ca3af'}}>You can close this tab.</p>
        </div>
      </CardWrap>
    </div></div>
  )

  if (step === 'book') return (
    <div style={s.page}><div style={s.wrap}>
      <Logo />
      <CardWrap>
        <div style={s.h2}>Pick a time</div>
        <p style={s.sub}>Choose a session slot that works for you.</p>
        {slots.length === 0 ? (
          <p style={{color:'#9ca3af',fontSize:13.5,padding:'16px 0'}}>No slots available right now. The team will contact you to schedule.</p>
        ) : (
          slots.map(slot => {
            const d = parseISO(slot.starts_at)
            return (
              <div key={slot.id} style={s.slot(selectedSlot === slot.id)} onClick={() => setSelectedSlot(slot.id)}>
                <div style={{fontWeight:500,fontSize:14,color:'#111827'}}>{format(d,'EEEE, MMMM d')}</div>
                <div style={{fontSize:12.5,color:'#6b7280',marginTop:2}}>{format(d,'HH:mm')} · {slot.duration_minutes} min</div>
              </div>
            )
          })
        )}
        {error && <div style={s.err}>{error}</div>}
        <div style={{display:'flex',gap:10,marginTop:20}}>
          <button style={{...s.btnOut,flex:'0 0 auto'}} onClick={() => setStep('form')}>Back</button>
          <button
            style={{...s.btn,marginTop:0,flex:1,opacity:(slots.length > 0 && !selectedSlot)?0.4:1}}
            onClick={handleBooking}
            disabled={submitting || (slots.length > 0 && !selectedSlot)}
          >
            {submitting ? 'Confirming…' : slots.length === 0 ? 'Submit without booking' : 'Confirm booking'}
          </button>
        </div>
      </CardWrap>
    </div></div>
  )

  return (
    <div style={s.page}><div style={s.wrap}>
      <Logo />
      <CardWrap>
        <div style={s.h2}>{data?.study?.name || 'Research session'}</div>
        <p style={s.sub}>{data?.study?.description || 'Complete this short form to register for a research session.'}</p>

        {fields.map(field => {
          if (!shouldShow(field)) return null
          return (
            <div key={field.id} style={s.fieldWrap}>
              <label style={s.label}>
                {field.label}
                {field.required && <span style={{color:'#dc2626',marginLeft:3}}>*</span>}
              </label>

              {field.type === 'select' ? (
                <select style={s.input} value={answers[field.id]||''} onChange={e => setAnswers(a=>({...a,[field.id]:e.target.value}))}>
                  <option value=''>Select…</option>
                  {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === 'multi_select' ? (
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {field.options?.map(o => {
                    const sel = (answers[field.id] || []).includes(o)
                    return (
                      <button key={o} type="button" style={{padding:'5px 12px',borderRadius:20,fontSize:12.5,border:`1px solid ${sel?brandColor:'#d1d5db'}`,background:sel?`${brandColor}18`:'#fff',color:sel?brandColor:'#374151',cursor:'pointer'}}
                        onClick={() => {
                          const cur = answers[field.id] || []
                          setAnswers(a=>({...a,[field.id]: sel ? cur.filter(x=>x!==o) : [...cur,o]}))
                        }}>
                        {o}
                      </button>
                    )
                  })}
                </div>
              ) : field.type === 'nps' ? (
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {Array.from({length:11},(_,i)=>i).map(n => {
                    const sel = answers[field.id] === n
                    return (
                      <button key={n} type="button"
                        style={{width:36,height:36,borderRadius:6,fontSize:13,border:`1px solid ${sel?brandColor:'#d1d5db'}`,background:sel?brandColor:'#fff',color:sel?'#fff':'#374151',cursor:'pointer'}}
                        onClick={() => setAnswers(a=>({...a,[field.id]:n}))}>
                        {n}
                      </button>
                    )
                  })}
                </div>
              ) : field.type === 'textarea' ? (
                <textarea style={{...s.input,minHeight:80,resize:'vertical'}} value={answers[field.id]||''} onChange={e => setAnswers(a=>({...a,[field.id]:e.target.value}))} />
              ) : (
                <input type={field.type||'text'} style={s.input} value={answers[field.id]||''} onChange={e => setAnswers(a=>({...a,[field.id]:e.target.value}))} />
              )}
            </div>
          )
        })}

        {error && <div style={s.err}>{error}</div>}
        <button style={s.btn} onClick={handleFormSubmit}>Continue →</button>
      </CardWrap>
    </div></div>
  )
}
