import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  breadcrumb: string
  right?: ReactNode
}

/**
 * Slim inline page bar: title and breadcrumb on one line (`Title · path`), an
 * optional actions slot on the right, and a thin divider beneath. Kept compact
 * so it frames the page without dominating it.
 */
export function PageHeader({ title, breadcrumb, right }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 border-b border-subtle pb-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="shrink-0 text-base font-semibold text-primary">{title}</h1>
        <span aria-hidden className="text-muted">
          |
        </span>
        <span className="truncate text-sm text-secondary">{breadcrumb}</span>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}
