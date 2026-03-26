import StatusBadge from './StatusBadge'
import Icon from './Icon'

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function ParticipantCard({ participant, onEdit, onDelete, onStatusChange }) {
  return (
    <tr>
      <td>
        <strong>{participant.name}</strong>
        {participant.location && (
          <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {participant.location}
          </div>
        )}
      </td>
      <td>
        <div>{participant.email || '—'}</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{participant.phone || '—'}</div>
      </td>
      <td className="text-sm">{fmtDate(participant.booked_at)}</td>
      <td>
        <select
          value={participant.status}
          onChange={e => onStatusChange(participant.id, e.target.value)}
          style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
        >
          <option value="booked">Booked</option>
          <option value="completed">Completed</option>
          <option value="no-show">No-show</option>
        </select>
      </td>
      <td>
        <div className="flex gap-2">
          {participant.meet_link && (
            <a
              href={participant.meet_link}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm btn-icon"
              title="Join call"
            >
              <Icon name="video" size={13} />
            </a>
          )}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(participant)} title="Edit">
            <Icon name="edit" size={13} />
          </button>
          <button className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(participant.id)} title="Delete">
            <Icon name="trash" size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}
