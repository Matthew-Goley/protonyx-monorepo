import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

// Button system, replicating the lens-app button experience: geometry from
// lens-app's button.tsx (40px tall, 20px horizontal padding, weight 500,
// 15px radius, teal focus ring) over the five Mercury role classes ported
// into src/index.css (flat fills, 160ms color-only transitions, no motion).
// The one departure is HeroButton below, for major hero CTAs. (An earlier
// water-ripple canvas sim lived here; it was cut entirely, git history only.)

export type BtnRole = "primary" | "secondary" | "ghost" | "accent" | "danger";
type BtnSize = "default" | "sm" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[15px] text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4cb1f9]/40 disabled:pointer-events-none disabled:opacity-50";

const SIZES: Record<BtnSize, string> = {
  default: "h-10 px-5",
  sm: "h-9 px-4",
  lg: "h-11 px-8",
};

function btnClass(role: BtnRole, size: BtnSize, className = "") {
  return `${BASE} ${SIZES[size]} btn-${role} ${className}`;
}

// Anchor-flavored button (most CTAs on this site are links).
export function BtnLink({
  role = "secondary",
  size = "default",
  className = "",
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  role?: BtnRole;
  size?: BtnSize;
  children: ReactNode;
}) {
  return (
    <a {...rest} className={btnClass(role, size, className)}>
      {children}
    </a>
  );
}

// Real <button>, for form submits and menu actions.
export function Btn({
  role = "secondary",
  size = "default",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  role?: BtnRole;
  size?: BtnSize;
  children: ReactNode;
}) {
  return (
    <button {...rest} className={btnClass(role, size, className)}>
      {children}
    </button>
  );
}

// Major-hero CTA: the house gradient at hero scale, static. Mercury-quiet on
// hover (a slight darken via filter, no motion, no lift, no glow).
export function HeroButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2.5 rounded-[15px] px-9 py-4 text-base font-semibold text-white transition-[filter] duration-200 hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4cb1f9]/40 ${className}`}
      style={{ backgroundImage: "linear-gradient(135deg, #2dd4bf, #38bdf8)" }}
    >
      {children}
    </a>
  );
}
