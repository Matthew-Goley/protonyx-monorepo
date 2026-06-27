import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  breadcrumb: string
  right?: ReactNode
}

export function PageHeader({ title, breadcrumb, right }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-primary">{title}</h1>
        <p className="mt-1 text-xs text-secondary">{breadcrumb}</p>
      </div>
      {right && <div className="flex items-center gap-3 pt-1">{right}</div>}
    </div>
  )
}
