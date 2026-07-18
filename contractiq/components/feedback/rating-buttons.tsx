import { ThumbsUp, ThumbsDown } from 'lucide-react'

interface RatingButtonsProps {
  value: 'up' | 'down' | null
  onChange: (rating: 'up' | 'down') => void
  disabled?: boolean
}

export function RatingButtons({ value, onChange, disabled = false }: RatingButtonsProps) {
  return (
    <div className="flex items-center gap-md">
      <button
        type="button"
        onClick={() => onChange('up')}
        disabled={disabled}
        aria-pressed={value === 'up'}
        aria-label="Thumbs up"
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
          value === 'up'
            ? 'border-success bg-success/10 text-success'
            : 'border-border-strong text-text-muted hover:border-success hover:text-success'
        }`}
      >
        <ThumbsUp size={22} strokeWidth={1.75} fill={value === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={() => onChange('down')}
        disabled={disabled}
        aria-pressed={value === 'down'}
        aria-label="Thumbs down"
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
          value === 'down'
            ? 'border-error bg-error/10 text-error'
            : 'border-border-strong text-text-muted hover:border-error hover:text-error'
        }`}
      >
        <ThumbsDown size={22} strokeWidth={1.75} fill={value === 'down' ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
