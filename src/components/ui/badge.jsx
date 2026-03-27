import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary text-primary-foreground',
        secondary:   'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline:     'text-foreground',
        success:     'border-transparent bg-green-100 text-green-700 border-green-200',
        warning:     'border-transparent bg-amber-100 text-amber-700 border-amber-200',
        purple:      'border-transparent bg-purple-100 text-purple-700 border-purple-200',
        blue:        'border-transparent bg-blue-100 text-blue-700 border-blue-200',
        red:         'border-transparent bg-red-100 text-red-700 border-red-200',
        orange:      'border-transparent bg-orange-100 text-orange-700 border-orange-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
