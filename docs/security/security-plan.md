# ContractIQ — Security Plan

Audit of the `contractiq/` app (Stage 4-implemented features, pre-deploy) against `docs/engineering/engineering-doc.md`, `docs/specs/*.md`, and `skills/security-foundation/SKILL.md`. Every route under `app/api/*`, the DB schema/RLS in `contractiq/database.sql`, storage policies, auth flow, and the OpenAI integration were reviewed directly against the running code, not just the specs.

## Issues found and fixed

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 1 | Dependency | Next.js 14.2.5 is vulnerable to **CVE-2025-29927** (middleware authorization bypass via a crafted `x-middleware-subrequest` header) — critical, since `middleware.ts` is this app's page-level route guard. | Upgraded `next` and `eslint-config-next` to `14.2.35` (latest patched 14.x). Verified with `npm run build` and a live redirect check on `/dashboard`. |
| 2 | Authorization (IDOR defense-in-depth) | `GET /api/contracts/[id]`, `GET`+`POST /api/contracts/[id]/chat`, `POST /api/contracts/[id]/process`, `POST /api/contracts/[id]/feedback` fetched the parent contract by `id` alone, relying **entirely** on Postgres RLS to scope it to the caller. `PATCH /api/contracts/[id]/terms/[termId]` had no ownership check at all on the parent contract. RLS is correctly configured today, but this left zero defense-in-depth — a single policy regression (a future migration, a dropped policy, an admin-client typo) would become a full cross-tenant IDOR with no app-layer backstop. | Added explicit `.eq('user_id', userId)` (or an explicit contract-ownership lookup, for the term-update route) to every one of these queries, matching the pattern already used correctly in `GET /api/dashboard`. |
| 3 | Prompt injection | Chat (`POST /api/contracts/[id]/chat`) sent the user's typed message straight to OpenAI with no screening, and the system prompts inserted contract text (attacker-controlled — anyone can upload a PDF containing injection payloads) with no framing telling the model to treat it as inert data rather than instructions. | Added `lib/security/prompt-injection-guard.ts` (`sanitizeForLLM()`), called on every chat message before the OpenAI call — rejects with `400 PROMPT_INJECTION` on classic jailbreak phrasing (ignore-previous-instructions, reveal-system-prompt, roleplay/DAN-mode patterns, etc.) without ever reaching the model. Hardened all three chat system prompts (`lib/prompts/chat.ts`) and the extraction system prompt (`lib/prompts/extraction.ts`) to explicitly instruct the model that contract text / conversation history is data to analyze, never instructions, and that it must never reveal these instructions, API keys, or environment variables regardless of phrasing. Contract text is now also wrapped in `"""` delimiters to make the trust boundary explicit to the model. |
| 4 | File upload | Only the browser-supplied `file.type` was checked (trivially spoofed via a direct API call — the MIME check has no bearing on a raw `fetch`/`curl` upload), and the raw, attacker-controlled `file.name` was used verbatim to build the storage path (`{userId}/{contractId}/{filename}`). | Added `lib/security/input-validator.ts`: `hasValidPdfMagicBytes()` checks the actual `%PDF-` file header before parsing, and `sanitizeFilename()` strips path separators and restricts to a safe character set before the name is used in the storage path or as the stored contract name. |
| 5 | Rate limiting | Extraction (20/day) and chat (100/day) were rate-limited per `docs/specs/09-api-conventions.md`, but nothing limited raw upload volume — a caller could upload PDFs (parsing + storage cost) indefinitely without ever triggering extraction. | Added `checkUploadLimit()` to `lib/services/rate-limit.ts` (20 uploads/day, matching the security-foundation spec's table), called at the top of `POST /api/contracts/upload` before any parsing work. |
| 6 | Security headers | `next.config.mjs` had no `headers()` config at all — no CSP, clickjacking, MIME-sniffing, or referrer protection. | Added a `headers()` block applying `Content-Security-Policy` (scoped to `'self'` + the app's own Supabase project URL for `connect-src`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation off), and `Strict-Transport-Security`. Verified live via `curl -D-` against a production build. |

## Areas reviewed with no issues found

- **Row Level Security** (`contractiq/database.sql`): every table (`contracts`, `key_terms`, `custom_key_terms`, `chat_sessions`, `chat_messages`, `user_feedback`) has RLS enabled with policies correctly scoped to `auth.uid()`, either directly or via an `exists (...)` join back to `contracts.user_id`. Storage bucket policies correctly key off the first path segment matching `auth.uid()`. No changes needed — a `supabase/rls-policies.sql` was not generated as a separate file since this schema already is that paste-and-run, idempotent artifact.
- **Auth architecture**: uses `@supabase/ssr`'s `createBrowserClient()` client-side (per `docs/specs/01-auth.md`) with cookies synced through `middleware.ts`'s refresh — this is Supabase's own recommended App Router pattern and correctly keeps server components/route handlers in sync via `lib/supabase/server.ts`. `requireUser()` (`lib/supabase/route-auth.ts`) guards every API route server-side, independent of the client-side `AuthGuard` and `middleware.ts` checks — three independent layers as intended by `docs/specs/09-api-conventions.md`.
- **Environment variables**: `SUPABASE_SERVICE_ROLE_KEY` is present in `.env.local` but unused anywhere in the codebase (no admin/service-role client exists) — no accidental RLS bypass. No secret carries a `NEXT_PUBLIC_` prefix incorrectly. `.env.local` is gitignored.
- **Input validation**: every mutating route validates its body with Zod (`lib/utils/validation.ts`) before touching the database; error responses never leak stack traces (`lib/utils/errors.ts` logs server-side via `console.error` and returns a fixed safe message).
- **XSS**: no `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere in the app; all rendering goes through React's default escaping.
- **OpenAI retry/timeout handling** (`lib/services/openai.ts`): matches the documented backoff/timeout policy; never surfaces raw provider errors to the client.

## Outstanding items (not fixed — require a decision before acting)

| Item | Why it wasn't done automatically |
|---|---|
| `npm audit` still reports Next.js advisories (DoS via Image Optimizer, RSC cache-poisoning, WebSocket SSRF, i18n middleware bypass in Pages Router) that are only fully resolved on Next 15/16. | Fixing requires a major-version upgrade (14 → 15/16) with breaking changes to the App Router APIs used throughout this codebase. That's a separate migration project, not a same-day security patch — flagging for a deliberate, tested upgrade rather than bundling it here. None of the listed CVEs affect features this app actually uses (no `next/image` remote patterns, no Pages Router, no WebSocket upgrades), so exposure is low in the meantime. |
| Supabase email confirmation is OFF (per `docs/specs/01-auth.md`, an explicit MVP tradeoff: "OFF is fine for MVP to reduce friction; ON is more secure"). | This is a documented, already-approved product decision, not a bug — re-raising it here since "Stage 7" is a natural point to reconsider it before a real deploy, but not flipping it without your sign-off since it changes the signup UX. |
| CSP uses `'unsafe-inline'` for `script-src`/`style-src` rather than a nonce-based policy. | Next.js's default inline hydration bootstrap script needs one or the other; a nonce-based CSP requires wiring a per-request nonce through `middleware.ts` and every inline script/style, which is a larger change than a same-pass header addition. `'unsafe-inline'` is a meaningful baseline improvement over no CSP at all (still blocks *externally hosted* injected scripts), but isn't the strongest possible policy. |

## Files created

- `contractiq/lib/security/prompt-injection-guard.ts` — `sanitizeForLLM()`
- `contractiq/lib/security/input-validator.ts` — `hasValidPdfMagicBytes()`, `sanitizeFilename()`

## Files modified

- `contractiq/package.json` — `next`, `eslint-config-next` → `14.2.35`
- `contractiq/next.config.mjs` — added `headers()`
- `contractiq/app/api/contracts/[id]/route.ts`
- `contractiq/app/api/contracts/[id]/chat/route.ts`
- `contractiq/app/api/contracts/[id]/process/route.ts`
- `contractiq/app/api/contracts/[id]/feedback/route.ts`
- `contractiq/app/api/contracts/[id]/terms/[termId]/route.ts`
- `contractiq/app/api/contracts/upload/route.ts`
- `contractiq/lib/services/rate-limit.ts` — added `checkUploadLimit()`
- `contractiq/lib/utils/errors.ts` — added `PROMPT_INJECTION` error code
- `contractiq/lib/prompts/chat.ts` — hardened all three system prompts
- `contractiq/lib/prompts/extraction.ts` — hardened system prompt

## Verification performed

- `npm run build` — succeeds on Next.js 14.2.35
- `npx tsc --noEmit` — no type errors
- Live production server: confirmed all six security headers present on `GET /login`, and `GET /dashboard` while logged out still correctly 307s to `/login?redirectTo=%2Fdashboard` (middleware unaffected by the Next.js upgrade)

## No SQL to run

No schema or RLS changes were needed — `contractiq/database.sql` already covers every table correctly. Nothing new to paste into the Supabase SQL Editor.

## No new environment variables

All fixes use existing env vars (`NEXT_PUBLIC_SUPABASE_URL` for the CSP `connect-src`). Nothing new to add to `.env.local`.
