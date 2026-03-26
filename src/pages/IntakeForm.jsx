import { useState } from 'react'
import { useFormFields } from '@/hooks/useFormFields'
import Modal from '@/components/Modal'
import Icon from '@/components/Icon'

const EMPTY_FIELD = { label: '', field_type: 'text', required: false, options: '' }

export default function IntakeForm() {
  const { fields, loading, add, remove, reorder } = useFormFields()
  const [tab, setTab]         = useState('builder')
  const [showAdd, setShowAdd] = useState(false)
  const [newF, setNewF]       = useState(EMPTY_FIELD)
  const [preview, setPreview] = useState({})
  const [copied, setCopied]   = useState(false)
  const [saving, setSaving]   = useState(false)

  const formUrl = `${window.location.origin}/intake`

  const handleAdd = async () => {
    setSaving(true)
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
    setSaving(false)
  }

  const copyLink = () => {
    navigator.clipboard?.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Intake form</h1>
          <p>Build your qualifier form. Share the link in your Meta ads.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={copyLink}>
            <Icon name="copy" size={13} /> {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} /> Add field
          </button>
        </div>
      </div>

      <div className="tabs mt-2" style={{ width: 'fit-content', marginBottom: 20 }}>
        <button className={`tab ${tab === 'builder' ? 'active' : ''}`} onClick={() => setTab('builder')}>Builder</button>
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
                <button className="btn btn-danger btn-icon btn-sm" onClick={() => remove(f.id)}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {tab === 'preview' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ marginBottom: 4 }}>Participation form</h2>
          <p className="muted text-sm mt-1" style={{ marginBottom: 24 }}>Complete this form to book your research session.</p>
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
              Submit &amp; book session
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
                <input placeholder="Option A, Option B, Option C" value={newF.options} onChange={e => setNewF(f => ({ ...f, options: e.target.value }))} />
              </div>
            )}
            <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: 13.5 }}>
              <input type="checkbox" checked={newF.required} onChange={e => setNewF(f => ({ ...f, required: e.target.checked }))} style={{ width: 'auto' }} />
              Required field
            </label>
          </div>
          <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newF.label || saving}>
              <Icon name="plus" size={14} /> Add field
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
