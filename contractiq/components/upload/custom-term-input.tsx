'use client'

import { useState, type KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MAX_CUSTOM_TERM_LENGTH } from '@/lib/constants/config'

interface CustomTermInputProps {
  terms: string[]
  onAdd: (term: string) => void
  onRemove: (index: number) => void
  maxTerms: number
  disabled?: boolean
}

export function CustomTermInput({ terms, onAdd, onRemove, maxTerms, disabled = false }: CustomTermInputProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const atMax = terms.length >= maxTerms

  const handleAdd = () => {
    const trimmed = value.trim()
    if (trimmed.length === 0 || atMax) return
    if (trimmed.length > MAX_CUSTOM_TERM_LENGTH) {
      setError(`Term must be ${MAX_CUSTOM_TERM_LENGTH} characters or fewer.`)
      return
    }
    if (terms.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setError('Term already added.')
      return
    }
    onAdd(trimmed)
    setValue('')
    setError(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      {terms.length > 0 && (
        <div className="mb-sm flex flex-wrap gap-sm">
          {terms.map((term, index) => (
            <Badge key={`${term}-${index}`} variant="primary" size="md" className="gap-xs">
              {term}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${term}`}
                  className="ml-xs"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-sm">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || atMax}
          maxLength={MAX_CUSTOM_TERM_LENGTH}
          placeholder={atMax ? 'Maximum custom terms reached' : 'e.g. Non-compete radius'}
          className="h-11 flex-1 rounded-input border border-border-strong bg-elevated-surface px-md text-body text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || atMax || value.trim().length === 0}
          className="flex h-11 shrink-0 items-center gap-xs rounded-input bg-primary px-md text-small font-semibold text-white transition-colors duration-150 ease-out hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          Add
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-xs text-small text-error">
          {error}
        </p>
      )}
      <p className="mt-xs text-small text-text-muted">
        {terms.length} of {maxTerms} custom terms used
      </p>
    </div>
  )
}
