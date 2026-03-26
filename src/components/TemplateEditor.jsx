import Modal from './Modal'
import Icon from './Icon'

const CHANNEL_ICONS = { email: '✉', sms: '💬', whatsapp: '📱' }
const CHANNEL_COLORS = {
  email:    { bg: 'rgba(79,168,245,0.1)',    color: 'var(--blue)'  },
  sms:      { bg: 'rgba(61,214,140,0.1)',    color: 'var(--green)' },
  whatsapp: { bg: 'rgba(37,211,102,0.12)',   color: '#25d366'      },
}

export function ChannelBadge({ channel }) {
  const s = CHANNEL_COLORS[channel] || {}
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      fontSize: 12, fontWeight: 500,
      background: s.bg, color: s.color
    }}>
      {CHANNEL_ICONS[channel]} {channel}
    </span>
  )
}

export default function TemplateEditor({ template, onChange, onSave, onClose }) {
  const isEmail = template.channel === 'email'

  return (
    <Modal title={template.id ? 'Edit template' : 'New template'} onClose={onClose}>
      <div className="flex-col gap-3">
        <div className="grid-2">
          <div className="field">
            <label>Template name</label>
            <input
              value={template.name}
              onChange={e => onChange('name', e.target.value)}
              placeholder="e.g. Booking confirmation"
            />
          </div>
          <div className="field">
            <label>Channel</label>
            <select value={template.channel} onChange={e => onChange('channel', e.target.value)}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>

        {isEmail && (
          <div className="field">
            <label>Subject line</label>
            <input
              value={template.subject || ''}
              onChange={e => onChange('subject', e.target.value)}
              placeholder="Your interview is confirmed!"
            />
          </div>
        )}

        <div className="field">
          <label>Message body</label>
          <textarea
            value={template.body}
            onChange={e => onChange('body', e.target.value)}
            style={{ minHeight: 120 }}
            placeholder="Hi {{name}}, your interview is on {{date}} at {{time}}. Join here: {{link}}"
          />
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Variables: {'{{name}} {{date}} {{time}} {{link}} {{email}} {{phone}}'}
          </div>
        </div>

        <div className="field">
          <label>Send timing (hours before interview; 0 = on booking)</label>
          <input
            type="number"
            value={template.trigger_offset ?? 0}
            onChange={e => onChange('trigger_offset', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={onSave}
          disabled={!template.name || !template.body}
        >
          <Icon name="check" size={14} /> Save template
        </button>
      </div>
    </Modal>
  )
}
