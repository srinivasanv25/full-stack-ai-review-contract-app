import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover disabled:hover:bg-primary',
  secondary: 'bg-secondary text-white hover:bg-secondary-hover disabled:hover:bg-secondary',
  ghost:
    'bg-transparent text-text-primary border border-border-strong hover:bg-background-subtle',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-md text-small',
  md: 'h-11 px-lg text-body',
}

// Shared with any non-<button> element (e.g. next/link) that needs identical
// styling — keeps CTA links and real buttons visually in sync from one source.
export function buttonClassNames(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = ''
): string {
  return `inline-flex items-center justify-center gap-sm rounded-input font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', isLoading = false, disabled, className = '', children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClassNames(variant, size, className)}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" size={16} strokeWidth={1.5} aria-hidden />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
