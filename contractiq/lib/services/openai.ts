import OpenAI from 'openai'
import { ApiRouteError } from '@/lib/utils/errors'
import { buildExtractionPrompt } from '@/lib/prompts/extraction'
import { buildClassificationPrompt, type ChatContextType } from '@/lib/prompts/chat'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const REQUEST_TIMEOUT_MS = 20_000
const BACKOFF_MS = [1000, 2000, 4000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Shared retry policy (docs/specs/09-api-conventions.md): timeouts and 5xx
// back off 1s/2s/4s across 3 attempts; 429 waits the Retry-After header
// (default 2s). Non-retryable errors (4xx other than 429) are rethrown as-is
// for the caller to handle. Used by both extraction and chat OpenAI calls.
export async function withOpenAIRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      const isTimeout = err instanceof OpenAI.APIConnectionTimeoutError
      const isRateLimited = err instanceof OpenAI.APIError && err.status === 429
      const isServerError =
        err instanceof OpenAI.APIError && typeof err.status === 'number' && err.status >= 500

      if (!isTimeout && !isRateLimited && !isServerError) {
        throw err
      }

      const isLastAttempt = attempt === BACKOFF_MS.length - 1
      if (isLastAttempt) break

      const retryAfterHeader =
        isRateLimited && err instanceof OpenAI.APIError ? err.headers?.get('retry-after') : null
      const delayMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : BACKOFF_MS[attempt]
      await sleep(delayMs)
    }
  }

  if (lastError instanceof OpenAI.APIConnectionTimeoutError) {
    throw new ApiRouteError(504, 'OPENAI_TIMEOUT', 'AI processing timed out. Please try again.')
  }
  throw new ApiRouteError(
    500,
    'OPENAI_ERROR',
    'AI service temporarily unavailable. Try again in a few minutes.'
  )
}

export interface ExtractedTerm {
  term_name: string
  value: string
  page_number: number
  confidence_score: number
  source_sentence: string
}

function isValidExtractedTerm(value: unknown): value is ExtractedTerm {
  if (typeof value !== 'object' || value === null) return false
  const term = value as Record<string, unknown>
  return (
    typeof term.term_name === 'string' &&
    typeof term.value === 'string' &&
    typeof term.page_number === 'number' &&
    typeof term.confidence_score === 'number' &&
    term.confidence_score >= 0 &&
    term.confidence_score <= 1 &&
    typeof term.source_sentence === 'string'
  )
}

async function requestExtractionCompletion(system: string, user: string): Promise<string> {
  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create(
      {
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    )
  )

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new ApiRouteError(500, 'OPENAI_ERROR', 'AI service returned an empty response.')
  }
  return content
}

export async function extractKeyTerms(params: {
  contractType: 'nda' | 'msa'
  contractText: string
  standardTerms: string[]
  customTerms: string[]
}): Promise<ExtractedTerm[]> {
  const { system, user } = buildExtractionPrompt(params)

  let content = await requestExtractionCompletion(system, user)
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    // Single corrective retry per docs/specs/03-ai-extraction.md.
    content = await requestExtractionCompletion(
      system,
      `${user}\n\nReturn only valid JSON, no explanation.`
    )
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new ApiRouteError(
        500,
        'OPENAI_ERROR',
        'AI service temporarily unavailable. Try again in a few minutes.'
      )
    }
  }

  const terms = (parsed as { terms?: unknown[] })?.terms
  if (!Array.isArray(terms)) {
    return []
  }

  return terms.filter(isValidExtractedTerm)
}

function isChatContextType(value: unknown): value is ChatContextType {
  return value === 'contract' || value === 'history' || value === 'both'
}

// Cheap, low-latency call that routes a chat question to the contract text,
// the conversation history, or both, before the main answer call runs.
// Falls back to 'contract' (the prior always-on behavior) on any failure to
// parse, so a classification hiccup never blocks the user's question.
export async function classifyChatContext(params: { question: string }): Promise<ChatContextType> {
  const { system, user } = buildClassificationPrompt(params)

  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create(
      {
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 30,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    )
  )

  const content = completion.choices[0]?.message?.content
  if (!content) return 'contract'

  try {
    const parsed = JSON.parse(content) as { context?: unknown }
    if (isChatContextType(parsed.context)) {
      return parsed.context
    }
  } catch {
    // Fall through to the safe default below.
  }
  return 'contract'
}

export async function getChatCompletion(params: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<string> {
  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create(
      {
        model: 'gpt-4o',
        temperature: 0.4,
        max_tokens: 1000,
        messages: [{ role: 'system', content: params.system }, ...params.messages],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    )
  )

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new ApiRouteError(500, 'OPENAI_ERROR', 'AI service returned an empty response.')
  }
  return content
}
