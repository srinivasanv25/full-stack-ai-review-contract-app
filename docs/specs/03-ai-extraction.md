# Spec: AI Key Term Extraction (US-003, US-004)

**Source:** `docs/engineering/engineering-doc.md` §8 AI Architecture, §9 API, §10 (US-003, US-004)
**Depends on:** `docs/specs/02-contract-upload.md` (contract must exist with `status: 'uploaded'`), `docs/specs/09-api-conventions.md` (retry policy, rate limiting), `docs/specs/supabase-schema.sql` (`key_terms`, `custom_key_terms`)

## Purpose

Given an uploaded contract's text and (optionally) custom term names, call GPT-4o to extract standard + custom key terms with page attribution and confidence scores, then persist them.

## User Stories

- **US-003:** As a user, I want to see which page each key term was found on so that I can verify the extraction myself.
- **US-004:** As a user, I want to see a confidence score for each extracted term so that I know which terms I should verify manually.

## Files to create

```
app/api/contracts/[id]/process/route.ts
lib/services/openai.ts
lib/prompts/extraction.ts
```

## Model configuration

| Parameter | Value |
|-----------|-------|
| Model | `gpt-4o` |
| Response format | `{ type: 'json_object' }` |
| Temperature | `0.1` |
| Max output tokens | `2000` |

## `lib/prompts/extraction.ts`

```typescript
export function buildExtractionPrompt(params: {
  contractType: 'nda' | 'msa'
  contractText: string
  standardTerms: string[]
  customTerms: string[]
}): { system: string; user: string }
```

System prompt template:

```
You are a contract analysis expert. Extract key terms from the provided {contractType} contract.

Return a JSON object of the form { "terms": [...] } where each element has:
- term_name: string (must exactly match one of the requested terms below)
- value: string (the extracted value, verbatim from the document)
- page_number: integer (1-indexed page where the term was found, read from [PAGE N] markers)
- confidence_score: float (0.0 to 1.0, your confidence in the extraction)
- source_sentence: string (the exact sentence containing this information)

Terms to extract:
{standardTerms + customTerms, one per line}

Rules:
1. Extract values exactly as written in the document.
2. If a term is not found in the document, omit it from the array entirely — do not guess.
3. Confidence < 0.5 means you are uncertain — always include source_sentence for verification.
4. Page numbers come from the nearest preceding [PAGE N] marker in the text.
5. Return ONLY the JSON object, no explanation or markdown fences.
```

User prompt: `Contract text:\n{contractText}`

## `lib/services/openai.ts`

```typescript
export interface ExtractedTerm {
  term_name: string
  value: string
  page_number: number
  confidence_score: number
  source_sentence: string
}

export async function extractKeyTerms(params: {
  contractType: 'nda' | 'msa'
  contractText: string
  standardTerms: string[]
  customTerms: string[]
}): Promise<ExtractedTerm[]>
```

Implementation notes:
- Call `openai.chat.completions.create` with the system/user prompt from `buildExtractionPrompt`, `response_format: { type: 'json_object' }`, `temperature: 0.1`, `max_tokens: 2000`.
- Parse `JSON.parse(response.choices[0].message.content)`. On parse failure, retry once with an appended corrective instruction: `"Return only valid JSON, no explanation."` If the retry also fails, throw a typed `OpenAIError('INVALID_JSON')`.
- Retry policy (timeouts, 429, 5xx) follows the shared policy in `docs/specs/09-api-conventions.md`.
- Validate each parsed term has all 5 required fields and `0 <= confidence_score <= 1`; drop any malformed entries rather than failing the whole batch.

## API: `POST /api/contracts/[id]/process`

**Auth:** required via `requireUser()`. Contract must belong to `userId` (404 otherwise, do not leak existence to other users).

**Request:** no body.

**Processing steps:**
1. `checkExtractionLimit(userId)` (`docs/specs/09-api-conventions.md`) — 429 if the daily cap is exceeded.
2. Fetch contract; 404 if not found or not owned by caller.
3. If `status === 'processing'` → 409 "Contract is already being processed."
4. If `status === 'processed'` → 409 "Contract has already been processed."
5. `updateContractStatus(id, 'processing')`.
6. Fetch `contract.contract_text`, the contract's `custom_key_terms` rows (term names inserted at upload time), and `STANDARD_TERMS[contract.type]`.
7. `extractKeyTerms(...)`.
8. Partition results: rows whose `term_name` matches a standard term → insert into `key_terms`; rows matching a custom term name → `UPDATE custom_key_terms SET value=, page_number=, confidence_score=, source_sentence= WHERE contract_id= AND term_name=`.
9. On success: `updateContractStatus(id, 'processed')`; return summary.
10. On any unrecoverable error (steps 6–8 throw after retries): `updateContractStatus(id, 'error')`; return the appropriate error response — never leave a contract stuck in `processing`.

**Response (200):**

```typescript
interface ProcessResponse {
  data: {
    contractId: string
    status: 'processed'
    termsExtracted: number
    processingTimeMs: number
  }
}
```

**Errors:**

| Code | Condition | Message |
|------|-----------|---------|
| 404 | Contract not found / not owned | "Contract not found." |
| 409 | `status === 'processing'` | "Contract is already being processed." |
| 409 | `status === 'processed'` | "Contract has already been processed." |
| 429 | Daily extraction limit reached | "Daily extraction limit reached (20/day). Try again tomorrow." |
| 504 | OpenAI timeout after retries | "AI processing timed out. Please try again." |
| 500 | Other OpenAI/API error after retries | "AI service temporarily unavailable. Try again in a few minutes." |

## Confidence score → UI mapping (consumed by results page, US-004)

| Score | Color | Behavior |
|-------|-------|----------|
| ≥ 0.80 | Green `#22c55e` | Normal display |
| 0.50 – 0.79 | Amber `#f59e0b` | Normal display |
| < 0.50 | Red `#ef4444` | ⚠️ icon + non-dismissible "verify in document" note |
| `null` | Gray | "N/A" badge — term was requested but not found |

## Rate limiting & cost control

| Limit | Value |
|-------|-------|
| Extractions | 20 per user per day |
| Concurrent requests | 10 per user |
| Cost per extraction | ≤ $0.20 (monitor via OpenAI dashboard) |

## Edge cases

| Case | Handling |
|------|----------|
| OpenAI returns a term not in the requested list | Drop it — only insert terms matching a known standard or custom term name |
| OpenAI omits a requested standard term | No row is inserted for it; UI shows "Not found" for that term (see `docs/specs/04-results-page.md`) |
| Contract text near 15k token limit | Already rejected at upload (see `docs/specs/02-contract-upload.md`); process route assumes text fits within the 128k context window |
| Process called twice concurrently | Second call sees `status: 'processing'` → 409 |
| Malformed page number (e.g. 0 or negative) from the model | Reject that single term (fails the `page_number > 0` DB check) rather than the whole batch — log and continue inserting the rest |

## Acceptance Criteria

- [ ] **AC-1 (US-003):** Every successfully extracted `key_terms` row has a `page_number` between 1 and the document's actual page count, traceable to a real `[PAGE N]` marker in `contract_text`.
- [ ] **AC-2 (US-004):** Every successfully extracted term has a `confidence_score` between 0.0 and 1.0 inclusive.
- [ ] **AC-3 (US-004):** Terms with `confidence_score < 0.5` are flagged for the UI (non-null `source_sentence` present so the ⚠️ warning can link to it).
- [ ] **AC-4:** Extraction completes and updates `status` to `processed` within 30 seconds P95 for a 20-page contract.
- [ ] **AC-5:** Key-term extraction F1 score ≥ 88% (NDA) / ≥ 85% (MSA) against a held-out labeled test set (tracked outside this codebase per the engineering doc's success criteria — flag if no test set exists yet).
- [ ] **AC-6:** A contract is never left in `status: 'processing'` after a request completes (success or failure) — verified by forcing an OpenAI error and checking `status` becomes `'error'`.
- [ ] **AC-7:** Calling process twice concurrently on the same contract results in exactly one successful extraction and one 409 response.

## Manual test checklist

- [ ] Process an uploaded NDA → `key_terms` rows appear with page numbers and confidence scores
- [ ] Process a contract with 2 custom terms → `custom_key_terms` rows are populated (not just placeholders)
- [ ] Call process twice back-to-back → second call returns 409
- [ ] Force an OpenAI error (bad API key) → contract `status` ends as `'error'`, not stuck on `'processing'`
- [ ] Exceed 20 extractions in a day (or temporarily lower the limit) → 21st call returns 429
