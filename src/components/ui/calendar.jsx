import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months:       'flex flex-col sm:flex-row gap-4',
        month:        'flex flex-col gap-4',
        caption:      'flex justify-center pt-1 relative items-center w-full',
        caption_label:'text-sm font-medium',
        nav:          'flex items-center gap-1',
        nav_button:   cn('h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-input rounded-md flex items-center justify-center'),
        nav_button_previous: 'absolute left-1',
        nav_button_next:     'absolute right-1',
        table:        'w-full border-collapse',
        head_row:     'flex',
        head_cell:    'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex-1 text-center',
        row:          'flex w-full mt-2',
        cell:         'flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
        day:          cn('h-8 w-8 mx-auto p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent hover:text-accent-foreground flex items-center justify-center text-sm cursor-pointer'),
        day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today:    'bg-accent text-accent-foreground',
        day_outside:  'text-muted-foreground opacity-50',
        day_disabled: 'text-muted-foreground opacity-50 cursor-default',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none',
        day_range_start:  'day-range-start rounded-l-md',
        day_range_end:    'day-range-end rounded-r-md',
        day_hidden:   'invisible',
        ...classNames,
      }}
      components={{
        IconLeft:  () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
