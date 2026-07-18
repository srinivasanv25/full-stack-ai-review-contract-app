'use client'

import { useEffect, useRef } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useChat } from '@/hooks/use-chat'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'

interface ChatInterfaceProps {
  contractId: string
  onPageCitationClick: (page: number) => void
  disabled?: boolean
}

export function ChatInterface({ contractId, onPageCitationClick, disabled = false }: ChatInterfaceProps) {
  const { messages, isLoading, isSending, error, sendMessage, retry } = useChat(contractId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isSending])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} strokeWidth={1.5} aria-hidden />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-md">
        {messages.length === 0 ? (
          <p className="text-center text-body text-text-muted">
            Ask a question about this contract to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} onPageClick={onPageCitationClick} />
            ))}
          </div>
        )}

        {isSending && (
          <div className="mt-sm flex items-center gap-xs text-small text-text-muted">
            <Loader2 className="animate-spin" size={14} strokeWidth={1.75} aria-hidden />
            Thinking...
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-sm flex items-center justify-between gap-sm rounded-input bg-error/10 px-md py-sm text-small text-error"
          >
            <span className="flex items-center gap-xs">
              <AlertCircle size={14} strokeWidth={1.75} aria-hidden />
              {error}
            </span>
            <button type="button" onClick={retry} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={disabled} isLoading={isSending} />

      <p className="border-t border-border px-md py-xs text-center text-small text-text-muted">
        Not legal advice.
      </p>
    </div>
  )
}
