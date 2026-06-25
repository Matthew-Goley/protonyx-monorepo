import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

/** Sidebar + scrollable main content area shared by every authed page. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <Sidebar />
      <main className="ml-[220px] min-h-screen overflow-y-auto p-8">{children}</main>
    </div>
  )
}
