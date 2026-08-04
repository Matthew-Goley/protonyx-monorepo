import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { COPY } from "../content";
import lensArcDark from "../../assets/lens-arc/lens-arc-dark.png";

// Generic shell for simple, non-marketing pages (legal docs today, anything
// similar added later): logo + back link, a title, an open content slot.
// Deliberately plain, no gradients, no motion, no marketing copy, so it reads
// as a document rather than a continuation of the landing page. Reuse this
// for any future page that just needs "title + body" (about, FAQ, etc.).
export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={15} />
            Back to home
          </a>
          <img
            src={lensArcDark}
            alt="Lens Arc"
            className="h-6 w-auto select-none"
            draggable={false}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-slate-700">
          {children ?? (
            <p className="italic text-slate-400">[{title} content goes here.]</p>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-8 text-xs text-slate-400">
          {COPY.legal}
        </div>
      </footer>
    </div>
  );
}
