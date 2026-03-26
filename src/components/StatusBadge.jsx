const map = {
  completed: { cls: 'badge-green', label: 'Completed' },
  booked:    { cls: 'badge-blue',  label: 'Booked'    },
  'no-show': { cls: 'badge-red',   label: 'No-show'   },
  L1:        { cls: 'badge-purple',label: 'L1'        },
  L2:        { cls: 'badge-blue',  label: 'L2'        },
  L3:        { cls: 'badge-amber', label: 'L3'        },
  sent:      { cls: 'badge-green', label: 'Sent'      },
  failed:    { cls: 'badge-red',   label: 'Failed'    },
}

export default function StatusBadge({ status }) {
  const { cls, label } = map[status] || { cls: 'badge-purple', label: status }
  return <span className={`badge ${cls}`}>{label}</span>
}
