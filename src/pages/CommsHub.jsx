import { useState, useEffect } from 'react'
import { useTemplates } from '@/hooks/useTemplates'
import { useParticipants } from '@/hooks/useParticipants'
import { useApp } from '@/context/AppContext'
import { sendEmail, sendSMS, sendWhatsApp } from '@/lib/api'
import TemplateEditor, { ChannelBadge } from '@/components/TemplateEditor'
import Icon from '@/components/Icon'
import StatusBadge from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'

const EMPTY_TEMPLATE = { name: '', channel: 'email', subject: '', body: '', trigger_offset: 0 }

const fmtDate = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function applyVars(text, p) {
  if (!p) return text
  const dt = p.booked_at ? new Date(p.booked_at) : null
  return text
    .replace(/{{name}}/g,  p.name || '')
    .replace(/{{email}}/g, p.email || '')
    .replace(/{{phone}}/g, p.phone || '')
    .replace(/{{date}}/g,  dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
    .replace(/{{time}}/g,  dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
    .replace(/{{link}}/g,  p.meet_link || '#')
}

export default function CommsHub() {
  useEffect(() => { document.title = 'Communications | InterviewOS' }, [])
  const { workspace } = useApp()
  const { templates, loading, add, update, remove } = useTemplates()
  const { participants } = useParticipants()

  const [showEditor, setShowEditor]   = useState(false)
  const [editing, setEditing]         = useState(null)
  const [draft, setDraft]             = useState(EMPTY_TEMPLATE)
  const [selectedPid, setSelectedPid] = useState('')
  const [sendingId, setSendingId]     = useState(null)
  const [sendLog, setSendLog]         = useState([])

  const participant = participants.find(p => p.id === selectedPid)

  const openNew   = () => { setDraft(EMPTY_TEMPLATE); setEditing(null); setShowEditor(true) }
  const openEdit  = (t) => { setDraft({ ...t }); setEditing(t); setShowEditor(true) }
  const closeEditor = () => { setShowEditor(false); setEditing(null) }

  const handleSave = async () => {
    try {
      if (editing) await update(editing.id, draft)
      else         await add(draft)
      closeEditor()
    } catch (e) { alert(e.message) }
  }

  const handleSend = async (t) => {
    if (!participant) { alert('Select a participant first.'); return }
    setSendingId(t.id)

    const body    = applyVars(t.body, participant)
    const subject = applyVars(t.subject || '', participant)
    let result

    try {
      if      (t.channel === 'email')    result = await sendEmail({ to: participant.email, subject, body })
      else if (t.channel === 'sms')      result = await sendSMS({ to: participant.phone, body })
      else if (t.channel === 'whatsapp') result = await sendWhatsApp({ to: participant.phone, body })

      const status = result?.error ? 'failed' : 'sent'

      // Log to Supabase
      await supabase.from('send_log').insert({
        workspace_id:   workspace.id,
        template_id:    t.id,
        participant_id: participant.id,
        channel:        t.channel,
        status,
        error:          result?.error || null,
      })

      setSendLog(l => [{
        id:      Math.random().toString(36).slice(2),
        channel: t.channel,
        name:    t.name,
        to:      participant.name,
        status,
        at:      new Date().toISOString()
      }, ...l])
    } catch (e) {
      alert(`Send failed: ${e.message}`)
    }
    setSendingId(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Comms hub</h1>
          <p>Email, SMS and WhatsApp templates. Trigger per participant.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Icon name="plus" size={14} /> New template
        </button>
      </div>

      {/* Participant selector */}
      <div className="flex items-center gap-3 mt-2 mb-6">
        <span className="text-sm muted">Preview &amp; send for:</span>
        <select value={selectedPid} onChange={e => setSelectedPid(e.target.value)} style={{ width: 240 }}>
          <option value="">Select participant…</option>
          {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-xs muted">Variables: {'{{name}} {{date}} {{time}} {{link}}'}</span>
      </div>

      {/* Templates */}
      <div className="flex-col gap-3">
        {loading && <p className="muted">Loading templates…</p>}
        {!loading && templates.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 48 }}>
            No templates yet. Create your first template.
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="flex items-center gap-3">
                <ChannelBadge channel={t.channel} />
                <div>
                  <strong style={{ fontSize: 14 }}>{t.name}</strong>
                  {t.trigger_offset !== 0 && (
                    <span className="text-xs muted" style={{ marginLeft: 8 }}>
                      {t.trigger_offset < 0 ? `${Math.abs(t.trigger_offset)}h before` : 'On booking'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSend(t)}
                  disabled={sendingId === t.id}
                >
                  <Icon name="send" size={12} />
                  {sendingId === t.id ? 'Sending…' : 'Send now'}
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(t)}>
                  <Icon name="edit" size={13} />
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(t.id)}>
                  <Icon name="trash" size={12} />
                </button>
              </div>
            </div>

            {t.subject && (
              <div className="text-sm muted" style={{ marginBottom: 8 }}>
                <strong>Subject:</strong> {participant ? applyVars(t.subject, participant) : t.subject}
              </div>
            )}
            <div className="card-sm text-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {participant ? applyVars(t.body, participant) : t.body}
            </div>
          </div>
        ))}
      </div>

      {/* Send log */}
      {sendLog.length > 0 && (
        <div className="mt-8">
          <h2 style={{ marginBottom: 12 }}>Send log</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr><th>Channel</th><th>Template</th><th>Sent to</th><th>Status</th><th>Time</th></tr>
              </thead>
              <tbody>
                {sendLog.map(l => (
                  <tr key={l.id}>
                    <td><ChannelBadge channel={l.channel} /></td>
                    <td>{l.name}</td>
                    <td>{l.to}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="text-sm">{fmtDate(l.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template editor modal */}
      {showEditor && (
        <TemplateEditor
          template={draft}
          onChange={(k, v) => setDraft(d => ({ ...d, [k]: v }))}
          onSave={handleSave}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
