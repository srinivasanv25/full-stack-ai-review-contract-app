import type { AppSupabaseClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/utils/errors'

const DAILY_EXTRACTION_LIMIT = 20
const DAILY_CHAT_LIMIT = 100
const DAILY_UPLOAD_LIMIT = 20

function last24Hours(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function checkExtractionLimit(
  supabase: AppSupabaseClient,
  userId: string
): Promise<void> {
  const { count, error } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'processed')
    .gte('created_at', last24Hours())

  if (error) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to check extraction rate limit.')
  }

  if ((count ?? 0) >= DAILY_EXTRACTION_LIMIT) {
    throw new ApiRouteError(
      429,
      'RATE_LIMITED',
      'Daily extraction limit reached (20/day). Try again tomorrow.'
    )
  }
}

export async function checkUploadLimit(
  supabase: AppSupabaseClient,
  userId: string
): Promise<void> {
  const { count, error } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', last24Hours())

  if (error) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to check upload rate limit.')
  }

  if ((count ?? 0) >= DAILY_UPLOAD_LIMIT) {
    throw new ApiRouteError(
      429,
      'RATE_LIMITED',
      'Daily upload limit reached (20/day). Try again tomorrow.'
    )
  }
}

export async function checkChatLimit(
  supabase: AppSupabaseClient,
  userId: string
): Promise<void> {
  const { data: contracts, error: contractsError } = await supabase
    .from('contracts')
    .select('id')
    .eq('user_id', userId)

  if (contractsError) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to check chat rate limit.')
  }

  const contractIds = (contracts ?? []).map((c) => c.id)
  if (contractIds.length === 0) return

  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('id')
    .in('contract_id', contractIds)

  if (sessionsError) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to check chat rate limit.')
  }

  const sessionIds = (sessions ?? []).map((s) => s.id)
  if (sessionIds.length === 0) return

  const { count, error: countError } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .in('session_id', sessionIds)
    .eq('role', 'user')
    .gte('created_at', last24Hours())

  if (countError) {
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to check chat rate limit.')
  }

  if ((count ?? 0) >= DAILY_CHAT_LIMIT) {
    throw new ApiRouteError(
      429,
      'RATE_LIMITED',
      'Daily chat limit reached (100/day). Try again tomorrow.'
    )
  }
}
