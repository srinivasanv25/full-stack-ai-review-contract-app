'use client'

import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

const MAX_LENGTH = 2000

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  isLoading?: boolean
}

export function ChatInput({ onSend, disabled = false, isLoading = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const isDisabled = disabled || isLoading

  const handleSend = () => {
    const trimmed = value.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH || isDisabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-md">
      <div className="flex items-end gap-sm">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
          placeholder={
            disabled
              ? 'This contract must finish processing before you can chat.'
              : 'Ask a question about this contract...'
          }
          className="max-h-32 flex-1 resize-none rounded-input border border-border-strong bg-elevated-surface px-md py-sm text-body text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled || value.trim().length === 0}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input bg-primary text-white transition-colors duration-150 ease-out hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <p className="mt-xs text-small text-text-muted">
        {value.length} / {MAX_LENGTH}
      </p>
    </div>
  )
}
