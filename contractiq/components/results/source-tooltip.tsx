'use client'

import { useState } from 'react'
import { Quote, ChevronDown, ChevronUp } from 'lucide-react'

interface SourceTooltipProps {
  sourceSentence: string | null
}

export function SourceTooltip({ sourceSentence }: SourceTooltipProps) {
  const [expanded, setExpanded] = useState(false)

  if (!sourceSentence) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center gap-xs text-small font-medium text-text-muted hover:text-primary"
      >
        <Quote size={12} strokeWidth={2} aria-hidden />
        Source
        {expanded ? (
          <ChevronUp size={12} strokeWidth={2} aria-hidden />
        ) : (
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        )}
      </button>
      {expanded && (
        <blockquote className="mt-xs rounded-input bg-background-subtle px-sm py-xs text-small italic text-text-secondary">
          &ldquo;{sourceSentence}&rdquo;
        </blockquote>
      )}
    </div>
  )
}
