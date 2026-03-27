import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO, startOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import { submitPublicForm } from '@/lib/api'

const PHONE_CODES = [
  { code: '+1',   label: '🇺🇸 +1' },  { code: '+44',  label: '🇬🇧 +44' },
  { code: '+49',  label: '🇩🇪 +49' },  { code: '+33',  label: '🇫🇷 +33' },
  { code: '+34',  label: '🇪🇸 +34' },  { code: '+39',  label: '🇮🇹 +39' },
  { code: '+31',  label: '🇳🇱 +31' },  { code: '+46',  label: '🇸🇪 +46' },
  { code: '+47',  label: '🇳🇴 +47' },  { code: '+45',  label: '🇩🇰 +45' },
  { code: '+358', label: '🇫🇮 +358' }, { code: '+41',  label: '🇨🇭 +41' },
  { code: '+43',  label: '🇦🇹 +43' },  { code: '+32',  label: '🇧🇪 +32' },
  { code: '+351', label: '🇵🇹 +351' }, { code: '+48',  label: '🇵🇱 +48' },
  { code: '+420', label: '🇨🇿 +420' }, { code: '+36',  label: '🇭🇺 +36' },
  { code: '+40',  label: '🇷🇴 +40' },  { code: '+7',   label: '🇷🇺 +7' },
  { code: '+380', label: '🇺🇦 +380' }, { code: '+90',  label: '🇹🇷 +90' },
  { code: '+972', label: '🇮🇱 +972' }, { code: '+971', label: '🇦🇪 +971' },
  { code: '+966', label: '🇸🇦 +966' }, { code: '+91',  label: '🇮🇳 +91' },
  { code: '+86',  label: '🇨🇳 +86' },  { code: '+81',  label: '🇯🇵 +81' },
  { code: '+82',  label: '🇰🇷 +82' },  { code: '+65',  label: '🇸🇬 +65' },
  { code: '+61',  label: '🇦🇺 +61' },  { code: '+64',  label: '🇳🇿 +64' },
  { code: '+55',  label: '🇧🇷 +55' },  { code: '+52',  label: '🇲🇽 +52' },
  { code: '+54',  label: '🇦🇷 +54' },  { code: '+56',  label: '🇨🇱 +56' },
  { code: '+57',  label: '🇨🇴 +57' },  { code: '+27',  label: '🇿🇦 +27' },
  { code: '+20',  label: '🇪🇬 +20' },  { code: '+234', label: '🇳🇬 +234' },
  { code: '+254', label: '🇰🇪 +254' },
]

export default function PublicBooking() {
  const { studySlug } = useParams()
  const [data, setData]         = useState(null)   // { study, form, slots }
  const [step, setStep]         = useState('form') // form | book | done | disqualified | error
  const [answers, setAnswers]   = useState({})
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [calendarDate, setCalendarDate] = useState(null) // week anchor date
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (step === 'book' && !calendarDate) {
      const firstSlot = (data?.slots || [])[0]
      setCalendarDate(firstSlot ? parseISO(firstSlot.starts_at) : new Date())
      // Select today if it has slots, otherwise the first day that does
      const today = new Date()
      const allSlots = data?.slots || []
      const hasToday = allSlots.some(s => isSameDay(parseISO(s.starts_at), today))
      if (hasToday) {
        setSelectedDate(today)
      } else {
        const firstWithSlots = allSlots.find(s => parseISO(s.starts_at) >= today)
        const firstDate = firstWithSlots ? parseISO(firstWithSlots.starts_at) : today
        setSelectedDate(firstDate)
        setCalendarDate(firstDate)
      }
    }
  }, [step])

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
    const missing = fields.filter(f => {
      if (!f.required) return false
      const val = answers[f.id]
      if (f.type === 'tel') {
        const num = val?.includes('|') ? val.split('|')[1] : val
        return !num?.trim()
      }
      return !val?.toString().trim()
    })
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
    page:     { minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'clamp(16px, 5vw, 40px) 16px', fontFamily: 'Inter, system-ui, sans-serif' },
    wrap:     { width: '100%', maxWidth: 520 },
    logoWrap: { marginBottom: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' },
    logoText: { fontSize: 18, fontWeight: 700, color: '#111827' },
    accent:   { color: brandColor },
    card:     { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    cardBody: { padding: 'clamp(16px, 6vw, 32px)' },
    banner:   { width: '100%', height: 'clamp(80px, 20vw, 140px)', objectFit: 'cover', display: 'block' },
    h2:       { fontSize: 'clamp(15px, 4vw, 18px)', fontWeight: 600, color: '#111827', marginBottom: 4 },
    sub:      { fontSize: 13.5, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
    label:    { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 },
    input:    { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, color: '#111827', fontSize: 13.5, padding: '9px 12px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    btn:      { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '11px 16px', borderRadius: 8, background: brandColor, color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', marginTop: 20 },
    btnOut:   { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 20px', borderRadius: 8, background: 'transparent', border: '1px solid #d1d5db', color: '#6b7280', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
    err:      { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginTop: 12 },
    slot:     (sel) => ({ border: `1px solid ${sel ? brandColor : '#e5e7eb'}`, background: sel ? `${brandColor}18` : '#fff', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', marginBottom: 8, transition: '0.15s' }),
    fieldWrap:{ marginBottom: 16 },
  }

  const mobileStyles = (
    <style>{`
      @media (max-width: 540px) {
        .pb-page { background: #fff !important; padding: 0 !important; }
        .pb-wrap { padding-left: 0 !important; padding-right: 0 !important; }
        .pb-logo { padding: 20px 16px 0 !important; }
        .pb-card { border: none !important; border-radius: 0 !important; box-shadow: none !important; }
        .pb-card-body { padding: 20px 16px !important; }
        .pb-btn-row { flex-direction: column !important; }
        .pb-btn-row button { width: 100% !important; flex: none !important; }
      }
    `}</style>
  )

  const logoEl = (
    <div style={s.logoWrap} className="pb-logo">
      {logoUrl
        ? <img src={logoUrl} alt="Logo" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />
        : <div style={s.logoText}>Interview<span style={s.accent}>OS</span></div>
      }
    </div>
  )

  const cardTop = bannerUrl ? <img src={bannerUrl} alt="" style={s.banner} /> : null

  if (loading) return <div style={s.page}><div style={{color:'#9ca3af',fontSize:14}}>Loading…</div></div>
  if (error && !data) return <div style={s.page}><div style={s.wrap}>{logoEl}<div style={s.err}>{error}</div></div></div>

  if (step === 'disqualified') return (
    <div style={s.page} className="pb-page">{mobileStyles}<div style={s.wrap} className="pb-wrap">
      {logoEl}
      <div style={s.card} className="pb-card">{cardTop}<div style={s.cardBody} className="pb-card-body">
        <div style={{fontSize:32,marginBottom:12}}>🙏</div>
        <div style={s.h2}>Thanks for your interest</div>
        <p style={s.sub}>Unfortunately you don't meet the criteria for this research study. We appreciate your time!</p>
      </div></div>
    </div></div>
  )

  if (step === 'done') return (
    <div style={s.page} className="pb-page">{mobileStyles}<div style={s.wrap} className="pb-wrap">
      {logoEl}
      <div style={s.card} className="pb-card">{cardTop}<div style={{...s.cardBody, textAlign:'center'}} className="pb-card-body">
        <div style={{fontSize:40,marginBottom:12}}>✅</div>
        <div style={s.h2}>You're booked!</div>
        <p style={s.sub}>Thanks for signing up. You'll receive a confirmation with your session details shortly.</p>
        <p style={{fontSize:12,color:'#9ca3af'}}>You can close this tab.</p>
      </div></div>
    </div></div>
  )

  if (step === 'book') {
    const anchor   = calendarDate || new Date()
    const wStart   = startOfWeek(anchor, { weekStartsOn: 0 })
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(wStart, i))
    const slotsForDate = (d) => slots.filter(s => isSameDay(parseISO(s.starts_at), d))
    const hasSlots = (d) => slotsForDate(d).length > 0
    const daySlots  = selectedDate ? slotsForDate(selectedDate) : []
    const duration  = slots[0]?.duration_minutes || 60

    const navBtn = {
      width: 36, height: 36, borderRadius: 8,
      border: '1px solid #e5e7eb', background: '#fff',
      cursor: 'pointer', fontSize: 16, color: '#374151',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit',
    }

    return (
      <div style={s.page} className="pb-page">{mobileStyles}<div style={s.wrap} className="pb-wrap">
        {logoEl}
        <div style={s.card} className="pb-card">{cardTop}<div style={s.cardBody} className="pb-card-body">

          {/* Week navigation */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 20 }}>
            <button type="button" style={navBtn} onClick={() => { setCalendarDate(addDays(anchor, -7)); setSelectedDate(null); setSelectedSlot(null) }}>‹</button>
            <span style={{ fontWeight: 600, fontSize: 16, color: '#111827' }}>{format(wStart, 'MMMM yyyy')}</span>
            <button type="button" style={navBtn} onClick={() => { setCalendarDate(addDays(anchor, 7)); setSelectedDate(null); setSelectedSlot(null) }}>›</button>
          </div>

          {/* Day-of-week labels */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom: 6 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:12, color:'#9ca3af', fontWeight:500, paddingBottom: 4 }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: 4, marginBottom: 24 }}>
            {weekDays.map(day => {
              const avail = hasSlots(day)
              const sel   = selectedDate && isSameDay(day, selectedDate)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()} type="button"
                  onClick={() => { if (avail) { setSelectedDate(day); setSelectedSlot(null) } }}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    padding: '8px 2px', border: 'none', borderRadius: 10, fontFamily:'inherit',
                    background: sel ? brandColor : today && !sel ? `${brandColor}15` : 'transparent',
                    color: sel ? '#fff' : avail ? '#111827' : '#d1d5db',
                    cursor: avail ? 'pointer' : 'default',
                    outline: today && !sel ? `1.5px solid ${brandColor}40` : 'none',
                  }}
                >
                  <span style={{ fontSize:17, fontWeight: sel||today ? 600 : 400, lineHeight:1.2 }}>{format(day,'d')}</span>
                  <span style={{ fontSize:11, marginTop:2, color: sel ? 'rgba(255,255,255,0.75)' : '#9ca3af' }}>{format(day,'MMM')}</span>
                </button>
              )
            })}
          </div>

          {/* Time slots for selected day */}
          {selectedDate && daySlots.length > 0 && (
            <>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:14, color:'#374151', textAlign:'center' }}>
                {format(selectedDate,'EEEE')} · {format(selectedDate,'MMMM yyyy')} · {duration} min
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
                {daySlots.map(slot => {
                  const sel = selectedSlot === slot.id
                  return (
                    <button key={slot.id} type="button"
                      onClick={() => setSelectedSlot(slot.id)}
                      style={{
                        padding:'14px 8px', borderRadius:10, fontFamily:'inherit',
                        border:`1.5px solid ${sel ? brandColor : '#e5e7eb'}`,
                        background: sel ? brandColor : '#f9fafb',
                        color: sel ? '#fff' : '#374151',
                        fontSize:15, fontWeight:500, cursor:'pointer', textAlign:'center',
                      }}
                    >
                      {format(parseISO(slot.starts_at),'h:mm a')}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {!selectedDate && slots.length > 0 && (
            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:13.5, padding:'8px 0 20px' }}>
              Select a date above to see available times.
            </p>
          )}
          {slots.length === 0 && (
            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:13.5, padding:'8px 0 20px' }}>
              No slots available right now. The team will contact you to schedule.
            </p>
          )}

          {error && <div style={s.err}>{error}</div>}

          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }} className="pb-btn-row">
            <button type="button" style={{ ...s.btnOut, flex:'0 0 auto', marginTop:0 }} onClick={() => setStep('form')}>Back to form</button>
            <button type="button"
              style={{ ...s.btn, marginTop:0, flex:'1 1 160px', opacity:(!selectedSlot && slots.length > 0) ? 0.4 : 1 }}
              onClick={handleBooking}
              disabled={submitting || (slots.length > 0 && !selectedSlot)}
            >
              {submitting ? 'Confirming…' : slots.length === 0 ? 'Submit without booking' : 'Confirm booking'}
            </button>
          </div>

        </div></div>
      </div></div>
    )
  }

  return (
    <div style={s.page} className="pb-page">{mobileStyles}<div style={s.wrap} className="pb-wrap">
      {logoEl}
      <div style={s.card} className="pb-card">{cardTop}<div style={s.cardBody} className="pb-card-body">
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
              ) : field.type === 'tel' ? (() => {
                const defaultCode = field.phone_default_code || '+1'
                const locked      = !!field.phone_lock_code
                const stored      = answers[field.id] || ''
                // stored as "CODE|NUMBER" internally
                const [storedCode, storedNum] = stored.includes('|') ? stored.split('|') : [defaultCode, stored]
                const setPhone = (code, num) => setAnswers(a => ({...a, [field.id]: `${code}|${num}`}))
                return (
                  <div style={{display:'flex',gap:6}}>
                    {locked ? (
                      <span style={{...s.input, width:'auto', minWidth:72, flexShrink:0, background:'#f3f4f6', color:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13}}>
                        {storedCode || defaultCode}
                      </span>
                    ) : (
                      <select
                        style={{...s.input, width:'auto', minWidth:90, flexShrink:0, paddingRight:8}}
                        value={storedCode || defaultCode}
                        onChange={e => setPhone(e.target.value, storedNum)}
                      >
                        {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    )}
                    <input
                      type="tel"
                      placeholder="Phone number"
                      style={{...s.input, flex:1}}
                      value={storedNum}
                      onChange={e => setPhone(storedCode || defaultCode, e.target.value)}
                    />
                  </div>
                )
              })() : (
                <input
                  type={field.type||'text'}
                  inputMode={field.type === 'number' ? 'numeric' : undefined}
                  pattern={field.type === 'number' ? '[0-9]*' : undefined}
                  style={s.input}
                  value={answers[field.id]||''}
                  onChange={e => {
                    const val = field.type === 'number' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value
                    setAnswers(a=>({...a,[field.id]:val}))
                  }}
                />
              )}
            </div>
          )
        })}

        {error && <div style={s.err}>{error}</div>}
        <button style={s.btn} onClick={handleFormSubmit}>Continue →</button>
      </div></div>
    </div></div>
  )
}
