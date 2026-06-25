import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  breadcrumb: string
  right?: ReactNode
}

export function PageHeader({ title, breadcrumb, right }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-primary">{title}</h1>
        <p className="mt-1 text-xs text-muted">{breadcrumb}</p>
      </div>
      {right && <div className="flex items-center gap-3 pt-1">{right}</div>}
    </div>
  )
}
