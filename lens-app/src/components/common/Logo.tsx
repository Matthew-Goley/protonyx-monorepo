import lensArcWhite from '@/assets/lens-arc/lens-arc-white.png'
import lensArcDark from '@/assets/lens-arc/lens-arc-dark.png'
import iconNoBg from '@/assets/lens-arc/icon-nobg.png'
import iconRounded from '@/assets/lens-arc/icon-rounded.png'
import { cn } from '@/lib/utils'

type LogoVariant = 'full' | 'full-dark' | 'icon' | 'icon-rounded'

const SOURCES: Record<LogoVariant, string> = {
  full: lensArcWhite,
  'full-dark': lensArcDark,
  icon: iconNoBg,
  'icon-rounded': iconRounded,
}

/**
 * Lens Arc brand mark. Defaults to the full white wordmark, which suits the
 * app's dark surfaces. Use `icon` / `icon-rounded` for square, tight spaces.
 * Pass height/width via `className` (e.g. "h-8 w-auto"); the image keeps its
 * own aspect ratio.
 */
export function Logo({
  variant = 'full',
  className,
}: {
  variant?: LogoVariant
  className?: string
}) {
  return (
    <img
      src={SOURCES[variant]}
      alt="Lens Arc"
      className={cn('select-none', className)}
      draggable={false}
    />
  )
}
