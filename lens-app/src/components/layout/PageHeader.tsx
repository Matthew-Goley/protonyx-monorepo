import { type ReactNode } from 'react'
import { PendingChangesBar } from '@/components/common/PendingChangesBar'

interface PageHeaderProps {
  title: string
  breadcrumb: string
  right?: ReactNode
}

/**
 * Slim inline page bar: title and breadcrumb on the left, the uncommitted-changes
 * bar centered, an optional actions slot on the right, and a thin divider beneath.
 * Kept compact so it frames the page without dominating it.
 *
 * The layout is a 3-column grid rather than `justify-between` specifically so the
 * center slot is in the SAME place on every screen. Both side columns are `1fr`,
 * so they are always equal width and the `auto` middle column is truly centered
 * in the header - independent of how long the title is or how many action buttons
 * a page passes. With justify-between the middle child would drift page to page.
 * The side columns hold real width (no absolute positioning), so the bar can never
 * overlap the title or the actions.
 *
 * PendingChangesBar is rendered here rather than passed in by each page, so no
 * screen can forget it or place it differently. It renders null when there is
 * nothing pending.
 */
export function PageHeader({ title, breadcrumb, right }: PageHeaderProps) {
  return (
    <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-subtle pb-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="shrink-0 text-base font-semibold text-primary">{title}</h1>
        <span aria-hidden className="text-muted">
          |
        </span>
        <span className="truncate text-sm text-secondary">{breadcrumb}</span>
      </div>

      <div className="flex justify-center">
        <PendingChangesBar />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">{right}</div>
    </div>
  )
}
