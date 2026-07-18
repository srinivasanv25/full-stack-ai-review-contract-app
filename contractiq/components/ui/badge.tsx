import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'muted'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-surface text-text-secondary',
  primary: 'bg-accent-light text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  muted: 'bg-surface text-text-muted',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-xs py-[1px] text-small',
  md: 'px-sm py-[2px] text-small',
}

export function Badge({ variant = 'default', size = 'sm', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full font-semibold ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  )
}
