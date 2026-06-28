import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/** Top bar + sidebar + scrollable main content area shared by every authed page.
 *  The Sidebar (z-20) is layered above the TopBar (z-10) so it overlaps it. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <TopBar />
      <Sidebar />
      {/* Tick-grid canvas lives on the root dashboard surface only (styling.md). */}
      <main className="tick-grid-bg ml-[220px] min-h-screen overflow-y-auto p-8 pt-[5.5rem]">
        <div className="page-fade mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  )
}
