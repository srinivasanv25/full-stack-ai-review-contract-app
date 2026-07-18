'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { PDFViewer } from '@/components/results/pdf-viewer'
import { TextViewer } from '@/components/results/text-viewer'
import { KeyTermsPanel } from '@/components/results/key-terms-panel'
import { ChatInterface } from '@/components/chat/chat-interface'
import { FeedbackForm } from '@/components/feedback/feedback-form'
import { usePdfNavigation } from '@/hooks/use-pdf-navigation'
import { useToast } from '@/components/ui/toast'
import type { ContractDetail } from '@/types/contracts'

async function fetchContract(id: string): Promise<ContractDetail> {
  const res = await fetch(`/api/contracts/${id}`)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Failed to load contract.')
  }
  return json.data as ContractDetail
}

async function updateTerm(contractId: string, termId: string, value: string) {
  const res = await fetch(`/api/contracts/${contractId}/terms/${termId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Failed to update term.')
  }
  return json.data
}

async function submitFeedback(contractId: string, rating: 'up' | 'down', comment: string | null) {
  const res = await fetch(`/api/contracts/${contractId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment: comment ?? undefined }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Failed to submit feedback.')
  }
  return json.data
}

export default function ContractResultsPage() {
  const params = useParams<{ id: string }>()
  const contractId = params.id
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { targetPage, scrollToPage, onPageScrollComplete } = usePdfNavigation()
  const [useFallbackViewer, setUseFallbackViewer] = useState(false)
  const [savingTermId, setSavingTermId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'terms' | 'chat'>('terms')

  const {
    data: contract,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => fetchContract(contractId),
  })

  const updateTermMutation = useMutation({
    mutationFn: ({ termId, value }: { termId: string; value: string }) =>
      updateTerm(contractId, termId, value),
    onMutate: async ({ termId, value }) => {
      setSavingTermId(termId)
      await queryClient.cancelQueries({ queryKey: ['contract', contractId] })
      const previous = queryClient.getQueryData<ContractDetail>(['contract', contractId])
      if (previous) {
        queryClient.setQueryData<ContractDetail>(['contract', contractId], {
          ...previous,
          keyTerms: previous.keyTerms.map((term) =>
            term.id === termId ? { ...term, value, isEdited: true } : term
          ),
        })
      }
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['contract', contractId], context.previous)
      }
      showToast(err.message, 'error')
    },
    onSettled: () => {
      setSavingTermId(null)
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ rating, comment }: { rating: 'up' | 'down'; comment: string | null }) =>
      submitFeedback(contractId, rating, comment),
    onError: (err: Error) => {
      showToast(err.message, 'error')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Loading contract</span>
      </div>
    )
  }

  if (isError || !contract) {
    return (
      <div className="mx-auto max-w-lg px-md py-2xl text-center">
        <AlertTriangle className="mx-auto text-error" size={28} strokeWidth={1.5} aria-hidden />
        <p className="mt-sm text-body text-text-secondary">
          {(error as Error | null)?.message ?? 'Contract not found.'}
        </p>
      </div>
    )
  }

  const showStatusBanner = contract.status === 'error' || contract.status === 'processing'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-elevated-surface px-md py-md">
        <h1 className="text-h3 text-text-primary">{contract.name}</h1>
        <p className="text-small text-text-muted">
          {contract.type.toUpperCase()} &middot; Uploaded{' '}
          {new Date(contract.createdAt).toLocaleDateString()}
        </p>
      </header>

      {showStatusBanner && (
        <div
          role="status"
          className={`px-md py-sm text-center text-small font-medium ${
            contract.status === 'error' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
          }`}
        >
          {contract.status === 'error'
            ? 'This contract failed to process. Please try uploading it again.'
            : 'This contract is still being processed. Terms will appear here shortly.'}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-lg p-md lg:flex-row">
        <div className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-card border border-border bg-elevated-surface">
          {contract.fileUrl && !useFallbackViewer ? (
            <PDFViewer
              url={contract.fileUrl}
              targetPage={targetPage}
              onPageChange={onPageScrollComplete}
              onError={() => setUseFallbackViewer(true)}
            />
          ) : (
            <TextViewer
              text={contract.contractText}
              targetPage={targetPage}
              onPageChange={onPageScrollComplete}
            />
          )}
        </div>

        <div className="flex w-full flex-col overflow-hidden rounded-card border border-border bg-elevated-surface lg:w-panel lg:shrink-0">
          <div className="flex border-b border-border" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'terms'}
              onClick={() => setActiveTab('terms')}
              className={`flex-1 px-md py-sm text-small font-semibold ${
                activeTab === 'terms'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Key Terms
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
              className={`flex-1 px-md py-sm text-small font-semibold ${
                activeTab === 'chat'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Chat
            </button>
          </div>

          {activeTab === 'terms' ? (
            <div className="flex-1 overflow-y-auto p-md">
              <KeyTermsPanel
                keyTerms={contract.keyTerms}
                customKeyTerms={contract.customKeyTerms}
                onPageClick={scrollToPage}
                onTermUpdate={(termId, value) => updateTermMutation.mutate({ termId, value })}
                savingTermId={savingTermId}
              />
            </div>
          ) : (
            <ChatInterface
              contractId={contractId}
              onPageCitationClick={scrollToPage}
              disabled={contract.status !== 'processed'}
            />
          )}
        </div>
      </div>

      <div className="border-t border-border bg-elevated-surface p-lg">
        <FeedbackForm
          existingFeedback={contract.userFeedback}
          onSubmit={(feedback) => feedbackMutation.mutate(feedback)}
          isSubmitting={feedbackMutation.isPending}
        />
      </div>

      <p className="border-t border-border bg-background-subtle px-md py-sm text-center text-small text-text-muted">
        ContractIQ does not provide legal advice. Verify all extracted terms against the source
        document.
      </p>
    </div>
  )
}
