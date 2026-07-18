# Spec: Contract Upload + Text Extraction (US-002, US-005)

**Source:** `docs/engineering/engineering-doc.md` §4 Flow 3, §6 Services, §9 API, §10 (US-002, US-005)
**Depends on:** `docs/specs/01-auth.md` (JWT/`requireUser`), `docs/specs/09-api-conventions.md` (error envelope, rate limiting), `docs/specs/supabase-schema.sql` (`contracts`, `custom_key_terms` tables + `contracts` storage bucket)

## Purpose

User uploads a PDF (NDA or MSA, ≤10 MB, ≤20 pages), optionally adds up to 5 custom terms, and the server extracts text with page markers and stores the contract record. This spec covers upload + storage only — AI extraction itself is `docs/specs/03-ai-extraction.md`.

## User Stories

- **US-002:** As a user, I want to upload a PDF contract and see the key terms extracted automatically so that I don't have to read the whole document line by line.
- **US-005:** As a user, I want to add a custom key term before processing so that I can get values for clauses specific to my situation.

## Constants

```typescript
// lib/constants/config.ts
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_PAGES = 20
export const MAX_CONTRACT_TOKENS = 15_000
export const MAX_CUSTOM_TERMS = 5
export const MAX_CUSTOM_TERM_LENGTH = 100
export const MIN_WORDS_FOR_TEXT_LAYER = 100 // below this, treat as scanned PDF
```

```typescript
// lib/constants/terms.ts
export const NDA_STANDARD_TERMS = [
  'Parties', 'Effective Date', 'Term Duration', 'Confidentiality Obligations',
  'Permitted Disclosures', 'Return/Destruction of Information', 'Governing Law',
  'Remedies for Breach',
]
export const MSA_STANDARD_TERMS = [
  'Parties', 'Effective Date', 'Term Duration', 'Payment Terms',
  'Liability Cap', 'Termination Clause', 'Auto-Renewal Clause',
  'Governing Law', 'IP Assignment', 'Non-Compete',
]
export const STANDARD_TERMS: Record<'nda' | 'msa', string[]> = {
  nda: NDA_STANDARD_TERMS,
  msa: MSA_STANDARD_TERMS,
}
```

## Files to create

```
app/(protected)/upload/page.tsx
components/upload/file-dropzone.tsx
components/upload/contract-type-selector.tsx
components/upload/custom-term-input.tsx
components/upload/upload-progress.tsx
app/api/contracts/upload/route.ts
lib/services/pdf.ts
lib/services/storage.ts
lib/services/contracts.ts
lib/utils/tokens.ts
lib/utils/validation.ts
lib/constants/config.ts
lib/constants/terms.ts
```

## User Flow

```
Click "Review Contract"  → Navigate to /upload         → —                         → Render upload page
Select contract type     → Store in local state         → —                         → Show NDA/MSA dropdown
Drag/drop or select PDF  → Validate file (size, type)    → —                         → If invalid, show error; else proceed
Add custom terms         → Append to custom terms list   → —                         → Show custom terms with "Custom" badge
(optional, up to 5)
Click "Upload"            → Show progress indicator       → POST /api/contracts/upload → INSERT into contracts
                            (Step 1: Uploading)             → pdf-parse extracts text     (status='uploaded')
                                                            → Store PDF in Supabase Storage
Upload complete           → Trigger process mutation      → (see docs/specs/03-ai-extraction.md)
```

## `lib/services/pdf.ts`

```typescript
export interface ExtractedPdf {
  text: string          // full text with `[PAGE N]` markers inserted before each page's content
  pageCount: number
  wordCount: number
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf>
```

Implementation notes:
- Use `pdf-parse` with a custom `pagerender` to prefix each page's text with `\n[PAGE ${pageNum}]\n`.
- `wordCount` = whitespace-split token count of the raw text, used to detect scanned PDFs (`wordCount < MIN_WORDS_FOR_TEXT_LAYER` ⇒ reject).

## `lib/utils/tokens.ts`

```typescript
export function countTokens(text: string): number
```

Use a simple approximation (`Math.ceil(text.length / 4)`) or `gpt-tokenizer` if added as a dependency — either is acceptable for MVP; document which one is used in the implementation.

## `lib/services/storage.ts`

```typescript
export async function uploadContractPdf(
  userId: string, contractId: string, filename: string, buffer: Buffer
): Promise<{ path: string | null; error: string | null }>

export async function getSignedContractUrl(
  filePath: string, expiresInSeconds?: number // default 3600
): Promise<string | null>
```

Path convention: `contracts/{user_id}/{contract_id}/{filename}.pdf` (matches the storage RLS policies in `supabase-schema.sql`, which key off the first path segment being the user's UUID).

## `lib/services/contracts.ts`

```typescript
export async function createContract(input: {
  userId: string; name: string; type: 'nda' | 'msa'; contractText: string; filePath: string | null
}): Promise<Contract>

export async function insertCustomTermPlaceholders(
  contractId: string, termNames: string[]
): Promise<void>

export async function updateContractStatus(
  contractId: string, status: 'uploaded' | 'processing' | 'processed' | 'error'
): Promise<void>
```

## API: `POST /api/contracts/upload`

**Auth:** required via `requireUser()` (`docs/specs/09-api-conventions.md`)

**Request:** `multipart/form-data`

```typescript
interface UploadRequest {
  file: File              // PDF, max 10 MB
  contractType: 'nda' | 'msa'
  customTerms?: string[]  // up to 5, each ≤100 chars, sent as repeated form fields or a JSON string
}
```

**Processing steps:**
1. `requireUser(request)` → `userId`. 401 if missing/invalid.
2. Validate `contractType` is `'nda' | 'msa'`. 400 otherwise.
3. Read `file`; reject if not `application/pdf` (400) or `size > MAX_FILE_SIZE_BYTES` (413).
4. `extractPdfText(buffer)`; reject if `pageCount > MAX_PAGES` (400) or `wordCount < MIN_WORDS_FOR_TEXT_LAYER` (422, "scanned PDF").
5. `countTokens(text)`; reject if `> MAX_CONTRACT_TOKENS` (400).
6. Validate `customTerms`: max 5 items, each 1–100 chars, no duplicates (400 otherwise).
7. `createContract(...)` with `status: 'uploaded'` → get `contract.id`.
8. `uploadContractPdf(userId, contract.id, file.name, buffer)`; if it fails, log and continue with `file_path = null` (do not fail the request — text viewer is the fallback, see `docs/specs/05-pdf-viewer.md`).
9. If `customTerms` provided, `insertCustomTermPlaceholders(contract.id, customTerms)`.
10. Return `201` with contract summary.

**Response (201):**

```typescript
interface UploadResponse {
  data: {
    id: string
    name: string
    type: 'nda' | 'msa'
    status: 'uploaded'
    pageCount: number
    tokenCount: number
    createdAt: string
  }
}
```

**Errors:**

| Code | Condition | Message |
|------|-----------|---------|
| 400 | Not a PDF | "Invalid file type. Only PDF files are accepted." |
| 413 | > 10 MB | "File exceeds 10 MB limit." |
| 400 | > 20 pages | "Contract exceeds 20 page limit." |
| 400 | > 15,000 tokens | "Contract exceeds 15,000 token limit." |
| 400 | > 5 custom terms | "Maximum 5 custom terms allowed." |
| 422 | < 100 words extracted | "Unable to extract text. Scanned PDFs are not supported." |

## Frontend state (`app/(protected)/upload/page.tsx`)

```typescript
interface UploadState {
  file: File | null
  contractType: 'nda' | 'msa' | null
  customTerms: string[]
  processingStep: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'error'
  error: string | null
}
```

TanStack Query mutations chain: `uploadMutation.onSuccess` → `processMutation.mutate(contractId)` (see `docs/specs/03-ai-extraction.md`) → `processMutation.onSuccess` → `router.push('/contracts/' + id)`.

## Component: `FileDropzone`

| Prop | Type |
|------|------|
| `onFileSelect` | `(file: File) => void` |
| `accept` | `string` (`"application/pdf"`) |
| `maxSize` | `number` |
| `disabled` | `boolean` |

States: `idle` → `dragging` → `validating` → `error` \| `success`.

## Component: `ContractTypeSelector`

| Prop | Type |
|------|------|
| `value` | `'nda' \| 'msa' \| null` |
| `onChange` | `(type: 'nda' \| 'msa') => void` |

## Component: `CustomTermInput`

| Prop | Type |
|------|------|
| `terms` | `string[]` |
| `onAdd` | `(term: string) => void` |
| `onRemove` | `(index: number) => void` |
| `maxTerms` | `number` (5) |
| `disabled` | `boolean` |

Validation: 1–100 chars, no duplicates (case-insensitive), max 5. Input clears after add. Shows "N of 5 custom terms used".

## Component: `UploadProgress`

| Prop | Type |
|------|------|
| `step` | `'uploading' \| 'extracting' \| 'analyzing'` |
| `progress` | `number` (0–100) |

Renders a 3-step indicator: Uploading → Extracting Text → Analyzing with AI.

## Edge cases

| Case | Handling |
|------|----------|
| File too large | Client-side reject before upload starts |
| Non-PDF file | Client-side reject via `accept` + type check |
| Too many pages / tokens | Server-side reject, surfaced as toast + retry option |
| Scanned PDF | Server-side reject with clear message, no retry (different file needed) |
| Storage upload fails | Continue with `file_path = null`; results page falls back to text viewer |
| Network error mid-upload | Surface error, offer "Try Again" (resets to `idle`) |
| Duplicate filename across contracts | Allowed — `file_path` is keyed by `contract_id`, not filename, so collisions are impossible |

## Acceptance Criteria

- [ ] **AC-1 (US-002):** A ≤10 MB, ≤20-page text-layer PDF uploads and reaches `status: 'uploaded'` with extracted text and correct `pageCount`/`tokenCount` in the response, within 30 seconds P95.
- [ ] **AC-2 (US-002):** A PDF over 10 MB is rejected client-side before any network request is made.
- [ ] **AC-3 (US-002):** A PDF over 20 pages is rejected server-side with the exact message "Contract exceeds 20 page limit."
- [ ] **AC-4 (US-002):** A scanned (image-only) PDF is rejected with 422 and the scanned-PDF message, never silently accepted with empty terms.
- [ ] **AC-5 (US-005):** Up to 5 custom terms can be added before upload; a 6th is rejected client-side by disabling the input.
- [ ] **AC-6 (US-005):** Each custom term is validated 1–100 characters and rejected as a duplicate (case-insensitive) if already present.
- [ ] **AC-7:** If Supabase Storage upload fails, the contract record is still created successfully with `file_path: null` — upload does not fail as a whole.
- [ ] **AC-8:** Extracted `contract_text` contains `[PAGE N]` markers at correct page boundaries, verifiable against the source PDF's page count.

## Manual test checklist

- [ ] Upload a valid text-layer PDF (NDA) → lands on results page with status `processed`
- [ ] Upload an 11 MB file → client-side rejected before network call
- [ ] Upload a 25-page PDF → server returns 400 with page-limit message
- [ ] Upload a scanned (image-only) PDF → 422 with scanned-PDF message
- [ ] Add 5 custom terms, try to add a 6th → input disabled
- [ ] Add duplicate custom term → inline error, not added
