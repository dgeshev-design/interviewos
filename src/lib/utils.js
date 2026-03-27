import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', ...opts
  })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export const STATUS_CONFIG = {
  booked:          { label: 'Booked',          color: 'bg-blue-100 text-blue-700 border-blue-200'     },
  completed:       { label: 'Completed',        color: 'bg-green-100 text-green-700 border-green-200'  },
  'no-show':       { label: 'No-show',          color: 'bg-red-100 text-red-700 border-red-200'        },
  disqualified:    { label: 'Disqualified',     color: 'bg-orange-100 text-orange-700 border-orange-200'},
  'prize-granted': { label: 'Prize Granted',    color: 'bg-purple-100 text-purple-700 border-purple-200'},
  cancelled:       { label: 'Cancelled',        color: 'bg-gray-100 text-gray-500 border-gray-200'       },
}

export const TRIGGER_LABELS = {
  booking_confirmed: 'Booking confirmed',
  reminder_24h:      '24h before',
  reminder_3h:       '3h before',
  reminder_1h:       '1h before',
  reminder_5min:     '5min before',
  no_show:           'No-show follow-up',
  prize:             'Prize / incentive',
  custom:            'Custom',
}

export const TEMPLATE_VARS = [
  { key: '{{name}}',       label: 'Participant name'  },
  { key: '{{email}}',      label: 'Email'             },
  { key: '{{phone}}',      label: 'Phone'             },
  { key: '{{date}}',       label: 'Session date'      },
  { key: '{{time}}',       label: 'Session time'      },
  { key: '{{link}}',       label: 'Meet link'         },
  { key: '{{study}}',      label: 'Study name'        },
  { key: '{{prize_code}}', label: 'Promo code'        },
]

export function applyTemplateVars(text, participant, study, slot) {
  if (!text) return ''
  const dt = slot?.starts_at || participant?.booked_at
    ? new Date(slot?.starts_at || participant?.booked_at)
    : null
  return text
    .replace(/{{name}}/g,       participant?.name || '')
    .replace(/{{email}}/g,      participant?.email || '')
    .replace(/{{phone}}/g,      participant?.phone || '')
    .replace(/{{date}}/g,       dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
    .replace(/{{time}}/g,       dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')
    .replace(/{{link}}/g,       participant?.meet_link || slot?.meet_link || '')
    .replace(/{{study}}/g,      study?.name || '')
    .replace(/{{prize_code}}/g, participant?.promo_code || '')
}
