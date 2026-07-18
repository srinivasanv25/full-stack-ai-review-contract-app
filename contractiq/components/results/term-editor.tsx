'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { KeyTerm } from '@/types/contracts'
import { Button } from '@/components/ui/button'

const MAX_VALUE_LENGTH = 2000

interface TermEditorProps {
  term: KeyTerm
  onSave: (value: string) => void
  onCancel: () => void
  isSaving: boolean
}

export function TermEditor({ term, onSave, onCancel, isSaving }: TermEditorProps) {
  const [value, setValue] = useState(term.value ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  const isUnchanged = value === (term.value ?? '')

  const handleSave = () => {
    if (isUnchanged || isSaving) return
    onSave(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="flex flex-col gap-xs">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, MAX_VALUE_LENGTH))}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        rows={3}
        maxLength={MAX_VALUE_LENGTH}
        className="w-full rounded-input border border-border-strong bg-elevated-surface px-md py-sm text-body text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex items-center justify-between">
        <p className="text-small text-text-muted">
          {value.length} / {MAX_VALUE_LENGTH}
        </p>
        <div className="flex gap-sm">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isUnchanged}
            isLoading={isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
