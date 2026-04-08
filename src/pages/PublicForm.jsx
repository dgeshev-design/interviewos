import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { DEFAULT_STYLE } from '@/hooks/usePublishedForm'

const fmtSlot = (iso) => {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

function buildStyles(cfg) {
  const sp = cfg.spacing === 'compact' ? 24 : cfg.spacing === 'relaxed' ? 48 : 36
  const isDarkBg = cfg.bgColor === '#18181b'

  const cardBorder = cfg.borderStyle === 'border'
    ? `1px solid ${isDarkBg ? '#3f3f46' : '#e4e4e7'}`
    : 'none'
  const cardShadow = cfg.borderStyle === 'shadow'
    ? '0 4px 24px rgba(0,0,0,0.1)'
    : 'none'

  return {
    page: {
      minHeight: '100vh',
      background: cfg.bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: "'Inter', sans-serif",
      flexDirection: 'column',
      gap: sp / 2,
    },
    headerImg: {
      width: '100%',
      maxWidth: 520,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: sp / 2,
    },
    card: {
      background: cfg.cardBg,
      border: cardBorder,
      borderRadius: 16,
      padding: sp,
      width: '100%',
      maxWidth: 520,
      boxShadow: cardShadow,
    },
    logo: {
      height: 32,
      marginBottom: sp / 2,
      objectFit: 'contain',
      display: 'block',
    },
    title:  { fontSize: 22, fontWeight: 600, color: isDarkBg ? '#f4f4f5' : '#09090b', marginBottom: 6, letterSpacing: '-0.3px' },
    sub:    { fontSize: 13.5, color: '#71717a', marginBottom: sp },
    label:  { display: 'block', fontSize: 12.5, fontWeight: 500, color: '#71717a', marginBottom: 6 },
    input:  { background: isDarkBg ? '#27272a' : '#fafafa', border: `1px solid ${isDarkBg ? '#3f3f46' : '#e4e4e7'}`, borderRadius: 8, color: isDarkBg ? '#f4f4f5' : '#09090b', fontFamily: "'Inter', sans-serif", fontSize: 13.5, padding: '9px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' },
    btn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 16px', borderRadius: 8, background: cfg.accentColor, color: '#fff', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', marginTop: sp },
    err:    { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13, marginTop: 16 },
    slot: (selected) => ({
      background:   selected ? `${cfg.accentColor}18` : isDarkBg ? '#27272a' : '#fafafa',
      border:       `1px solid ${selected ? cfg.accentColor : isDarkBg ? '#3f3f46' : '#e4e4e7'}`,
      borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
      marginBottom: 8, transition: '0.15s ease',
    }),
    slotDate: { fontSize: 13, fontWeight: 500, color: isDarkBg ? '#f4f4f5' : '#09090b' },
    slotTime: { fontSize: 12, color: '#71717a', marginTop: 2 },
  }
}

export default function PublicForm() {
  const { formId } = useParams()
  const [step, setStep]           = useState('form')
  const [formData, setFormData]   = useState(null)
  const [answers, setAnswers]     = useState({})
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    fetch(`/api/get-public-form?formId=${formId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setFormData(data)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load form.'); setLoading(false) })
  }, [formId])

  const cfg = formData?.form?.style_config
    ? { ...DEFAULT_STYLE, ...formData.form.style_config }
    : { ...DEFAULT_STYLE }

  const s = buildStyles(cfg)

  const handleFormSubmit = () => {
    const missing = formData.fields
      .filter(f => f.required && !answers[f.id]?.trim?.())
      .map(f => f.label)
    if (missing.length) { setError(`Please fill in: ${missing.join(', ')}`); return }
    setError('')
    setStep('book')
  }

  const handleBooking = async () => {
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, answers, slotId: selectedSlot })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStep('done')
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={s.page}>
      <div style={{ color: '#71717a', fontSize: 14 }}>Loading…</div>
    </div>
  )

  if (error && !formData) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#09090b', marginBottom: 4, letterSpacing: '-0.3px' }}>
          Interview<span style={{ color: cfg.accentColor }}>OS</span>
        </div>
        <div style={{ ...s.err, marginTop: 16 }}>{error}</div>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <div style={s.title}>You're booked!</div>
        <p style={s.sub}>
          Thanks for signing up. You'll receive a confirmation shortly with your session details.
        </p>
        <div style={{ fontSize: 12.5, color: '#71717a' }}>You can close this tab.</div>
      </div>
    </div>
  )

  if (step === 'book') return (
    <div style={s.page}>
      <div style={s.card}>
        {cfg.showLogo && cfg.logoUrl ? (
          <img src={cfg.logoUrl} alt="Logo" style={s.logo} />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, color: '#09090b', marginBottom: 4, letterSpacing: '-0.3px' }}>
            Interview<span style={{ color: cfg.accentColor }}>OS</span>
          </div>
        )}
        <div style={{ ...s.title, marginTop: 20 }}>Pick a time</div>
        <p style={s.sub}>Choose a session slot that works for you.</p>

        {formData.slots.length === 0 ? (
          <div style={{ color: '#71717a', fontSize: 13.5, padding: '20px 0' }}>
            No slots available right now. The team will be in touch to arrange a time.
          </div>
        ) : (
          <div>
            {formData.slots.map(slot => {
              const { date, time } = fmtSlot(slot.starts_at)
              const sel = selectedSlot === slot.id
              return (
                <div key={slot.id} style={s.slot(sel)} onClick={() => setSelectedSlot(slot.id)}>
                  <div style={s.slotDate}>{date}</div>
                  <div style={s.slotTime}>{time} · {slot.duration_minutes} min</div>
                </div>
              )
            })}
          </div>
        )}

        {error && <div style={s.err}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            style={{ ...s.btn, background: 'transparent', border: '1px solid #e4e4e7', color: '#71717a', marginTop: 0, width: 'auto', padding: '12px 20px' }}
            onClick={() => setStep('form')}
          >
            Back
          </button>
          <button
            style={{ ...s.btn, marginTop: 0, flex: 1, opacity: (!selectedSlot && formData.slots.length > 0) ? 0.4 : 1 }}
            onClick={handleBooking}
            disabled={submitting || (!selectedSlot && formData.slots.length > 0)}
          >
            {submitting ? 'Confirming…' : formData.slots.length === 0 ? 'Submit without booking' : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Intake form ────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {cfg.showHeaderImage && cfg.headerImageUrl && (
        <div style={s.headerImg}>
          <img src={cfg.headerImageUrl} alt="Header" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={s.card}>
        {cfg.showLogo && cfg.logoUrl ? (
          <img src={cfg.logoUrl} alt="Logo" style={s.logo} />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, color: '#09090b', marginBottom: 4, letterSpacing: '-0.3px' }}>
            Interview<span style={{ color: cfg.accentColor }}>OS</span>
          </div>
        )}
        <div style={{ ...s.title, marginTop: 20 }}>Participation form</div>
        <p style={s.sub}>Complete this short form to register for a research session.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {formData.fields.map(f => {
            if (f.field_type === 'heading') return (
              <div key={f.id} style={{ fontSize: 17, fontWeight: 600, color: s.title.color, paddingTop: 4 }}>{f.label}</div>
            )
            if (f.field_type === 'divider') return (
              <hr key={f.id} style={{ border: 'none', borderTop: '1px solid #e4e4e7' }} />
            )
            return (
              <div key={f.id}>
                <label style={s.label}>
                  {f.label}
                  {f.required && <span style={{ color: cfg.accentColor, marginLeft: 3 }}>*</span>}
                </label>
                {f.field_type === 'select' ? (
                  <select
                    style={s.input}
                    value={answers[f.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))}
                  >
                    <option value=''>Select…</option>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.field_type === 'textarea' ? (
                  <textarea
                    style={{ ...s.input, minHeight: 80, resize: 'vertical' }}
                    value={answers[f.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))}
                  />
                ) : (
                  <input
                    type={f.field_type}
                    style={s.input}
                    value={answers[f.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [f.id]: e.target.value }))}
                  />
                )}
              </div>
            )
          })}
        </div>

        {error && <div style={s.err}>{error}</div>}

        <button style={s.btn} onClick={handleFormSubmit}>
          {cfg.buttonText || 'Continue to booking →'}
        </button>
      </div>
    </div>
  )
}
