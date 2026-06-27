import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Geometry and motion follow styling.md §Buttons: 40px tall, 6px radius, 20px
// horizontal padding, weight 500, 200ms ease-out. Primary = brand gradient fill
// (the only gradient button); secondary = outline. teal/red are tinted action
// buttons (not ghost — they carry a surface), kept for sell/buy affordance.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        gradient: 'bg-gradient-brand text-[#0a0d12] hover:opacity-[0.88]',
        default: 'bg-card-hover text-primary hover:bg-subtle',
        outline:
          'border border-subtle bg-transparent text-primary hover:border-[#3a3f4e] hover:bg-card-hover',
        teal: 'border border-accent-teal/30 bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20',
        red: 'border border-accent-red/30 bg-accent-red/10 text-accent-red hover:bg-accent-red/20',
        ghost: 'bg-transparent text-secondary hover:bg-card-hover hover:text-primary',
        destructive: 'bg-accent-red text-primary hover:bg-accent-red/90',
        link: 'text-accent-teal underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-4',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
