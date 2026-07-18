# Spec: Shared API Conventions

**Source:** `docs/engineering/engineering-doc.md` §6 Backend Architecture (Error Handling, Middleware), §8 AI Architecture (Rate Limiting, Fallback & Error Handling)
**Applies to:** every route under `app/api/*` referenced by the other spec files.

## Purpose

Single source of truth for the response envelope, auth check, rate limiting, and error-code table so each feature spec doesn't repeat it. Implement this first — every other API route depends on `lib/utils/errors.ts` and the auth helper below.

## Files to create

```
lib/utils/errors.ts
lib/supabase/route-auth.ts
lib/services/rate-limit.ts
```

## Response envelope

```typescript
// Success
interface ApiSuccess<T> {
  data: T
  meta?: { pagination?: { page: number; limit: number; total: number } }
}

// Error
interface ApiError {
  error: {
    code: string        // e.g. "VALIDATION_ERROR", "OPENAI_ERROR", "NOT_FOUND"
    message: string      // human-readable, safe to show in UI
    details?: unknown    // e.g. field-level validation errors
  }
}
```

`lib/utils/errors.ts`:

```typescript
export class ApiRouteError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message)
  }
}

export function errorResponse(err: ApiRouteError): Response {
  return Response.json(
    { error: { code: err.code, message: err.message, details: err.details } },
    { status: err.status }
  )
}
```

Every route handler wraps its body in `try { ... } catch (err) { if (err instanceof ApiRouteError) return errorResponse(err); console.error(err); return errorResponse(new ApiRouteError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')) }`.

## Auth helper — `lib/supabase/route-auth.ts`

```typescript
export async function requireUser(request: Request): Promise<{ userId: string; supabase: SupabaseClient }>
```

Reads the Supabase session from cookies (via `lib/supabase/server.ts`, `docs/specs/01-auth.md`), throws `ApiRouteError(401, 'UNAUTHORIZED', 'Authentication required.')` if there's no valid session. All protected route handlers call this first.

## Standard error codes

| Code | Status | When |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Request body/query fails schema validation |
| `UNAUTHORIZED` | 401 | Missing/invalid session |
| `FORBIDDEN` | 403 | Authenticated but not permitted (rare — most ownership checks 404 instead, to avoid leaking existence) |
| `NOT_FOUND` | 404 | Resource missing or not owned by caller |
| `CONFLICT` | 409 | State conflict (e.g. reprocessing an already-processed contract) |
| `PAYLOAD_TOO_LARGE` | 413 | File exceeds size limit |
| `RATE_LIMITED` | 429 | Per-user rate limit exceeded |
| `OPENAI_TIMEOUT` | 504 | AI call timed out after retries |
| `OPENAI_ERROR` | 500 | AI call failed after retries (non-timeout) |
| `INTERNAL_ERROR` | 500 | Unhandled exception |

## Rate limiting — `lib/services/rate-limit.ts`

MVP approach: derive counts from existing tables rather than adding a dedicated rate-limit table:

```typescript
export async function checkExtractionLimit(userId: string): Promise<void>
// COUNT contracts WHERE user_id = $1 AND status = 'processed' AND created_at > now() - interval '24 hours'
// throws ApiRouteError(429, 'RATE_LIMITED', 'Daily extraction limit reached (20/day). Try again tomorrow.') if >= 20

export async function checkChatLimit(userId: string): Promise<void>
// COUNT chat_messages (joined through chat_sessions -> contracts) WHERE contracts.user_id = $1 AND chat_messages.role = 'user' AND chat_messages.created_at > now() - interval '24 hours'
// throws ApiRouteError(429, 'RATE_LIMITED', 'Daily chat limit reached (100/day). Try again tomorrow.') if >= 100
```

Called at the top of `POST /api/contracts/[id]/process` (`docs/specs/03-ai-extraction.md`) and `POST /api/contracts/[id]/chat` (`docs/specs/06-chat.md`) respectively.

| Limit | Value | Scope |
|-------|-------|-------|
| Extractions | 20 / user / day | MVP |
| Chat messages | 100 / user / day | MVP |
| Concurrent requests | 10 / user | Enforced implicitly by Vercel's function concurrency for MVP — no custom code needed |

## OpenAI retry policy (shared by extraction and chat)

| Trigger | Behavior |
|---------|----------|
| Invalid JSON (extraction only) | Retry once with corrective instruction appended to the prompt |
| Timeout (>20s) | Retry with exponential backoff: 1s, 2s, 4s (3 attempts total), then throw `OPENAI_TIMEOUT` |
| `429` | Wait per `Retry-After` header (default 2s if absent), retry, up to 3 attempts |
| `5xx` | Same backoff as timeout, then throw `OPENAI_ERROR` |

## Middleware layer (cross-reference)

Route protection (redirecting unauthenticated page requests) lives in `middleware.ts` per `docs/specs/01-auth.md` — that is separate from this spec's `requireUser()`, which guards individual API route handlers. Both must independently enforce auth: middleware protects page navigation, `requireUser()` protects direct API calls (e.g. from a script bypassing the UI).

## Acceptance Criteria

- [ ] **AC-1:** Every route under `app/api/*` (except none — all routes require auth per the engineering doc) returns `401 UNAUTHORIZED` with the standard error envelope when called with no session cookie.
- [ ] **AC-2:** Every success response across all API routes conforms to the `{ data, meta? }` envelope; every error response conforms to `{ error: { code, message, details? } }` — no route returns a bare object or array.
- [ ] **AC-3:** Accessing another user's resource (contract, term, chat session) by ID returns `404 NOT_FOUND`, never `403 FORBIDDEN` or a 200 with someone else's data.
- [ ] **AC-4:** Exceeding the daily extraction limit (20) or chat limit (100) returns `429 RATE_LIMITED` with the exact documented message, and does not consume additional OpenAI quota.
- [ ] **AC-5:** An OpenAI timeout after 3 retry attempts surfaces as `504 OPENAI_TIMEOUT`, not a hung request or a generic 500.
- [ ] **AC-6:** All error `message` values are safe, human-readable strings suitable for direct display in a toast — never a raw stack trace or internal error string.

## Manual test checklist

- [ ] Call any protected route with no session → 401 with `UNAUTHORIZED` code
- [ ] Call `GET /api/contracts/[id]` for another user's contract → 404, not 403 (no existence leak)
- [ ] Trigger 21 extractions in a day (or lower the limit temporarily in a test) → 21st returns 429
- [ ] Force a malformed JSON response from OpenAI in extraction → single retry succeeds or surfaces `OPENAI_ERROR`
