'use client'

import { useState } from 'react'
import type { KeyTerm } from '@/types/contracts'
import { KeyTermRow } from './key-term-row'

interface KeyTermsPanelProps {
  keyTerms: KeyTerm[]
  customKeyTerms: KeyTerm[]
  onPageClick: (page: number) => void
  onTermUpdate: (termId: string, value: string) => void
  savingTermId?: string | null
}

export function KeyTermsPanel({
  keyTerms,
  customKeyTerms,
  onPageClick,
  onTermUpdate,
  savingTermId = null,
}: KeyTermsPanelProps) {
  const [editingTermId, setEditingTermId] = useState<string | null>(null)

  const handleSave = (termId: string, value: string) => {
    onTermUpdate(termId, value)
    setEditingTermId(null)
  }

  return (
    <div className="flex flex-col">
      <section>
        <h3 className="text-h4 text-text-primary">Key Terms</h3>
        {keyTerms.length === 0 ? (
          <p className="mt-sm text-body text-text-muted">No standard terms were extracted.</p>
        ) : (
          <div className="mt-sm">
            {keyTerms.map((term) => (
              <KeyTermRow
                key={term.id}
                term={term}
                onPageClick={onPageClick}
                isEditing={editingTermId === term.id}
                onStartEdit={setEditingTermId}
                onSaveEdit={(value) => handleSave(term.id, value)}
                onCancelEdit={() => setEditingTermId(null)}
                isSaving={savingTermId === term.id}
              />
            ))}
          </div>
        )}
      </section>

      {customKeyTerms.length > 0 && (
        <section className="mt-xl">
          <h3 className="text-h4 text-text-primary">Custom Terms</h3>
          <div className="mt-sm">
            {customKeyTerms.map((term) => (
              <KeyTermRow
                key={term.id}
                term={term}
                onPageClick={onPageClick}
                isEditing={false}
                onStartEdit={() => {}}
                onSaveEdit={() => {}}
                onCancelEdit={() => {}}
                isSaving={false}
                editable={false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
