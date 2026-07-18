'use client'

import { useState } from 'react'
import type { ChatMessage as ChatMessageType, ChatContextType } from '@/types/contracts'

interface ChatMessageProps {
  message: ChatMessageType
  onPageClick: (page: number) => void
}

const SOURCE_LABEL: Record<ChatContextType, string> = {
  contract: 'From contract',
  history: 'From conversation',
  both: 'From contract + conversation',
}

export function ChatMessage({ message, onPageClick }: ChatMessageProps) {
  const [showTimestamp, setShowTimestamp] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-card px-md py-sm ${
          isUser ? 'bg-primary text-white' : 'bg-surface text-text-primary'
        }`}
        onMouseEnter={() => setShowTimestamp(true)}
        onMouseLeave={() => setShowTimestamp(false)}
      >
        {!isUser && message.source && (
          <p className="mb-xs text-small font-medium text-text-muted">{SOURCE_LABEL[message.source]}</p>
        )}

        <p className="whitespace-pre-wrap text-body">{message.content}</p>

        {message.pageCitation !== null && (
          <button
            type="button"
            onClick={() => onPageClick(message.pageCitation as number)}
            className={`mt-xs inline-flex rounded-full px-sm py-[2px] text-small font-medium ${
              isUser
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-accent-light text-primary hover:bg-accent'
            }`}
          >
            Page {message.pageCitation}
          </button>
        )}

        {showTimestamp && (
          <p className={`mt-xs text-small ${isUser ? 'text-white/70' : 'text-text-muted'}`}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
