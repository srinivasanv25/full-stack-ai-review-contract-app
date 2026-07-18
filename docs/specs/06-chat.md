# Spec: Chat with Contract (US-007, US-012)

**Source:** `docs/engineering/engineering-doc.md` §4 Flow 4, §8 AI Architecture, §9 API, §10 (US-007, US-012)
**Depends on:** `docs/specs/supabase-schema.sql` (`chat_sessions`, `chat_messages`), `docs/specs/04-results-page.md` (page citation → viewer navigation), `docs/specs/09-api-conventions.md` (retry policy, rate limiting)

## Purpose

Q&A tab on the results page, backed by a conversation memory layer. Before answering, every question is classified into one of three context types — CONTRACT, HISTORY, or BOTH — so the assistant answers from the contract text, the conversation itself, or both, instead of always forcing a contract-only prompt onto questions that are actually about the conversation. History persists per contract and reloads on revisit.

## User Stories

- **US-007:** As a user, I want to chat with my contract in plain English so that I can ask specific questions without searching manually.
- **US-012:** As a user, I want the chat history for each contract to persist so that I can revisit my questions later.

## Files to create

```
components/chat/chat-interface.tsx
components/chat/chat-message.tsx
components/chat/chat-input.tsx
hooks/use-chat.ts
app/api/contracts/[id]/chat/route.ts
lib/services/chat.ts
lib/prompts/chat.ts
```

## Model configuration

**Answer call**

| Parameter | Value |
|-----------|-------|
| Model | `gpt-4o` |
| Response format | plain text |
| Temperature | `0.4` |
| Max output tokens | `1000` |

**Classification call** (`classifyChatContext`, runs before the answer call, only when prior history exists)

| Parameter | Value |
|-----------|-------|
| Model | `gpt-4o` |
| Response format | `json_object` |
| Temperature | `0` |
| Max output tokens | `30` |
| Fallback on parse failure | `contract` (never blocks the answer call) |

## Conversation memory layer

Before generating a response, every question is classified and routed:

| Context type | When | Retrieval | System prompt |
|---|---|---|---|
| `contract` | Question is about the document content, or no prior history exists yet | Contract text + last 10 conversation turns | "Answer only from the contract. Cite [Page X]." |
| `history` | Question is about the conversation itself (e.g. "what did you just say about X?") | Conversation history only (no contract text), up to 20 turns | "Answer only from the conversation. End with [From conversation]." |
| `both` | Question references both the conversation and the document | Contract text + last 10 conversation turns | "Answer from both. Attribute each fact to its source." |

Each assistant message stores the resulting context type in `chat_messages.source`, and the UI renders it as an attribution label so the user knows where the answer came from.

**Ordering requirement:** the full conversation history must be loaded from the database *before* the new user message is saved. If the history were loaded after saving, the classifier would see the new question as part of its own history and misclassify the context. `POST /api/contracts/[id]/chat` loads history first, classifies, then inserts both the user and assistant messages.

## User Flow

```
Click "Chat" tab          → Show chat interface          → —                            → Load existing messages (if any)
                           → Fetch chat history            → GET /api/contracts/[id]/chat → Render message bubbles
Type question              → Store in input state          → —                            → Enable "Send" button
Click "Send"                → Add user message to UI        → POST /api/contracts/[id]/chat → Show loading indicator
                             (optimistic)
Response received           → Add assistant message to UI   → —                            → Render with page citation link
Click page citation          → Scroll viewer to page          → —                            → Highlight relevant section
```

## `lib/prompts/chat.ts`

```typescript
export type ChatContextType = 'contract' | 'history' | 'both'

export function buildClassificationPrompt(params: {
  question: string
}): { system: string; user: string }

export function buildChatPrompt(params: {
  contextType: ChatContextType
  contractText: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  question: string
}): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }
```

`buildChatPrompt` selects one of three system prompts by `contextType` (see [Conversation memory layer](#conversation-memory-layer) above); `contractText` is omitted from the prompt entirely when `contextType === 'history'`. `buildClassificationPrompt` builds the JSON-mode classification call consumed by `classifyChatContext` (`lib/services/openai.ts`).

`history` is passed as the `messages` array preceding the new user question, per OpenAI chat message conventions — up to the most recent 10 turns for `contract`/`both`, up to 20 for `history`.

## `lib/services/chat.ts`

```typescript
export async function getOrCreateChatSession(contractId: string): Promise<{ id: string }>

export async function getChatHistory(sessionId: string, limit?: number): Promise<ChatMessage[]>

export async function appendMessage(params: {
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  pageCitation: number | null
  source?: ChatContextType | null
}): Promise<ChatMessage>

export function extractPageCitation(responseText: string): number | null
```

`extractPageCitation` parses the first `[Page N]` occurrence via regex (`/\[Page (\d+)\]/i`) for storage in `page_citation`, independent of the raw text (which keeps the citation inline for display). `source` is stored on assistant messages only (the classified context type); user messages always store `source: null`.

## API: `GET /api/contracts/[id]/chat`

**Auth:** required, contract ownership enforced.

**Response (200):**

```typescript
{
  data: {
    sessionId: string
    messages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      pageCitation: number | null
      source: 'contract' | 'history' | 'both' | null
      createdAt: string
    }>
  }
}
```

If no session exists yet, `getOrCreateChatSession` creates one and `messages: []` is returned.

## API: `POST /api/contracts/[id]/chat`

**Auth:** required, contract ownership enforced. Contract must have `status: 'processed'` (409 otherwise).

**Request:**

```typescript
{ message: string } // 1–2000 chars
```

**Processing steps:**
1. `checkChatLimit(userId)` (`docs/specs/09-api-conventions.md`) — 429 if the daily cap is exceeded.
2. Validate `message` length (400 if empty or >2000 chars).
3. Confirm contract `status === 'processed'` (409 "Contract must be processed before chatting." otherwise).
4. `getOrCreateChatSession(contractId)`.
5. `getChatHistory(sessionId, 20)` — **loaded before the new user message is saved**, so it naturally excludes the new question. Loading history after saving would let the classifier see the new message as part of its own history and misclassify the context.
6. If history is non-empty, `classifyChatContext({ question: message })` → `contract | history | both` (skipped, defaulting to `contract`, when there's no history yet to classify against).
7. Slice history to the last 10 turns for `contract`/`both`, or keep all (up to 20) for `history`.
8. `buildChatPrompt({ contextType, contractText, history, question: message })` (contract text omitted when `contextType === 'history'`), call OpenAI (retry policy per `docs/specs/09-api-conventions.md`).
9. `extractPageCitation(responseText)`.
10. `appendMessage({ role: 'user', content: message, pageCitation: null })`.
11. `appendMessage({ role: 'assistant', content: responseText, pageCitation, source: contextType })`.
12. Return both messages.

**Response (200):**

```typescript
{
  data: {
    userMessage: { id: string; role: 'user'; content: string; createdAt: string }
    assistantMessage: {
      id: string
      role: 'assistant'
      content: string
      pageCitation: number | null
      source: 'contract' | 'history' | 'both'
      createdAt: string
    }
  }
}
```

**Errors:**

| Code | Condition | Message |
|------|-----------|---------|
| 400 | Missing/empty message | "Message is required." |
| 400 | >2000 chars | "Message exceeds 2000 character limit." |
| 409 | Contract not yet processed | "Contract must be processed before chatting." |
| 429 | Daily chat limit reached | "Daily chat limit reached (100/day). Try again tomorrow." |
| 504 | OpenAI timeout after retries | "AI response timed out. Please try again." |

## `hooks/use-chat.ts`

```typescript
interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean   // initial history fetch
  isSending: boolean   // awaiting assistant reply
  error: string | null
  sendMessage: (content: string) => Promise<void>
  retry: () => void
}

function useChat(contractId: string): UseChatReturn
```

Implementation: `useQuery(['chat', contractId], fetchChatHistory)` for history, `useMutation` for `sendMessage` with an optimistic append of the user message (rolled back on error, with `retry()` re-submitting the last failed message).

## Component: `ChatInterface`

| Prop | Type |
|------|------|
| `contractId` | `string` |
| `onPageCitationClick` | `(page: number) => void` (wired to `usePdfNavigation.scrollToPage`) |

Auto-scrolls to bottom on new message. Shows a typing/"thinking" indicator while `isSending`. Footer note: "Not legal advice."

## Component: `ChatMessage`

| Prop | Type |
|------|------|
| `message` | `ChatMessage` |
| `onPageClick` | `(page: number) => void` |

User messages right-aligned; assistant left-aligned. Assistant messages show a small attribution label above the content ("From contract" / "From conversation" / "From contract + conversation") from `message.source`. Page citation rendered as a clickable badge matching the key-terms page-badge styling (`docs/specs/04-results-page.md`). Timestamp shown on hover.

## Component: `ChatInput`

| Prop | Type |
|------|------|
| `onSend` | `(content: string) => void` |
| `disabled` | `boolean` |
| `isLoading` | `boolean` |

Auto-expanding textarea, character counter (max 2000), `Enter` to send / `Shift+Enter` for newline, disabled while `isLoading` or when contract isn't processed yet.

## Persistent history (US-012)

Chat history is automatically persisted by the flow above. On results-page load, `useChat` fetches `GET /api/contracts/[id]/chat` and renders the full prior conversation before the user sends anything new. Each new turn is classified and routed per [Conversation memory layer](#conversation-memory-layer) above, enabling follow-up questions, corrections, and progressive exploration across sessions — including questions about the conversation itself, not just the document.

## Edge cases

| Case | Handling |
|------|----------|
| Contract not processed | Chat tab shows disabled input with explanatory message |
| No answer in document | Model responds "I cannot find this in the document." — rendered normally, not an error state |
| No answer in conversation | Model states plainly that the conversation doesn't contain enough information — rendered normally, not an error state |
| API timeout | Optimistic user message stays visible, error toast + inline "Retry" affordance on that message |
| First message in a session | No history to classify against — defaults to `contract` without an extra classification call |
| Classification call fails or returns unparseable JSON | Falls back to `contract` (the prior always-on behavior) rather than blocking the answer |
| History > 20 turns fetched | Oldest turns beyond the fetch window excluded from the OpenAI prompt but remain visible/scrollable in the UI |
| Rapid repeated sends | `ChatInput` disabled while `isSending`, preventing concurrent requests |

## Acceptance Criteria

- [ ] **AC-1 (US-007):** Sending a question about content present in the document is classified `contract`, returns a response beginning with "Based on the document..." and containing a `[Page X]` citation, within 15 seconds P95.
- [ ] **AC-2 (US-007):** Sending a question about content NOT in the document returns "I cannot find this in the document." rather than a fabricated answer.
- [ ] **AC-3 (US-007):** Clicking a response's page citation scrolls the connected PDF/text viewer to that page.
- [ ] **AC-4 (US-012):** Reloading the results page after a conversation shows the full prior message history, in order, without re-querying OpenAI.
- [ ] **AC-5 (US-012):** A new message sent after reload includes prior conversation context (verifiable via a follow-up question like "what did you just say about X?", which is classified `history` and answered from the conversation, ending with `[From conversation]`, with no contract text sent to the model).
- [ ] **AC-6:** Attempting to chat on an unprocessed contract is blocked client-side (disabled input) and server-side (409 if bypassed).
- [ ] **AC-7:** Messages over 2000 characters are rejected before an OpenAI call is made.
- [ ] **AC-8:** A question that references both the document and something said earlier (e.g. "is what you said about the termination clause actually in the contract?") is classified `both` and the response attributes each fact to its source.
- [ ] **AC-9:** Every assistant message renders a source attribution label in the UI matching its stored `source`.

## Manual test checklist

- [ ] Open chat on a processed contract → empty state with input enabled
- [ ] Ask a question answerable from the doc → response includes `[Page X]`, badge is clickable and scrolls viewer, message labeled "From contract"
- [ ] Ask something not in the document → "I cannot find this in the document." response
- [ ] Ask a follow-up about the conversation itself (e.g. "what did you just ask... I mean what did I just ask you?") → response labeled "From conversation", ends with `[From conversation]`, no page citation
- [ ] Ask a question mixing both (e.g. "is what you said about payment terms actually on that page?") → response labeled "From contract + conversation", attributes facts to each source
- [ ] Reload the results page → prior conversation reloads from `chat_messages`, including each message's attribution label
- [ ] Open chat on an unprocessed contract → input disabled with message
