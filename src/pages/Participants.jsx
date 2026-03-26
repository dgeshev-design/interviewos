import { useState } from 'react'
import { useParticipants } from '@/hooks/useParticipants'
import ParticipantCard from '@/components/ParticipantCard'
import Modal from '@/components/Modal'
import Icon from '@/components/Icon'

const EMPTY = { name: '', email: '', phone: '', age_group: '', location: '', status: 'booked', booked_at: '', meet_link: '', notes: '' }

function ParticipantForm({ data, onChange, onSave, onClose, title }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex-col gap-3">
        <div className="grid-2">
          <div className="field"><label>Full name *</label>
            <input value={data.name} onChange={e => onChange('name', e.target.value)} />
          </div>
          <div className="field"><label>Email</label>
            <input type="email" value={data.email} onChange={e => onChange('email', e.target.value)} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label>Phone</label>
            <input value={data.phone} onChange={e => onChange('phone', e.target.value)} />
          </div>
          <div className="field"><label>Location</label>
            <input value={data.location} onChange={e => onChange('location', e.target.value)} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field"><label>Age group</label>
            <select value={data.age_group} onChange={e => onChange('age_group', e.target.value)}>
              <option value="">Select…</option>
              {['Under 18','18-24','25-34','35-44','45+'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="field"><label>Status</label>
            <select value={data.status} onChange={e => onChange('status', e.target.value)}>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="no-show">No-show</option>
            </select>
          </div>
        </div>
        <div className="field"><label>Scheduled at</label>
          <input type="datetime-local" value={data.booked_at} onChange={e => onChange('booked_at', e.target.value)} />
        </div>
        <div className="field"><label>Video call link</label>
          <input placeholder="https://meet.google.com/…" value={data.meet_link} onChange={e => onChange('meet_link', e.target.value)} />
        </div>
        <div className="field"><label>Notes</label>
          <textarea value={data.notes} onChange={e => onChange('notes', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSave} disabled={!data.name}>
          <Icon name="check" size={14} /> Save
        </button>
      </div>
    </Modal>
  )
}

export default function Participants() {
  const { participants, loading, add, update, remove } = useParticipants()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [newP, setNewP] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = participants.filter(p => {
    const matchF = filter === 'all' || p.status === filter
    const matchS = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    return matchF && matchS
  })

  const handleAdd = async () => {
    setSaving(true); setError('')
    try { await add(newP); setNewP(EMPTY); setShowAdd(false) }
    catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleSaveEdit = async () => {
    setSaving(true); setError('')
    try { await update(editing.id, editing); setEditing(null) }
    catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this participant?')) return
    try { await remove(id) } catch (e) { alert(e.message) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Participants</h1>
          <p>Track every participant from lead to insight.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={14} /> Add participant
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mt-4 mb-4">
        <input
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <div className="tabs">
          {['all','booked','completed','no-show'].map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Contact</th><th>Scheduled</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>No participants found.</td></tr>
              )}
              {filtered.map(p => (
                <ParticipantCard
                  key={p.id}
                  participant={p}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                  onStatusChange={(id, status) => update(id, { status })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <ParticipantForm
          title="Add participant"
          data={newP}
          onChange={(k, v) => setNewP(p => ({ ...p, [k]: v }))}
          onSave={handleAdd}
          onClose={() => { setShowAdd(false); setError('') }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <ParticipantForm
          title={`Edit — ${editing.name}`}
          data={editing}
          onChange={(k, v) => setEditing(p => ({ ...p, [k]: v }))}
          onSave={handleSaveEdit}
          onClose={() => { setEditing(null); setError('') }}
        />
      )}
    </div>
  )
}
