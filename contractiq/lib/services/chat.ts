import type { AppSupabaseClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/utils/errors'
import type { ChatMessage } from '@/types/contracts'

export async function getOrCreateChatSession(
  supabase: AppSupabaseClient,
  contractId: string
): Promise<{ id: string }> {
  const { data: existing, error: fetchError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contractId)
    .maybeSingle()

  if (fetchError) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to load chat session.')
  }
  if (existing) return { id: existing.id }

  const { data: created, error: createError } = await supabase
    .from('chat_sessions')
    .insert({ contract_id: contractId })
    .select('id')
    .single()

  if (createError || !created) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to create chat session.')
  }
  return { id: created.id }
}

// With no `limit`, returns full history in chronological order (for display).
// With a `limit`, returns the most recent `limit` messages, still in
// chronological order (for building bounded OpenAI context).
export async function getChatHistory(
  supabase: AppSupabaseClient,
  sessionId: string,
  limit?: number
): Promise<ChatMessage[]> {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: !limit })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to load chat history.')
  }

  const rows = limit ? (data ?? []).slice().reverse() : (data ?? [])

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    pageCitation: row.page_citation,
    source: row.source,
    createdAt: row.created_at,
  }))
}

export async function appendMessage(
  supabase: AppSupabaseClient,
  params: {
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    pageCitation: number | null
    source?: ChatMessage['source']
  }
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: params.sessionId,
      role: params.role,
      content: params.content,
      page_citation: params.pageCitation,
      source: params.source ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to save chat message.')
  }

  return {
    id: data.id,
    role: data.role,
    content: data.content,
    pageCitation: data.page_citation,
    source: data.source,
    createdAt: data.created_at,
  }
}

export function extractPageCitation(responseText: string): number | null {
  const match = responseText.match(/\[Page (\d+)\]/i)
  return match ? Number(match[1]) : null
}
