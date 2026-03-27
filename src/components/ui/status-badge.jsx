import { Badge } from '@/components/ui/badge'
import { STATUS_CONFIG } from '@/lib/utils'

export default function StatusBadge({ status, className }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color} ${className || ''}`}>
      {cfg.label}
    </span>
  )
}
