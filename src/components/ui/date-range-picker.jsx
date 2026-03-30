import * as React from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// from/to as Date objects; onChange({ from, to })
export function DateRangePicker({ from, to, onChange, placeholder = 'Pick a date range', className }) {
  const [open, setOpen] = React.useState(false)
  const range = from || to ? { from, to } : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-start text-left font-normal', !range && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {range?.from ? (
            range.to
              ? <>{format(range.from, 'MMM d, yyyy')} – {format(range.to, 'MMM d, yyyy')}</>
              : format(range.from, 'MMM d, yyyy')
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) => { onChange({ from: r?.from, to: r?.to }); if (r?.from && r?.to) setOpen(false) }}
          initialFocus
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
