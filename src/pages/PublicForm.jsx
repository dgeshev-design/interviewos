import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const fmtSlot = (iso) => {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function PublicForm() {
  const { formId } = useParams()
  const [step, setStep]           = useState('form')   // 'form' | 'book' | 'done' | 'error'
  const [formData, setFormData]   = useState(null)     // { form, fields, slots }
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

  const handleFormSubmit = () => {
    // Validate required fields
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

  // ── Styles (self-contained, no auth layout) ───────────────────────────────
  const s = {
    page:   { minHeight: '100vh', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', sans-serif" },
    card:   { background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 16, padding: 36, width: '100%', maxWidth: 520, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
    logo:   { fontSize: 18, fontWeight: 700, color: '#09090b', marginBottom: 4, letterSpacing: '-0.3px' },
    accent: { color: '#6366f1' },
    title:  { fontSize: 22, fontWeight: 600, color: '#09090b', marginBottom: 6, letterSpacing: '-0.3px' },
    sub:    { fontSize: 13.5, color: '#71717a', marginBottom: 28 },
    label:  { display: 'block', fontSize: 12.5, fontWeight: 500, color: '#71717a', marginBottom: 6 },
    input:  { background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b', fontFamily: "'Inter', sans-serif", fontSize: 13.5, padding: '9px 12px', width: '100%', outline: 'none', boxSizing: 'border-box' },
    btn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', marginTop: 24 },
    err:    { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13, marginTop: 16 },
    slot:   (selected) => ({
      background:   selected ? '#ede9fe' : '#fafafa',
      border:       `1px solid ${selected ? '#6366f1' : '#e4e4e7'}`,
      borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
      marginBottom: 8, transition: '0.15s ease',
    }),
    slotDate: { fontSize: 13, fontWeight: 500, color: '#09090b' },
    slotTime: { fontSize: 12, color: '#71717a', marginTop: 2 },
  }

  if (loading) return (
    <div style={s.page}>
      <div style={{ color: '#71717a', fontSize: 14 }}>Loading…</div>
    </div>
  )

  if (error && !formData) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Interview<span style={s.accent}>OS</span></div>
        <div style={{ ...s.err, marginTop: 16 }}>{error}</div>
      </div>
    </div>
  )

  // ── Done ──────────────────────────────────────────────────────────────────
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

  // ── Book slot ─────────────────────────────────────────────────────────────
  if (step === 'book') return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Interview<span style={s.accent}>OS</span></div>
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

  // ── Intake form ───────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Interview<span style={s.accent}>OS</span></div>
        <div style={{ ...s.title, marginTop: 20 }}>Participation form</div>
        <p style={s.sub}>Complete this short form to register for a research session.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {formData.fields.map(f => (
            <div key={f.id}>
              <label style={s.label}>
                {f.label}
                {f.required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
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
          ))}
        </div>

        {error && <div style={s.err}>{error}</div>}

        <button style={s.btn} onClick={handleFormSubmit}>
          Continue to booking →
        </button>
      </div>
    </div>
  )
}
