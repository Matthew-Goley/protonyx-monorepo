import lensArcWhite from '@/assets/lens-arc/lens-arc-white.png'
import lensArcDark from '@/assets/lens-arc/lens-arc-dark.png'
import iconNoBg from '@/assets/lens-arc/icon-nobg.png'
import iconRounded from '@/assets/lens-arc/icon-rounded.png'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

type LogoVariant = 'full' | 'full-dark' | 'icon' | 'icon-rounded'

const SOURCES: Record<LogoVariant, string> = {
  full: lensArcWhite,
  'full-dark': lensArcDark,
  icon: iconNoBg,
  'icon-rounded': iconRounded,
}

/**
 * Lens Arc brand mark. The default `full` wordmark is theme-aware: white text on
 * dark surfaces, dark text in light mode. Use `icon` / `icon-rounded` for square,
 * tight spaces. Pass height/width via `className` (e.g. "h-8 w-auto"); the image
 * keeps its own aspect ratio.
 */
export function Logo({
  variant = 'full',
  className,
}: {
  variant?: LogoVariant
  className?: string
}) {
  const { theme } = useTheme()
  // `full` swaps to the dark-text wordmark in light mode; other variants are
  // background-agnostic (the icon mark / rounded tile read on either surface).
  const src = variant === 'full' && theme === 'light' ? lensArcDark : SOURCES[variant]
  return (
    <img
      src={src}
      alt="Lens Arc"
      className={cn('select-none', className)}
      draggable={false}
    />
  )
}
