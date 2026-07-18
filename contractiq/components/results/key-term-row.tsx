'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import type { KeyTerm } from '@/types/contracts'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from './confidence-badge'
import { SourceTooltip } from './source-tooltip'
import { TermEditor } from './term-editor'

interface KeyTermRowProps {
  term: KeyTerm
  onPageClick: (page: number) => void
  isEditing: boolean
  onStartEdit: (termId: string) => void
  onSaveEdit: (value: string) => void
  onCancelEdit: () => void
  isSaving: boolean
  editable?: boolean
}

export function KeyTermRow({
  term,
  onPageClick,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  editable = true,
}: KeyTermRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="border-b border-border py-md last:border-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="flex items-center gap-xs">
          <h4 className="text-body font-semibold text-text-primary">{term.termName}</h4>
          {term.isEdited && <Badge variant="primary">Edited</Badge>}
        </div>
        {editable && !isEditing && (
          <button
            type="button"
            onClick={() => onStartEdit(term.id)}
            aria-label={`Edit ${term.termName}`}
            className={`shrink-0 text-text-muted transition-opacity duration-150 ease-out hover:text-primary focus:opacity-100 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Pencil size={14} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-sm">
          <TermEditor term={term} onSave={onSaveEdit} onCancel={onCancelEdit} isSaving={isSaving} />
        </div>
      ) : (
        <>
          {term.value === null ? (
            <p className="mt-xs text-body italic text-text-muted">Not found</p>
          ) : (
            <p className="mt-xs whitespace-pre-wrap text-body text-text-secondary">{term.value}</p>
          )}

          {term.value !== null && (
            <div className="mt-sm flex flex-wrap items-center gap-md">
              {term.pageNumber !== null && (
                <button
                  type="button"
                  onClick={() => onPageClick(term.pageNumber as number)}
                  className="rounded-full bg-surface px-sm py-[2px] text-small font-medium text-text-secondary hover:bg-accent-light hover:text-primary"
                >
                  Page {term.pageNumber}
                </button>
              )}
              <ConfidenceBadge score={term.confidenceScore} />
            </div>
          )}

          {term.value !== null && (
            <div className="mt-xs">
              <SourceTooltip sourceSentence={term.sourceSentence} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
