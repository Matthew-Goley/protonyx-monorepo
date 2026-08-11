import type { ReactNode } from "react";
import { COPY, LEGAL_PAGES, NAV, ROUTES } from "../content";

// The one shared layout for content-first pages (/lens-arc, /legal/terms,
// /legal/privacy): a title block, an open content slot, and a basic footer,
// under the persistent NavBar (mounted app-wide in App.tsx, which is why
// there is no header here and the main pads down past the fixed bar).
// Deliberately plain, no hero, no gradients, no motion, so these pages read
// as documents rather than a continuation of the landing page. Reuse this
// for any future "title + body" page (about, FAQ, etc.).
export default function SimplePage({
  title,
  subtitle,
  effectiveDate,
  wide = false,
  serif = false,
  children,
}: {
  title: string;
  subtitle?: string;
  effectiveDate?: string;
  wide?: boolean;
  // Times New Roman for the document area (title + body), used by the actual
  // legal docs only. The site chrome (nav, footer) stays Sora either way.
  serif?: boolean;
  children?: ReactNode;
}) {
  const maxW = wide ? "max-w-5xl" : "max-w-3xl";
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-slate-900">
      <main
        className={`mx-auto w-full ${maxW} flex-1 px-6 pb-14 pt-32 ${
          serif ? "font-serif" : ""
        }`}
      >
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            {subtitle}
          </p>
        )}
        {effectiveDate && (
          <p className="mt-2 text-sm text-slate-500">Effective Date: {effectiveDate}</p>
        )}

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-slate-700">
          {children ?? (
            <p className="italic text-slate-400">[{title} content goes here.]</p>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div
          className={`mx-auto flex ${maxW} flex-col gap-3 px-6 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between`}
        >
          <p>{COPY.legal}</p>
          <div className="flex gap-4">
            {Object.values(LEGAL_PAGES).map((page) => (
              <a key={page.path} href={page.path} className="transition hover:text-slate-700">
                {page.title}
              </a>
            ))}
            <a href={ROUTES.referral} className="transition hover:text-slate-700">
              {NAV.referral.label}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
