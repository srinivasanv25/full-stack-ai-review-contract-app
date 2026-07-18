# Spec: Inline PDF Viewer (US-006)

**Source:** `docs/engineering/engineering-doc.md` §5 Frontend Architecture, §10 (US-006)
**Depends on:** `docs/specs/04-results-page.md` (`fileUrl`/`contractText` from `GET /api/contracts/[id]`, `usePdfNavigation`)

## Purpose

Render the uploaded PDF inline on the results page using PDF.js against the signed Supabase Storage URL. If no file is available (`fileUrl === null`), fall back to a text viewer that parses `[PAGE N]` markers from `contractText`.

## User Story

As a user, I want to see a preview of the PDF within the app so that I don't have to switch between windows while reviewing.

## Files to create

```
components/results/pdf-viewer.tsx
components/results/text-viewer.tsx
hooks/use-pdf-viewer.ts
lib/utils/pdf.ts
```

## Dependency

`pdfjs-dist` is already in `contractiq/package.json` (added during Stage 3 scaffold). Worker must be configured, e.g.:

```typescript
import { pdfjs } from 'pdfjs-dist'
pdfjs.GlobalWorkerOptions.workerSrc = `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
```

## `hooks/use-pdf-viewer.ts`

```typescript
interface PDFViewerState {
  pdf: PDFDocumentProxy | null
  currentPage: number
  totalPages: number
  scale: number
  isLoading: boolean
  error: string | null
}

interface PDFViewerActions {
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

function usePdfViewer(url: string | null): [PDFViewerState, PDFViewerActions]
```

Loads the document via `pdfjs.getDocument(url).promise` when `url` changes. `scale` starts at a "fit width" calculation and is clamped between 0.5 and 2.0 by `zoomIn`/`zoomOut` (0.25 step). On load failure, sets `error` and leaves `pdf: null`.

## Component: `PDFViewer`

| Prop | Type |
|------|------|
| `url` | `string \| null` |
| `targetPage` | `number \| null` (from `usePdfNavigation`) |
| `onPageChange` | `(page: number) => void` |
| `onError` | `(error: string) => void` |

Behavior:
- Renders all pages in a scrollable container (lazy-render pages outside viewport using an `IntersectionObserver` for documents over ~10 pages).
- Toolbar: prev/next, "Page X of Y" input, zoom in/out/reset, download link (`<a href={url} download>`).
- When `targetPage` changes to a non-null value: smooth-scroll the container to that page's element, apply a brief highlight class (e.g. 1.5s yellow flash), then call `onPageScrollComplete()` (passed down or wired via the shared `usePdfNavigation` hook at the results-page level).
- Loading: skeleton placeholder matching page aspect ratio. Error: message + "Try again" (re-triggers the `getDocument` call) + note that the text view is available instead.

## `lib/utils/pdf.ts`

```typescript
export function parsePagesFromMarkedText(text: string): Array<{ page: number; content: string }>
```

Splits `contractText` on `[PAGE N]` markers (the same markers inserted server-side by `extractPdfText` in `docs/specs/02-contract-upload.md`) into an ordered array of `{ page, content }`.

## Component: `TextViewer`

| Prop | Type |
|------|------|
| `text` | `string` |
| `targetPage` | `number \| null` |
| `onPageChange` | `(page: number) => void` |

Uses `parsePagesFromMarkedText` to render each page as a labeled `<section id="page-N">`. Same prev/next/page-input toolbar as `PDFViewer` for a consistent UX. Scrolls to `#page-{targetPage}` when `targetPage` changes, with the same highlight-flash behavior.

## Selection logic (in the results page)

```tsx
{fileUrl ? (
  <PDFViewer url={fileUrl} targetPage={targetPage} onPageChange={setCurrentPage} onError={handlePdfError} />
) : (
  <TextViewer text={contractText} targetPage={targetPage} onPageChange={setCurrentPage} />
)}
```

If `PDFViewer` calls `onError`, fall back to rendering `TextViewer` for the rest of the session (store a local `useState<boolean>` "use fallback" flag) rather than retrying indefinitely.

## Design notes

- Viewer fills available vertical space in a two-column desktop layout; on mobile, stacks above the key terms panel (viewer first, since verifying the source is often the first action).
- Desktop breakpoint per `docs/design.md` responsive tokens.

## Edge cases

| Case | Handling |
|------|----------|
| `fileUrl` is `null` | Render `TextViewer` immediately, no PDF.js load attempt |
| Signed URL expired (rare within 1hr session) | `onError` fires → refetch `GET /api/contracts/[id]` to get a fresh signed URL, retry once automatically |
| PDF fails to render (corrupt/complex) | Show error + switch to `TextViewer`, offer download link |
| `targetPage` exceeds `totalPages` | Clamp to `totalPages`, log a console warning, no crash |
| Mobile viewport | Full-width viewer, toolbar wraps to two rows if needed |

## Acceptance Criteria

- [ ] **AC-1:** When `fileUrl` is present, the PDF renders via PDF.js within 3 seconds for a 20-page document on a standard broadband connection.
- [ ] **AC-2:** When `fileUrl` is `null`, `TextViewer` renders immediately with no failed network request to a PDF URL.
- [ ] **AC-3:** Clicking a key term's page badge (from `docs/specs/04-results-page.md`) scrolls the active viewer (PDF or text) to the correct page and applies a visible highlight.
- [ ] **AC-4:** Zoom in/out changes the rendered scale between 0.5x and 2.0x and never goes out of bounds.
- [ ] **AC-5:** A PDF render failure automatically falls back to `TextViewer` without requiring a page reload, and does not retry in an infinite loop.
- [ ] **AC-6:** Download link/button produces the original PDF file when `fileUrl` is present.

## Manual test checklist

- [ ] Open a processed contract with a stored PDF → PDF.js renders, page nav works
- [ ] Open a contract where storage upload failed (`file_path = null`) → text viewer renders instead
- [ ] Click a key term's page badge → viewer scrolls + highlights the right page in both PDF and text modes
- [ ] Zoom in/out in PDF viewer → pages resize, scroll position roughly preserved
- [ ] Simulate expired signed URL → viewer recovers by refetching
