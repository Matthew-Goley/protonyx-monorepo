import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Standard dark surface card (styling.md §Cards): bg-surface, subtle border,
 *  8px radius, 24px padding, no shadow (depth comes from the surface lift over
 *  the tick grid, not shadows). */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-subtle bg-card p-6', className)}
      {...props}
    />
  )
}

/** Section label — styling.md --text-label (13px / 500), uppercase, secondary. */
export function CardLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-[13px] font-medium uppercase tracking-wider text-secondary',
        className,
      )}
      {...props}
    />
  )
}
