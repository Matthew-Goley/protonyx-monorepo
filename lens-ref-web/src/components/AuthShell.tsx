import type { ReactNode } from "react";
import { AUTH, ROUTES } from "../content";
import lensArcWhite from "../../assets/lens-arc/lens-arc-white.png";

// The shared chrome for every standalone auth screen: /login, /signup,
// /forgot-password and /reset-password. None of them get the NavBar (see
// isAuthRoute in App.tsx), so the wordmark is the only way back out and has to
// be a link, with a "Back to lens-arc.com" line under the card as a second one.
//
// Flat surface, nothing layered on it: no radial glow, no card, no tab pill.
// The shape echoes lens-app's sign-in (top-anchored column, wordmark, labelled
// fields, full-width primary) in this site's palette, so the only bordered
// element on these pages is the inputs themselves. Keep it that way.
//
// The top offset is PADDING on the outer element, never a margin on the child:
// with no top padding or border here, a child's margin-top would collapse out
// of this element and shift it down instead, leaving a strip of bare white body
// above the dark background.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0c0f16] px-6 pb-16 pt-24 text-white">
      <main className="mx-auto w-full max-w-md">
        <div className="text-center">
          <a href={ROUTES.home} aria-label="Lens Arc home" className="inline-block">
            <img
              src={lensArcWhite}
              alt="Lens Arc"
              className="h-9 w-auto select-none"
              draggable={false}
            />
          </a>
        </div>

        {children}

        <p className="mt-10 text-center text-xs text-white/25">
          <a
            href={ROUTES.home}
            className="transition-colors duration-200 hover:text-white/60"
          >
            {AUTH.backHome}
          </a>
        </p>
      </main>
    </div>
  );
}

// Label above a flat bordered input. The 1px border is the only box on these
// pages; nothing wraps it.
export function AuthField({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus = false,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-white/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-[15px] border border-white/12 bg-transparent px-4 text-sm text-white placeholder:text-white/25 transition-colors duration-200 focus:border-teal-400/70 focus:outline-none"
      />
    </label>
  );
}

// Tinted block rather than a bare red line, matching lens-app's error
// treatment. A fill, not another outline.
export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[15px] bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-300"
    >
      {message}
    </p>
  );
}

export function AuthNotice({ message }: { message: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-[15px] bg-teal-400/10 px-4 py-3 text-sm leading-relaxed text-teal-200"
    >
      {message}
    </p>
  );
}
