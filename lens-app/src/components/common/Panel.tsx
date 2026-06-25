import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Standard dark surface card: bg-card, subtle border, rounded-xl, p-5. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-subtle bg-card p-5', className)}
      {...props}
    />
  )
}

/** 11px uppercase tracking-widest muted card label. */
export function CardLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-[11px] font-medium uppercase tracking-widest text-muted',
        className,
      )}
      {...props}
    />
  )
}
