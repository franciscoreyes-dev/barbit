import type React from 'react'
import { cn } from '@/lib/utils'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-sm font-medium text-zinc-300 leading-none', className)}
      {...props}
    />
  )
}
