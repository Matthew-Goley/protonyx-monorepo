import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Geometry follows styling.md §Buttons: 40px tall, 20px horizontal padding,
// weight 500 (radius comes from the app-wide --radius* tokens in index.css).
// Color/hover/motion are NOT declared here: every variant maps to one of the
// five .btn-{role} classes in index.css (the "Mercury" button mechanics
// block), so the whole app's buttons share one fill/hover language. Variant
// names are kept from before the role system existed so call sites didn't
// need to change; `default` and `destructive` aren't used anywhere today but
// are mapped sensibly for completeness.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        gradient: 'btn-primary',
        default: 'btn-secondary',
        outline: 'btn-secondary',
        teal: 'btn-accent',
        red: 'btn-danger',
        ghost: 'btn-ghost',
        destructive: 'btn-danger',
        link: 'btn-ghost',
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
