import { Badge } from '@/components/ui/badge'
import { STATUS_CONFIG } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function StatusBadge({ status, className }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200' }
  return (
    <Badge variant="outline" className={cn(cfg.color, className)}>
      {cfg.label}
    </Badge>
  )
}
