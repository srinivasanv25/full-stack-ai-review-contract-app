import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'
import { checkChatLimit } from '@/lib/services/rate-limit'
import { getOrCreateChatSession, getChatHistory, appendMessage, extractPageCitation } from '@/lib/services/chat'
import { getChatCompletion, classifyChatContext } from '@/lib/services/openai'
import { buildChatPrompt } from '@/lib/prompts/chat'
import { chatMessageSchema } from '@/lib/utils/validation'
import { sanitizeForLLM } from '@/lib/security/prompt-injection-guard'

// Ceiling on history fetched from the DB in one query: covers both the
// HISTORY case (up to 20 turns) and the CONTRACT/BOTH case (sliced to the
// last 10 below), without a second round trip once classification runs.
const MAX_HISTORY_FETCH = 20
const CONTRACT_HISTORY_TURNS = 10

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId, supabase } = await requireUser()

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Contract not found.')
    }

    const session = await getOrCreateChatSession(supabase, contract.id)
    const messages = await getChatHistory(supabase, session.id)

    return Response.json({ data: { sessionId: session.id, messages } })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId, supabase } = await requireUser()
    await checkChatLimit(supabase, userId)

    const body = await request.json().catch(() => null)
    const parsed = chatMessageSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiRouteError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Message is required.'
      )
    }
    const message = parsed.data.message.trim()
    if (message.length === 0) {
      throw new ApiRouteError(400, 'VALIDATION_ERROR', 'Message is required.')
    }

    const sanitizeResult = sanitizeForLLM(message)
    if (!sanitizeResult.safe) {
      throw new ApiRouteError(
        400,
        'PROMPT_INJECTION',
        'Message rejected: it looks like an attempt to override the assistant\'s instructions.'
      )
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, status, contract_text')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Contract not found.')
    }
    if (contract.status !== 'processed') {
      throw new ApiRouteError(409, 'CONFLICT', 'Contract must be processed before chatting.')
    }

    const session = await getOrCreateChatSession(supabase, contract.id)
    // Loaded before either message is inserted, so classification and the
    // history passed to the model both naturally exclude the new user
    // question — saving it first would make the classifier see it as part
    // of "history" and misroute every question.
    const fullHistory = await getChatHistory(supabase, session.id, MAX_HISTORY_FETCH)

    const contextType =
      fullHistory.length === 0
        ? 'contract'
        : await classifyChatContext({ question: message })

    const history =
      contextType === 'history'
        ? fullHistory
        : fullHistory.slice(-CONTRACT_HISTORY_TURNS)

    const { system, messages } = buildChatPrompt({
      contextType,
      contractText: contextType === 'history' ? '' : (contract.contract_text ?? ''),
      history: history.map((m) => ({ role: m.role, content: m.content })),
      question: message,
    })

    const responseText = await getChatCompletion({ system, messages })
    const pageCitation = extractPageCitation(responseText)

    const userMessage = await appendMessage(supabase, {
      sessionId: session.id,
      role: 'user',
      content: message,
      pageCitation: null,
    })
    const assistantMessage = await appendMessage(supabase, {
      sessionId: session.id,
      role: 'assistant',
      content: responseText,
      pageCitation,
      source: contextType,
    })

    return Response.json({
      data: {
        userMessage: {
          id: userMessage.id,
          role: 'user' as const,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: 'assistant' as const,
          content: assistantMessage.content,
          pageCitation: assistantMessage.pageCitation,
          source: assistantMessage.source,
          createdAt: assistantMessage.createdAt,
        },
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
