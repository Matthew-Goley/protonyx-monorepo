import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        gradient: 'bg-gradient-brand text-base font-semibold hover:opacity-90',
        default: 'bg-card-hover text-primary hover:bg-subtle',
        outline:
          'border border-subtle bg-transparent text-primary hover:bg-card-hover',
        teal: 'border border-accent-teal/30 bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20',
        red: 'border border-accent-red/30 bg-accent-red/10 text-accent-red hover:bg-accent-red/20',
        ghost: 'bg-transparent text-secondary hover:bg-card-hover hover:text-primary',
        destructive: 'bg-accent-red text-primary hover:bg-accent-red/90',
        link: 'text-accent-teal underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-lg px-8',
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
