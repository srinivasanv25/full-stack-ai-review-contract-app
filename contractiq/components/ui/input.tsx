import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={Boolean(error)}
        className={`h-11 w-full rounded-input border bg-elevated-surface px-md text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          error ? 'border-error' : 'border-border-strong focus:border-primary'
        } ${className}`}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
