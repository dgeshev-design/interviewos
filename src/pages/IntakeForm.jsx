import { useState } from 'react'
import { useFormFields } from '@/hooks/useFormFields'
import { useSlots } from '@/hooks/useSlots'
import { usePublishedForm } from '@/hooks/usePublishedForm'
import { useApp } from '@/context/AppContext'
import Modal from '@/components/Modal'
import Icon from '@/components/Icon'

const EMPTY_FIELD = { label: '', field_type: 'text', required: false, options: '' }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const fmtSlot = (iso) => new Date(iso).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit'
})

export default function IntakeForm() {
  const { workspace }                                                = useApp()
  const { fields, loading, add, remove, reorder }                    = useFormFields()
  const { slots, addSlot, removeSlot, refetch: refetchSlots }        = useSlots()
  const { publishedForm, loading: pubLoading, publish, unpublish }   = usePublishedForm()

  const [tab, setTab]               = useState('builder')
  const [showAdd, setShowAdd]       = useState(false)
  const [showSlot, setShowSlot]     = useState(false)
  const [showWindow, setShowWindow] = useState(false)
  const [newF, setNewF]             = useState(EMPTY_FIELD)
  const [newSlot, setNewSlot]       = useState({ starts_at: '', duration_minutes: 60, meet_link: '' })
  const [preview, setPreview]       = useState({})
  const [copied, setCopied]         = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult]   = useState(null)

  // Availability window state
  const [window_, setWindow_] = useState({
    dateFrom:        '',
    dateTo:          '',
    timeFrom:        '09:00',
    timeTo:          '17:00',
    durationMinutes: 60,
    bufferMinutes:   15,
    daysOfWeek:      [1,2,3,4,5],
  })

  const formUrl = publishedForm
    ? `${window.location.origin}/f/${publishedForm.id}`
    : null

  const handlePublish = async () => {
    setPublishing(true)
    try { await publish() }
    catch (e) { alert(e.message) }
    setPublishing(false)
  }

  const handleUnpublish = async () => {
    if (!confirm('Unpublish this form? The link will stop working.')) return
    await unpublish()
  }

  const copyLink = () => {
    if (!formUrl) return
    navigator.clipboard?.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddField = async () => {
    try {
      await add({
        label:      newF.label,
        field_type: newF.field_type,
        required:   newF.required,
        options:    newF.options ? newF.options.split(',').map(s => s.trim()) : [],
      })
      setNewF(EMPTY_FIELD)
      setShowAdd(false)
    } catch (e) { alert(e.message) }
  }

  const handleAddSlot = async () => {
    if (!newSlot.starts_at) return
    try {
      await addSlot(newSlot)
      setNewSlot({ starts_at: '', duration_minutes: 60, meet_link: '' })
      setShowSlot(false)
    } catch (e) { alert(e.message) }
  }

  const toggleDay = (d) => {
    setWindow_(w => ({
      ...w,
      daysOfWeek: w.daysOfWeek.includes(d)
        ? w.daysOfWeek.filter(x => x !== d)
        : [...w.daysOfWeek, d].sort()
    }))
  }

  const handleGenerateSlots = async () => {
    if (!window_.dateFrom || !window_.dateTo || !window_.daysOfWeek.length) return
    setGenerating(true); setGenResult(null)
    try {
      const res = await fetch('/api/generate-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id, ...window_ }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setGenResult(data.created)
      await refetchSlots()
      setTimeout(() => { setShowWindow(false); setGenResult(null) }, 1500)
    } catch (e) { alert(e.message) }
    setGenerating(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Intake form</h1>
          <p>Build your qualifier form. Publish a shareable link. Manage booking slots.</p>
        </div>
        <div className="flex gap-2">
          {publishedForm ? (
            <>
              <button className="btn btn-ghost" onClick={copyLink}>
                <Icon name="copy" size={13} /> {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button className="btn btn-ghost" onClick={handleUnpublish} style={{ color: 'var(--red)' }}>
                Unpublish
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handlePublish} disabled={publishing || pubLoading || fields.length === 0}>
              <Icon name="eye" size={14} /> {publishing ? 'Publishing…' : 'Publish form'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} /> Add field
          </button>
        </div>
      </div>

      {/* Live banner */}
      {publishedForm && formUrl && (
        <div style={{
          background: 'rgba(61,214,140,0.07)', border: '1px solid rgba(61,214,140,0.2)',
          borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>Form is live</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{formUrl}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={copyLink}>
            <Icon name="copy" size={12} /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <a href={formUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <Icon name="eye" size={12} /> Preview
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs mt-2" style={{ width: 'fit-content', marginBottom: 20 }}>
        <button className={`tab ${tab === 'builder' ? 'active' : ''}`} onClick={() => setTab('builder')}>Form fields</button>
        <button className={`tab ${tab === 'slots'   ? 'active' : ''}`} onClick={() => setTab('slots')}>
          Booking slots {slots.length > 0 && `(${slots.length})`}
        </button>
        <button className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
      </div>

      {/* Builder */}
      {tab === 'builder' && (
        <div className="flex-col gap-3">
          {loading && <p className="muted">Loading fields…</p>}
          {!loading && fields.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 48 }}>
              No fields yet. Add your first field to get started.
            </div>
          )}
          {fields.map((f, i) => (
            <div key={f.id} className="card flex items-center gap-3">
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2">
                  <strong style={{ fontSize: 13.5 }}>{f.label}</strong>
                  {f.required && <span className="badge badge-red" style={{ fontSize: 10, padding: '1px 6px' }}>Required</span>}
                </div>
                <div className="text-xs muted mt-1">
                  {f.field_type}{f.options?.length ? ` · ${f.options.join(', ')}` : ''}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => reorder(f.id, -1)} disabled={i === 0}>↑</button>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => reorder(f.id, 1)} disabled={i === fields.length - 1}>↓</button>
                <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(f.id)}><Icon name="trash" size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slots */}
      {tab === 'slots' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="muted text-sm">Auto-generate slots from an availability window, or add individual slots manually.</p>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={() => setShowWindow(true)}>
                <Icon name="calendar" size={14} /> Set availability window
              </button>
              <button className="btn btn-ghost" onClick={() => setShowSlot(true)}>
                <Icon name="plus" size={14} /> Add single slot
              </button>
            </div>
          </div>
          <div className="flex-col gap-2">
            {slots.length === 0 && (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 48 }}>
                No slots open yet. Set an availability window to auto-generate slots.
              </div>
            )}
            {slots.map(s => (
              <div key={s.id} className="card-sm flex items-center justify-between">
                <div>
                  <strong style={{ fontSize: 13.5 }}>{fmtSlot(s.starts_at)}</strong>
                  <div className="text-xs muted mt-1">
                    {s.duration_minutes} min
                    {s.meet_link ? <span style={{ color: 'var(--green)', marginLeft: 8 }}>● Meet link ready</span> : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${s.available ? 'badge-green' : 'badge-blue'}`}>
                    {s.available ? 'Available' : 'Booked'}
                  </span>
                  {s.available && (
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeSlot(s.id)}>
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {tab === 'preview' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ marginBottom: 4 }}>Participation form</h2>
          <p className="muted text-sm mt-1" style={{ marginBottom: 24 }}>Complete this short form to register for a research session.</p>
          <div className="flex-col gap-4">
            {fields.map(f => (
              <div key={f.id} className="field">
                <label>
                  {f.label}
                  {f.required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
                </label>
                {f.field_type === 'select' ? (
                  <select value={preview[f.id] || ''} onChange={e => setPreview(p => ({ ...p, [f.id]: e.target.value }))}>
                    <option value="">Select…</option>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.field_type === 'textarea' ? (
                  <textarea value={preview[f.id] || ''} onChange={e => setPreview(p => ({ ...p, [f.id]: e.target.value }))} />
                ) : (
                  <input type={f.field_type} value={preview[f.id] || ''} onChange={e => setPreview(p => ({ ...p, [f.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          {fields.length > 0 && (
            <button className="btn btn-primary w-full mt-6" style={{ justifyContent: 'center' }}>
              Continue to booking →
            </button>
          )}
        </div>
      )}

      {/* Add field modal */}
      {showAdd && (
        <Modal title="Add form field" onClose={() => setShowAdd(false)}>
          <div className="flex-col gap-3">
            <div className="field">
              <label>Field label</label>
              <input placeholder="e.g. Full name" value={newF.label} onChange={e => setNewF(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="field">
              <label>Field type</label>
              <select value={newF.field_type} onChange={e => setNewF(f => ({ ...f, field_type: e.target.value }))}>
                {['text','email','tel','number','textarea','select'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {newF.field_type === 'select' && (
              <div className="field">
                <label>Options (comma-separated)</label>
                <input placeholder="Option A, Option B" value={newF.options} onChange={e => setNewF(f => ({ ...f, options: e.target.value }))} />
              </div>
            )}
            <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: 13.5 }}>
              <input type="checkbox" checked={newF.required} onChange={e => setNewF(f => ({ ...f, required: e.target.checked }))} style={{ width: 'auto' }} />
              Required field
            </label>
          </div>
          <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddField} disabled={!newF.label}>
              <Icon name="plus" size={14} /> Add field
            </button>
          </div>
        </Modal>
      )}

      {/* Add slot modal */}
      {showSlot && (
        <Modal title="Add booking slot" onClose={() => setShowSlot(false)}>
          <div className="flex-col gap-3">
            <div className="field">
              <label>Date and time</label>
              <input type="datetime-local" value={newSlot.starts_at} onChange={e => setNewSlot(s => ({ ...s, starts_at: e.target.value }))} />
            </div>
            <div className="field">
              <label>Duration</label>
              <select value={newSlot.duration_minutes} onChange={e => setNewSlot(s => ({ ...s, duration_minutes: Number(e.target.value) }))}>
                {[30,45,60,90].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <div className="field">
              <label>Video call link (optional)</label>
              <input placeholder="https://meet.google.com/…" value={newSlot.meet_link} onChange={e => setNewSlot(s => ({ ...s, meet_link: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowSlot(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddSlot} disabled={!newSlot.starts_at}>
              <Icon name="plus" size={14} /> Add slot
            </button>
          </div>
        </Modal>
      )}
      {/* Availability window modal */}
      {showWindow && (
        <Modal title="Set availability window" onClose={() => setShowWindow(false)} maxWidth={560}>
          <p className="text-sm muted" style={{ marginBottom: 20 }}>
            Define a date range and working hours. Slots will be automatically generated and opened for booking.
          </p>
          <div className="flex-col gap-3">
            <div className="grid-2">
              <div className="field"><label>From date</label>
                <input type="date" value={window_.dateFrom} onChange={e => setWindow_(w => ({ ...w, dateFrom: e.target.value }))} />
              </div>
              <div className="field"><label>To date</label>
                <input type="date" value={window_.dateTo} onChange={e => setWindow_(w => ({ ...w, dateTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field"><label>Start time</label>
                <input type="time" value={window_.timeFrom} onChange={e => setWindow_(w => ({ ...w, timeFrom: e.target.value }))} />
              </div>
              <div className="field"><label>End time</label>
                <input type="time" value={window_.timeTo} onChange={e => setWindow_(w => ({ ...w, timeTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field"><label>Slot duration (minutes)</label>
                <select value={window_.durationMinutes} onChange={e => setWindow_(w => ({ ...w, durationMinutes: Number(e.target.value) }))}>
                  {[15,20,30,45,60,90,120].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div className="field"><label>Buffer between slots (minutes)</label>
                <select value={window_.bufferMinutes} onChange={e => setWindow_(w => ({ ...w, bufferMinutes: Number(e.target.value) }))}>
                  {[0,5,10,15,20,30].map(m => <option key={m} value={m}>{m === 0 ? 'None' : `${m} min`}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Days of week</label>
              <div className="flex gap-2 mt-1">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    style={{
                      padding: '6px 10px', borderRadius: 'var(--r-sm)', fontSize: 12.5, fontWeight: 500,
                      border: '1px solid',
                      borderColor: window_.daysOfWeek.includes(i) ? 'var(--accent)' : 'var(--border-base)',
                      background:  window_.daysOfWeek.includes(i) ? 'var(--accent-glow)' : 'transparent',
                      color:       window_.daysOfWeek.includes(i) ? 'var(--accent-light)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview count */}
            {window_.dateFrom && window_.dateTo && window_.daysOfWeek.length > 0 && (
              <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {genResult !== null
                  ? <span style={{ color: 'var(--green)' }}>✓ {genResult} slots created successfully</span>
                  : <>Will generate slots from <strong style={{ color: 'var(--text-primary)' }}>{window_.timeFrom}</strong> to <strong style={{ color: 'var(--text-primary)' }}>{window_.timeTo}</strong> every <strong style={{ color: 'var(--text-primary)' }}>{window_.durationMinutes + window_.bufferMinutes} minutes</strong> on selected days.</>
                }
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowWindow(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleGenerateSlots}
              disabled={generating || !window_.dateFrom || !window_.dateTo || !window_.daysOfWeek.length}
            >
              <Icon name="calendar" size={14} />
              {generating ? 'Generating…' : 'Generate slots'}
            </button>
          </div>
        </Modal>
      )}

    </div>
  )
}
