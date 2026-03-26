import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useParticipants } from '@/hooks/useParticipants'
import StatusBadge from '@/components/StatusBadge'
import Icon from '@/components/Icon'

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const { user } = useApp()
  const { participants, loading } = useParticipants()
  const navigate = useNavigate()

  const total     = participants.length
  const completed = participants.filter(p => p.status === 'completed').length
  const booked    = participants.filter(p => p.status === 'booked').length
  const noShow    = participants.filter(p => p.status === 'no-show').length
  const rate      = total ? Math.round((completed / total) * 100) : 0

  const upcoming  = participants
    .filter(p => p.status === 'booked')
    .sort((a, b) => new Date(a.booked_at) - new Date(b.booked_at))
    .slice(0, 5)

  const stats = [
    { num: total,      label: 'Total',           color: 'var(--accent-light)' },
    { num: completed,  label: 'Completed',        color: 'var(--green)'        },
    { num: booked,     label: 'Upcoming',         color: 'var(--blue)'         },
    { num: noShow,     label: 'No-shows',         color: 'var(--red)'          },
    { num: `${rate}%`, label: 'Completion rate',  color: 'var(--amber)'        },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.user_metadata?.given_name || 'there'} — here's your research at a glance.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <div className="label">{s.label}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800,
              color: s.color, lineHeight: 1, margin: '8px 0 6px'
            }}>
              {loading ? '—' : s.num}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: typeof s.num === 'string'
                  ? s.num
                  : `${total ? Math.min(100, (s.num / total) * 100) : 0}%`,
                background: s.color
              }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 mt-6" style={{ gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        {/* Upcoming sessions */}
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <h2>Upcoming sessions</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/participants')}>
              View all <Icon name="chevronR" size={13} />
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>
              No upcoming sessions. Add participants to get started.
            </div>
          ) : (
            <div className="flex-col gap-2">
              {upcoming.map(p => (
                <div key={p.id} className="card-sm flex items-center justify-between">
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{p.name}</strong>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {fmtDate(p.booked_at)}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <StatusBadge status={p.status} />
                    {p.meet_link && (
                      <a href={p.meet_link} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                        <Icon name="video" size={13} /> Join
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>Quick actions</h2>
          <div className="flex-col gap-2">
            {[
              { icon: 'users',    label: 'Add participant',       to: '/participants' },
              { icon: 'mic',      label: 'Start interview',        to: '/guide'        },
              { icon: 'upload',   label: 'Upload research brief',  to: '/guide'        },
              { icon: 'mail',     label: 'Send reminders',         to: '/comms'        },
            ].map(a => (
              <button
                key={a.label}
                className="card-sm flex items-center gap-3"
                style={{ cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', width: '100%', textAlign: 'left', transition: 'border-color var(--t-base)' }}
                onClick={() => navigate(a.to)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-base)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--bg-overlay)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon name={a.icon} size={15} color="var(--accent-light)" />
                </div>
                <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{a.label}</span>
                <Icon name="chevronR" size={13} color="var(--text-tertiary)" style={{ marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
