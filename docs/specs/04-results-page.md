# Spec: Results Page — Key Terms Panel (US-003, US-004, US-009, US-011p)

**Source:** `docs/engineering/engineering-doc.md` §4 Flow 3, §10 (US-003, US-004, US-009, US-011p)
**Depends on:** `docs/specs/03-ai-extraction.md` (data source), `docs/specs/05-pdf-viewer.md` (page navigation target)

## Purpose

`/contracts/[id]` renders a two-panel layout: document viewer (left) + key terms panel (right). Each term shows its value, page number (clickable → scrolls viewer), and confidence score. Terms are inline-editable.

## User Stories

- **US-011p:** As a user, I want a key terms panel showing all extracted terms with their values, pages, and confidence.
- **US-003 / US-004:** see `docs/specs/03-ai-extraction.md` for extraction-side acceptance criteria; this spec covers their *display*.
- **US-009:** As a user, I want to edit an incorrectly extracted term so that the record is accurate.

## Files to create

```
app/(protected)/contracts/[id]/page.tsx
components/results/key-terms-panel.tsx
components/results/key-term-row.tsx
components/results/confidence-badge.tsx
components/results/source-tooltip.tsx
components/results/term-editor.tsx
hooks/use-pdf-navigation.ts
app/api/contracts/[id]/route.ts
app/api/contracts/[id]/terms/[termId]/route.ts
```

## User Flow

```
Processing complete       → Navigate to results page     → —                          → Load /contracts/[id]
Load results page         → Fetch contract + terms        → GET /api/contracts/[id]    → Render two-panel layout
                           → Render PDF/text viewer (left) → Get signed URL             → (see docs/specs/05-pdf-viewer.md)
                           → Render key terms panel        → —                          → Show term list with confidence colors
                             (right)
Click page number          → Scroll viewer to page         → —                          → Smooth scroll + highlight
Click term to edit          → Show inline edit input        → —                          → Pre-fill with current value
Save edited term            → PATCH term value               → PATCH /api/contracts/[id]/ → Show "Edited" badge
                                                                terms/[termId]
```

## API: `GET /api/contracts/[id]`

**Auth:** required, ownership enforced (404 if not owned).

**Response (200):**

```typescript
interface ContractDetailResponse {
  data: {
    id: string
    name: string
    type: 'nda' | 'msa'
    status: string
    fileUrl: string | null      // signed URL, 1hr expiry, from lib/services/storage.ts
    contractText: string        // for text-viewer fallback
    createdAt: string
    updatedAt: string
    keyTerms: Array<{
      id: string
      termName: string
      value: string | null
      pageNumber: number | null
      confidenceScore: number | null
      sourceSentence: string | null
      isEdited: boolean
    }>
    customKeyTerms: Array<{
      id: string
      termName: string
      value: string | null
      pageNumber: number | null
      confidenceScore: number | null
      sourceSentence: string | null
    }>
  }
}
```

Server logic: fetch contract row, 404 if missing/not owned; if `file_path` set, generate signed URL via `getSignedContractUrl`, else `fileUrl: null`; fetch `key_terms` and `custom_key_terms` ordered by `created_at asc`.

## API: `PATCH /api/contracts/[id]/terms/[termId]`

**Auth:** required. Term must belong to a contract owned by caller (join check, 404 otherwise).

**Request:**

```typescript
{ value: string } // required, max 2000 chars
```

**Processing:**
1. Fetch current term row.
2. If `is_edited === false`, set `original_value = <current value>` as part of the same update.
3. `UPDATE key_terms SET value = $1, is_edited = true, original_value = COALESCE(original_value, <current value>) WHERE id = $2`.
4. Return updated term.

**Response (200):**

```typescript
{
  data: {
    id: string
    termName: string
    value: string
    isEdited: true
    originalValue: string
    updatedAt: string
  }
}
```

Note: `key_terms` has no `updated_at` column per the schema — `updatedAt` in the response is `new Date().toISOString()` at write time, not a stored column.

## Component: `KeyTermsPanel`

| Prop | Type |
|------|------|
| `keyTerms` | `KeyTerm[]` |
| `customKeyTerms` | `KeyTerm[]` |
| `onPageClick` | `(page: number) => void` |
| `onTermUpdate` | `(termId: string, value: string) => void` |

Renders standard terms first, then a "Custom Terms" section labeled distinctly. Empty state per section if no terms extracted.

## Component: `KeyTermRow`

| Prop | Type |
|------|------|
| `term` | `KeyTerm` |
| `onPageClick` | `(page: number) => void` |
| `onEdit` | `(termId: string) => void` |

Renders: term name (bold) → value (or "Not found" in muted text if `value === null`) → page badge (clickable pill, hidden if `pageNumber === null`) → `ConfidenceBadge` → expandable source-sentence tooltip → edit icon (shown on hover) → "Edited" badge when `isEdited`.

## Component: `ConfidenceBadge`

| Prop | Type |
|------|------|
| `score` | `number \| null` |
| `showPercentage` | `boolean` |
| `size` | `'sm' \| 'md'` |

Thresholds: `≥0.80` green, `0.50–0.79` amber, `<0.50` red + ⚠️ + non-dismissible "Low confidence — verify in document" note, `null` → gray "N/A". Percentage rendered as integer (`Math.round(score * 100)`).

## Component: `TermEditor`

| Prop | Type |
|------|------|
| `term` | `KeyTerm` |
| `onSave` | `(value: string) => void` |
| `onCancel` | `() => void` |
| `isSaving` | `boolean` |

Textarea, auto-focused on open, max 2000 chars with live counter. Keyboard: `Escape` → cancel, `Cmd/Ctrl+Enter` → save. Save disabled if value unchanged. Uses optimistic update via TanStack Query mutation with rollback on error.

```typescript
const updateTermMutation = useMutation({
  mutationFn: ({ termId, value }: { termId: string; value: string }) =>
    updateTerm(contractId, termId, value),
  onMutate: async (vars) => {
    // optimistic cache update
  },
  onError: (_err, _vars, context) => {
    // rollback using context snapshot
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
  },
})
```

## `hooks/use-pdf-navigation.ts`

```typescript
function usePdfNavigation() {
  const [targetPage, setTargetPage] = useState<number | null>(null)
  const scrollToPage = (page: number) => setTargetPage(page)
  const onPageScrollComplete = () => setTargetPage(null)
  return { targetPage, scrollToPage, onPageScrollComplete }
}
```

Shared between `KeyTermsPanel` (writer) and the PDF/text viewer (reader) — see `docs/specs/05-pdf-viewer.md`.

## Edge cases

| Case | Handling |
|------|----------|
| `pageNumber` is `null` | No page badge shown; row still displays value/confidence |
| `confidenceScore` is `null` | Gray "N/A" badge, no warning |
| Term value is `null` (requested but not extracted) | Show "Not found" in muted italic, no confidence badge, no edit option |
| Save fails (network) | Roll back optimistic value, toast error, term remains editable |
| Rapid successive edits to same term | Mutations queued by TanStack Query's default serial execution per mutation key |
| Contract `status` is `'error'` or `'processing'` when results page loads | Show a status banner instead of an empty key terms panel; do not render "no terms found" as if extraction succeeded |

## Acceptance Criteria

- [ ] **AC-1:** All extracted terms (standard + custom) render on page load with correct value, page badge, and confidence color, matching the data returned by `GET /api/contracts/[id]`.
- [ ] **AC-2:** Clicking a page badge scrolls the connected viewer to that page (verified via `docs/specs/05-pdf-viewer.md`'s test checklist).
- [ ] **AC-3 (US-009):** Editing a term's value and saving persists the new value, sets `isEdited: true`, and preserves the original value in `original_value`, retrievable after a full page reload.
- [ ] **AC-4 (US-009):** Term edit saves complete in under 2 seconds P95 and show an "Edited" badge immediately on success.
- [ ] **AC-5:** A term the AI didn't find renders "Not found" rather than a blank row or a crash.
- [ ] **AC-6:** A failed save rolls back the optimistic UI update and leaves the term editable (not stuck in a saving state).

## Manual test checklist

- [ ] Load a processed contract → all extracted terms render with correct color-coded confidence
- [ ] Click a page badge → viewer scrolls to that page (see `docs/specs/05-pdf-viewer.md`)
- [ ] Edit a term, save → value updates, "Edited" badge appears, original preserved in tooltip
- [ ] Edit a term, then reload page → edit persisted
- [ ] A requested term the AI didn't find → shows "Not found", no crash
