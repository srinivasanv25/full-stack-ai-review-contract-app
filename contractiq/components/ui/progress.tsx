interface ProgressProps {
  value: number // 0-100
  colorClassName?: string
  trackClassName?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Progress({
  value,
  colorClassName = 'bg-primary',
  trackClassName = 'bg-surface',
  size = 'sm',
  className = '',
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5'

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-full ${trackClassName} ${height} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-150 ease-out ${colorClassName}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
