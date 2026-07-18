'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ChatMessage } from '@/types/contracts'

interface ChatHistoryResponse {
  sessionId: string
  messages: ChatMessage[]
}

interface ChatSendResponse {
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}

async function fetchChatHistory(contractId: string): Promise<ChatHistoryResponse> {
  const res = await fetch(`/api/contracts/${contractId}/chat`)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Failed to load chat history.')
  }
  return json.data as ChatHistoryResponse
}

async function postChatMessage(contractId: string, content: string): Promise<ChatSendResponse> {
  const res = await fetch(`/api/contracts/${contractId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: content }),
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Failed to send message.')
  }
  return json.data as ChatSendResponse
}

export function useChat(contractId: string) {
  const queryClient = useQueryClient()
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)

  const {
    data,
    isLoading,
    error: historyError,
  } = useQuery({
    queryKey: ['chat', contractId],
    queryFn: () => fetchChatHistory(contractId),
  })

  const mutation = useMutation({
    mutationFn: (content: string) => postChatMessage(contractId, content),
    onMutate: async (content: string) => {
      setLastFailedMessage(null)
      await queryClient.cancelQueries({ queryKey: ['chat', contractId] })
      const previous = queryClient.getQueryData<ChatHistoryResponse>(['chat', contractId])
      const optimisticMessage: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content,
        pageCitation: null,
        source: null,
        createdAt: new Date().toISOString(),
      }
      if (previous) {
        queryClient.setQueryData<ChatHistoryResponse>(['chat', contractId], {
          ...previous,
          messages: [...previous.messages, optimisticMessage],
        })
      }
      return { previous }
    },
    onError: (_err: Error, content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['chat', contractId], context.previous)
      }
      setLastFailedMessage(content)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', contractId] })
    },
  })

  const sendMessage = useCallback(
    async (content: string) => {
      await mutation.mutateAsync(content)
    },
    [mutation]
  )

  const retry = useCallback(() => {
    if (lastFailedMessage) {
      mutation.mutate(lastFailedMessage)
    }
  }, [lastFailedMessage, mutation])

  return {
    messages: data?.messages ?? [],
    isLoading,
    isSending: mutation.isPending,
    error:
      (historyError as Error | null)?.message ?? (mutation.error as Error | null)?.message ?? null,
    sendMessage,
    retry,
  }
}
