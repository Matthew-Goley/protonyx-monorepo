import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

/** Sidebar + scrollable main content area shared by every authed page. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <Sidebar />
      {/* Tick-grid canvas lives on the root dashboard surface only (styling.md). */}
      <main className="tick-grid-bg ml-[220px] min-h-screen overflow-y-auto p-8">
        <div className="page-fade mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  )
}
