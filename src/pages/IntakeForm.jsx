import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useFormFields } from '@/hooks/useFormFields'
import { useSlots } from '@/hooks/useSlots'
import { usePublishedForm } from '@/hooks/usePublishedForm'
import { useApp } from '@/context/AppContext'
import Modal from '@/components/Modal'
import Icon from '@/components/Icon'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import FieldPalette from '@/components/FormBuilder/FieldPalette'
import FieldCanvas from '@/components/FormBuilder/FieldCanvas'
import DesignPanel from '@/components/FormBuilder/DesignPanel'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const fmtSlot = (iso) => new Date(iso).toLocaleDateString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit'
})

export default function IntakeForm() {
  const { workspace }                                                = useApp()
  const { fields, loading, add, update, remove, reorder }           = useFormFields()
  const { slots, addSlot, removeSlot, refetch: refetchSlots }        = useSlots()
  const { publishedForm, loading: pubLoading, publish, unpublish,
          styleConfig, saveStyle }                                   = usePublishedForm()

  const [tab, setTab]               = useState('builder')
  const [showSlot, setShowSlot]     = useState(false)
  const [showWindow, setShowWindow] = useState(false)
  const [newSlot, setNewSlot]       = useState({ starts_at: '', duration_minutes: 60, meet_link: '' })
  const [preview, setPreview]       = useState({})
  const [copied, setCopied]         = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult]   = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [activeId, setActiveId]     = useState(null)
  const [styleLocal, setStyleLocal] = useState(null)
  const [savingStyle, setSavingStyle] = useState(false)

  const currentStyle = styleLocal ?? styleConfig

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback(({ active }) => {
    setActiveId(active.id)
  }, [])

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null)
    if (!over) return

    const isFromPalette = active.data.current?.isNew
    const overCanvas    = over.id === 'canvas' || fields.some(f => f.id === over.id)

    if (isFromPalette && overCanvas) {
      // Add new field from palette
      const type = active.data.current.type
      const isStatic = type === 'heading' || type === 'divider'
      await add({
        label:      isStatic ? (type === 'heading' ? 'Section heading' : '') : '',
        field_type: type,
        required:   false,
        options:    [],
      })
      return
    }

    // Reorder within canvas
    if (!isFromPalette && over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id)
      const newIndex = fields.findIndex(f => f.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(fields, oldIndex, newIndex)
        // Optimistic update is handled by reorder calls
        await Promise.all(
          reordered.map((f, i) => reorder && update(f.id, { position: i }))
        )
      }
    }
  }, [fields, add, update, reorder])

  // ── Field actions ──────────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (id, changes) => {
    try { await update(id, changes) }
    catch (e) { alert(e.message) }
  }, [update])

  const handleRemove = useCallback(async (id) => {
    try { await remove(id) }
    catch (e) { alert(e.message) }
  }, [remove])

  const handleChangeType = useCallback(async (id, newType) => {
    try { await update(id, { field_type: newType }) }
    catch (e) { alert(e.message) }
  }, [update])

  // ── Publish ────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true)
    try { await publish() }
    catch (e) { alert(e.message) }
    setPublishing(false)
  }

  const handleUnpublish = async () => {
    setConfirmState({ title: 'Unpublish this form?', description: 'The link will stop working.', onConfirm: async () => {
      await unpublish()
    }})
  }

  const copyLink = () => {
    if (!formUrl) return
    navigator.clipboard?.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Slots ──────────────────────────────────────────────────────────────────
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

  // ── Design ─────────────────────────────────────────────────────────────────
  const handleSaveStyle = async () => {
    setSavingStyle(true)
    try { await saveStyle(currentStyle) }
    catch (e) { alert(e.message) }
    setSavingStyle(false)
  }

  // ── Drag overlay content ───────────────────────────────────────────────────
  const activeField = activeId ? fields.find(f => f.id === activeId) : null
  const activePaletteType = activeId?.startsWith('palette-') ? activeId.replace('palette-', '') : null

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
        <button className={`tab ${tab === 'builder' ? 'active' : ''}`} onClick={() => setTab('builder')}>Fields</button>
        <button className={`tab ${tab === 'design'  ? 'active' : ''}`} onClick={() => setTab('design')}>Design</button>
        <button className={`tab ${tab === 'slots'   ? 'active' : ''}`} onClick={() => setTab('slots')}>
          Booking slots {slots.length > 0 && `(${slots.length})`}
        </button>
        <button className={`tab ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
      </div>

      {/* ── BUILDER ─────────────────────────────────────────────────────────── */}
      {tab === 'builder' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {loading ? (
            <p className="muted">Loading fields…</p>
          ) : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <FieldPalette />
              <FieldCanvas
                fields={fields}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onChangeType={handleChangeType}
                activeId={activeId}
              />
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {activePaletteType && (
              <div style={{
                background: 'var(--bg-base)', border: '2px dashed var(--accent)',
                borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 500,
                color: 'var(--accent-light)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                cursor: 'grabbing', opacity: 0.9,
              }}>
                + {activePaletteType.charAt(0).toUpperCase() + activePaletteType.slice(1)} field
              </div>
            )}
            {activeField && (
              <div style={{
                background: 'var(--bg-base)', border: '2px dashed var(--accent)',
                borderRadius: 8, padding: '10px 12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                opacity: 0.85, cursor: 'grabbing', fontSize: 13,
                color: 'var(--text-primary)',
              }}>
                {activeField.label || activeField.field_type}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── DESIGN ──────────────────────────────────────────────────────────── */}
      {tab === 'design' && (
        <DesignPanel
          style={currentStyle}
          onChange={setStyleLocal}
          onSave={handleSaveStyle}
          saving={savingStyle}
        />
      )}

      {/* ── SLOTS ───────────────────────────────────────────────────────────── */}
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

      {/* ── PREVIEW ─────────────────────────────────────────────────────────── */}
      {tab === 'preview' && (() => {
        const s = currentStyle
        const spacingPad = s.spacing === 'compact' ? 24 : s.spacing === 'relaxed' ? 48 : 36
        const cardBorder = s.borderStyle === 'border'
          ? `1px solid ${s.bgColor === '#18181b' ? '#3f3f46' : '#e4e4e7'}`
          : 'none'
        const cardShadow = s.borderStyle === 'shadow' ? '0 4px 24px rgba(0,0,0,0.1)' : 'none'

        return (
          <div style={{ background: s.bgColor, borderRadius: 12, padding: spacingPad, minHeight: 400 }}>
            {s.showHeaderImage && s.headerImageUrl && (
              <div style={{ marginBottom: spacingPad, borderRadius: 10, overflow: 'hidden', maxWidth: 520, margin: '0 auto', marginBottom: spacingPad }}>
                <img src={s.headerImageUrl} alt="Header" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div style={{
              background: s.cardBg, border: cardBorder,
              borderRadius: 16, padding: spacingPad,
              maxWidth: 520, margin: '0 auto',
              boxShadow: cardShadow,
            }}>
              {s.showLogo && s.logoUrl && (
                <img src={s.logoUrl} alt="Logo" style={{ height: 32, marginBottom: spacingPad / 2, objectFit: 'contain' }} />
              )}
              <h2 style={{ marginBottom: 4, color: s.bgColor === '#18181b' ? '#fff' : '#09090b' }}>Participation form</h2>
              <p style={{ fontSize: 13.5, color: '#71717a', marginBottom: spacingPad }}>
                Complete this short form to register for a research session.
              </p>
              <div className="flex-col gap-4">
                {fields.map(f => {
                  if (f.field_type === 'heading') return (
                    <div key={f.id} style={{ fontSize: 17, fontWeight: 600, color: s.bgColor === '#18181b' ? '#fff' : '#09090b', paddingTop: 4 }}>{f.label}</div>
                  )
                  if (f.field_type === 'divider') return (
                    <hr key={f.id} style={{ border: 'none', borderTop: '1px solid #e4e4e7' }} />
                  )
                  return (
                    <div key={f.id} className="field">
                      <label>
                        {f.label}
                        {f.required && <span style={{ color: s.accentColor, marginLeft: 3 }}>*</span>}
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
                  )
                })}
              </div>
              {fields.filter(f => f.field_type !== 'heading' && f.field_type !== 'divider').length > 0 && (
                <button
                  className="btn w-full mt-6"
                  style={{ justifyContent: 'center', background: s.accentColor, color: '#fff', border: 'none' }}
                >
                  {s.buttonText || 'Continue to booking →'}
                </button>
              )}
            </div>
          </div>
        )
      })()}

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

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
