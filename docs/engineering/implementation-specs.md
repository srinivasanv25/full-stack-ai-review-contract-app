# ContractIQ — Implementation Specs

**Version:** 1.0
**Date:** July 2026
**Source:** `docs/engineering/engineering-doc.md`

---

## Overview

This document contains detailed implementation specifications for each user story. Each spec includes:

- User flow
- Database schema/tasks
- API routes
- State management
- Component specification
- Design notes
- Edge cases

---

## Table of Contents

1. [US-001: User Authentication](#us-001-user-authentication)
2. [US-002: PDF Upload + Text Extraction](#us-002-pdf-upload--text-extraction)
3. [US-003: Page Number Attribution](#us-003-page-number-attribution)
4. [US-004: Confidence Score Display](#us-004-confidence-score-display)
5. [US-005: Custom Key Term Addition](#us-005-custom-key-term-addition)
6. [US-006: Inline PDF Viewer](#us-006-inline-pdf-viewer)
7. [US-007: Chat with Contract](#us-007-chat-with-contract)
8. [US-008: Dashboard with Contract History](#us-008-dashboard-with-contract-history)
9. [US-009: Inline Key Term Editing](#us-009-inline-key-term-editing)
10. [US-010: Feedback Rating Submission](#us-010-feedback-rating-submission)
11. [US-011: Export Key Terms](#us-011-export-key-terms)
12. [US-012: Persistent Chat History](#us-012-persistent-chat-history)

---

## US-001: User Authentication

**Priority:** P0
**Story:** As a founder, I want to sign up with my email and password so that my contracts and chat history are saved privately.

### User Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Landing Page  │───▶│   Auth Modal    │───▶│    Dashboard    │
│                 │    │  (Login/Signup) │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         │                      ▼                      │
         │             ┌─────────────────┐             │
         └────────────▶│  Supabase Auth  │◀────────────┘
                       │    (Server)     │
                       └─────────────────┘
```

**Detailed Steps:**

1. User lands on `/` (landing page)
2. User clicks "Get Started Free" or "Sign In"
3. Navigate to `/signup` or `/login`
4. User enters email and password
5. Form validates input (client-side)
6. Submit to Supabase Auth
7. On success: store session, redirect to `/dashboard`
8. On error: display error message, allow retry

### Database Schema

Uses Supabase Auth built-in `auth.users` table. No custom tables required for basic auth.

### Database Tasks

1. Ensure Supabase project is configured with email/password auth enabled
2. Configure email verification (optional for MVP, recommended)
3. Set up auth redirect URLs in Supabase dashboard

### API Routes

No custom API routes — uses Supabase client directly.

**Supabase Auth Methods Used:**

| Method | Purpose |
|--------|---------|
| `supabase.auth.signUp()` | Create new user |
| `supabase.auth.signInWithPassword()` | Login existing user |
| `supabase.auth.signOut()` | Logout |
| `supabase.auth.getSession()` | Get current session |
| `supabase.auth.onAuthStateChange()` | Listen for auth changes |

### State Management

**Auth Context (`contexts/auth-context.tsx`):**

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

**Hook (`hooks/use-auth.ts`):**

```typescript
function useAuth(): AuthContextType;
```

### Component Specification

**AuthForm (`components/auth/auth-form.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `'login' \| 'signup'` | Form mode |
| `onSuccess` | `() => void` | Callback on successful auth |

**States:**
- `idle`: Form ready for input
- `submitting`: Request in progress
- `error`: Display error message
- `success`: Redirect in progress

**Validation Rules (Zod):**

```typescript
const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
```

**AuthGuard (`components/auth/auth-guard.tsx`):**

Wraps protected routes. Redirects to `/login` if not authenticated.

### Design Notes

- Use loading spinner on submit button during auth
- Show inline validation errors below fields
- Email field should have `type="email"` for mobile keyboard
- Password field should have show/hide toggle
- "Forgot password" link (can be placeholder for MVP)

### Edge Cases

| Case | Handling |
|------|----------|
| User already exists (signup) | Show error: "An account with this email already exists" |
| Invalid credentials (login) | Show error: "Invalid email or password" |
| Network error | Show error: "Connection failed. Please try again." |
| Weak password | Show inline validation error |
| Session expired | Redirect to login with message |

### Files to Create/Modify

```
app/(auth)/login/page.tsx
app/(auth)/signup/page.tsx
components/auth/auth-form.tsx
components/auth/auth-guard.tsx
contexts/auth-context.tsx
hooks/use-auth.ts
lib/supabase/client.ts
lib/supabase/server.ts
middleware.ts
```

---

## US-002: PDF Upload + Text Extraction

**Priority:** P0
**Story:** As a user, I want to upload a PDF contract and see the key terms extracted automatically so that I don't have to read the whole document line by line.

### User Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Dashboard │───▶│   Upload    │───▶│  Processing │───▶│   Results   │
│             │    │    Page     │    │    State    │    │    Page     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │                  │
                          ▼                  ▼
                   ┌─────────────┐    ┌─────────────┐
                   │  Validate   │    │   OpenAI    │
                   │    File     │    │  Extraction │
                   └─────────────┘    └─────────────┘
```

**Detailed Steps:**

1. User clicks "Review Contract" from dashboard
2. Navigate to `/upload`
3. User selects contract type (NDA or MSA) from dropdown
4. User drags/drops or file-picks a PDF
5. Client-side validation: file type, size
6. Show pre-processing preview with standard terms list
7. User optionally adds custom terms (see US-005)
8. User clicks "Process Contract"
9. Upload file to server
10. Server extracts text with page markers
11. Server stores contract record and optionally uploads to Storage
12. Server calls OpenAI for key term extraction
13. Server stores extracted terms
14. Navigate to results page `/contracts/[id]`

### Database Schema

**contracts table:**

```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('nda', 'msa')),
  contract_text TEXT,
  file_path VARCHAR(500),
  status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);

-- RLS Policies
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contracts" ON contracts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contracts" ON contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts" ON contracts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contracts" ON contracts
  FOR DELETE USING (auth.uid() = user_id);
```

**key_terms table:**

```sql
CREATE TABLE key_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  term_name VARCHAR(100) NOT NULL,
  value TEXT,
  page_number INT CHECK (page_number > 0),
  confidence_score DECIMAL(5,4) CHECK (confidence_score BETWEEN 0 AND 1),
  source_sentence TEXT,
  is_edited BOOLEAN DEFAULT FALSE,
  original_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_key_terms_contract_id ON key_terms(contract_id);
CREATE INDEX idx_key_terms_confidence ON key_terms(confidence_score);

-- RLS Policies
ALTER TABLE key_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own key_terms" ON key_terms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );
```

### Database Tasks

1. Run table creation SQL
2. Create RLS policies
3. Create Supabase Storage bucket `contracts`
4. Create Storage RLS policies

### API Routes

**POST `/api/contracts/upload`**

```typescript
// Request: multipart/form-data
interface UploadRequest {
  file: File;                    // PDF file
  contractType: 'nda' | 'msa';
  customTerms?: string[];        // Optional, max 5
}

// Response
interface UploadResponse {
  data: {
    id: string;
    name: string;
    type: 'nda' | 'msa';
    status: 'uploaded';
    pageCount: number;
    tokenCount: number;
    createdAt: string;
  }
}
```

**Processing Logic:**

1. Validate JWT from header
2. Validate file: type (PDF), size (≤10 MB)
3. Parse PDF with `pdf-parse`
4. Count pages (reject if >20)
5. Insert page markers `[PAGE N]` into text
6. Count tokens (reject if >15,000)
7. Check if extracted text <100 words → reject as scanned PDF
8. Insert contract record into DB
9. Optionally upload PDF to Supabase Storage
10. Store custom terms in `custom_key_terms` table
11. Return contract data

**POST `/api/contracts/[id]/process`**

```typescript
// Request: no body

// Response
interface ProcessResponse {
  data: {
    contractId: string;
    status: 'processed';
    termsExtracted: number;
    processingTimeMs: number;
  }
}
```

**Processing Logic:**

1. Validate JWT and contract ownership
2. Check contract status is 'uploaded'
3. Update status to 'processing'
4. Fetch contract text and custom terms
5. Build extraction prompt (see AI Architecture in engineering-doc.md)
6. Call OpenAI GPT-4o with JSON mode
7. Parse JSON response
8. Validate each term has required fields
9. Insert terms into `key_terms` table
10. Insert custom term results into `custom_key_terms` table
11. Update contract status to 'processed'
12. Return summary

### State Management

**Upload Page State:**

```typescript
interface UploadState {
  file: File | null;
  contractType: 'nda' | 'msa' | null;
  customTerms: string[];
  uploadProgress: number;           // 0-100
  processingStep: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'complete' | 'error';
  error: string | null;
}
```

**TanStack Query:**

```typescript
// Upload mutation
const uploadMutation = useMutation({
  mutationFn: uploadContract,
  onSuccess: (data) => {
    processMutation.mutate(data.id);
  },
});

// Process mutation
const processMutation = useMutation({
  mutationFn: processContract,
  onSuccess: (data) => {
    router.push(`/contracts/${data.contractId}`);
  },
});
```

### Component Specification

**FileDropzone (`components/upload/file-dropzone.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `onFileSelect` | `(file: File) => void` | Callback when file selected |
| `accept` | `string` | MIME types to accept |
| `maxSize` | `number` | Max file size in bytes |
| `disabled` | `boolean` | Disable interaction |

**States:**
- `idle`: Waiting for file
- `dragging`: File being dragged over
- `validating`: Checking file
- `error`: Invalid file
- `success`: File accepted

**ContractTypeSelector (`components/upload/contract-type-selector.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `value` | `'nda' \| 'msa' \| null` | Selected type |
| `onChange` | `(type: 'nda' \| 'msa') => void` | Change callback |

**UploadProgress (`components/upload/upload-progress.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `step` | `string` | Current step |
| `progress` | `number` | 0-100 percentage |

Displays 3-step progress: Uploading → Extracting Text → Analyzing with AI

### Design Notes

- Drag-and-drop zone should have clear visual feedback
- Show file info (name, size) after selection
- Progress indicator should show current step label
- Display estimated time remaining if possible
- Error states should offer "Try Again" button

### Edge Cases

| Case | Handling |
|------|----------|
| File too large (>10 MB) | Client-side reject: "File exceeds 10 MB limit" |
| Too many pages (>20) | Server-side reject: "Contract exceeds 20 page limit" |
| Too many tokens (>15k) | Server-side reject: "Contract is too long. Maximum 15,000 tokens." |
| Scanned PDF (<100 words) | Server-side reject: "Scanned PDFs are not supported yet" |
| Non-PDF file | Client-side reject: "Only PDF files are accepted" |
| Storage upload fails | Continue without file_path; PDF viewer will fall back to text viewer |
| OpenAI timeout | Retry 3x with exponential backoff; surface error if all fail |
| Invalid JSON from OpenAI | Single retry with corrective prompt |
| Network error mid-upload | Surface error with retry option |

### Files to Create/Modify

```
app/(protected)/upload/page.tsx
components/upload/file-dropzone.tsx
components/upload/contract-type-selector.tsx
components/upload/upload-progress.tsx
app/api/contracts/upload/route.ts
app/api/contracts/[id]/process/route.ts
lib/services/pdf.ts
lib/services/openai.ts
lib/services/storage.ts
lib/services/contracts.ts
lib/prompts/extraction.ts
lib/constants/terms.ts
lib/utils/tokens.ts
lib/utils/validation.ts
```

---

## US-003: Page Number Attribution

**Priority:** P0
**Story:** As a user, I want to see which page each key term was found on so that I can verify the extraction myself.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Results Page                        │
│  ┌───────────────────┐  ┌───────────────────────────┐  │
│  │                   │  │  Key Terms Panel          │  │
│  │                   │  │  ┌─────────────────────┐  │  │
│  │   PDF Viewer      │  │  │ Governing Law       │  │  │
│  │                   │  │  │ State of Delaware   │  │  │
│  │                   │  │  │ [Page 3] ← clickable│  │  │
│  │   Page 3 ─────────│◀─│  └─────────────────────┘  │  │
│  │                   │  │                           │  │
│  └───────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Detailed Steps:**

1. Results page loads with contract data
2. Key terms panel displays each term with page number
3. Page number is styled as a clickable link/button
4. User clicks page number
5. PDF viewer (or text viewer) scrolls to that page
6. Page is highlighted briefly to draw attention

### Database Schema

Page number is stored in `key_terms.page_number` (INT, 1-indexed).

### Database Tasks

Already covered in US-002.

### API Routes

Page number is returned in the GET `/api/contracts/[id]` response as part of each term object.

### State Management

**PDF Viewer State:**

```typescript
interface PDFViewerState {
  currentPage: number;
  totalPages: number;
  scale: number;
  targetPage: number | null;  // Set when user clicks page link
}
```

**Cross-component communication:**

```typescript
// Hook to coordinate term panel → PDF viewer
function usePDFNavigation() {
  const [targetPage, setTargetPage] = useState<number | null>(null);

  const scrollToPage = (page: number) => {
    setTargetPage(page);
  };

  const onPageScrollComplete = () => {
    setTargetPage(null);
  };

  return { targetPage, scrollToPage, onPageScrollComplete };
}
```

### Component Specification

**KeyTermRow (`components/results/key-term-row.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `term` | `KeyTerm` | Term data object |
| `onPageClick` | `(page: number) => void` | Page click handler |
| `onEdit` | `(termId: string) => void` | Edit click handler |

**Renders:**
- Term name (bold)
- Extracted value
- Page number badge (clickable)
- Confidence badge
- Expand button for source sentence

**Page Badge Styling:**
- Small pill/badge with page number
- Cursor pointer
- Hover state (darker background)
- Icon: page or document icon

### Design Notes

- Page numbers should be visually distinct from regular text
- Use consistent badge styling across the app
- Clicking should trigger smooth scroll animation
- Highlight the page briefly (e.g., yellow flash) after scrolling
- If page not found in viewer, show error toast

### Edge Cases

| Case | Handling |
|------|----------|
| Page number null (term not found in doc) | Don't show page badge, show "Not found" text |
| Page number out of range | Log error, don't scroll, show toast |
| PDF viewer not loaded | Queue scroll action, execute when loaded |
| Text viewer fallback | Scroll to `[PAGE N]` marker in text |

### Files to Create/Modify

```
components/results/key-term-row.tsx
components/results/key-terms-panel.tsx
components/results/pdf-viewer.tsx
components/results/text-viewer.tsx
hooks/use-pdf-navigation.ts
```

---

## US-004: Confidence Score Display

**Priority:** P0
**Story:** As a user, I want to see a confidence score for each extracted term so that I know which terms I should verify manually.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Key Terms Panel                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Governing Law            [Page 3]  ████████ 92%   │ │  ← Green (high)
│  │ State of Delaware                                  │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ Liability Cap            [Page 5]  █████░░░ 65%   │ │  ← Amber (medium)
│  │ $1,000,000                                         │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ⚠️ Non-Compete           [Page 7]  ███░░░░░ 38%   │ │  ← Red + warning
│  │ 24 months, 50 mile radius                          │ │
│  │ ┌─────────────────────────────────────────────┐   │ │
│  │ │ ⚠️ Low confidence — verify in document      │   │ │
│  │ └─────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

Confidence score is stored in `key_terms.confidence_score` (DECIMAL(5,4), 0.0-1.0).

### Database Tasks

Already covered in US-002.

### API Routes

Confidence score is returned in GET `/api/contracts/[id]` as `confidenceScore` (float 0-1).

### State Management

No additional state needed — confidence is read-only data.

### Component Specification

**ConfidenceBadge (`components/results/confidence-badge.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `score` | `number` | 0-1 confidence value |
| `showPercentage` | `boolean` | Show % number |
| `size` | `'sm' \| 'md'` | Badge size |

**Color Thresholds:**

| Score | Color | Visual |
|-------|-------|--------|
| ≥ 0.80 | Green (`#22c55e`) | Solid fill |
| 0.50 – 0.79 | Amber (`#f59e0b`) | Solid fill |
| < 0.50 | Red (`#ef4444`) | Solid fill + ⚠️ icon |

**Low Confidence Warning:**

When score < 0.50, show a non-dismissible tooltip/banner:

```
⚠️ Low confidence — we recommend verifying this in the document directly.
```

### Design Notes

- Use a progress bar or filled segments to visualize confidence
- Percentage should be displayed as integer (e.g., 92%, not 91.7%)
- Warning icon should be clearly visible for low scores
- Consider color-blind friendly alternatives (patterns, icons)
- Tooltip on hover explaining what confidence means

### Edge Cases

| Case | Handling |
|------|----------|
| Confidence is null | Display "N/A" with gray badge |
| Confidence is exactly 0 | Show 0% with red + warning |
| Confidence is exactly 1 | Show 100% with green |
| Calibration warning (system-level) | Banner at top of panel (future) |

### Files to Create/Modify

```
components/results/confidence-badge.tsx
components/results/key-term-row.tsx
components/ui/tooltip.tsx
```

---

## US-005: Custom Key Term Addition

**Priority:** P0
**Story:** As a user, I want to add a custom key term before processing so that I can get values for clauses specific to my situation.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Upload Page - Pre-processing Preview                   │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Standard Terms to Extract:                         │ │
│  │ ☑ Parties                                          │ │
│  │ ☑ Effective Date                                   │ │
│  │ ☑ Confidentiality Obligations                      │ │
│  │ ... (based on NDA/MSA type)                        │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ Custom Terms:                                      │ │
│  │ ┌─────────────────────────┐                       │ │
│  │ │ Non-compete radius      │ [Custom] ✕            │ │
│  │ └─────────────────────────┘                       │ │
│  │ ┌─────────────────────────────────────┐           │ │
│  │ │ + Add Key Term                      │           │ │
│  │ └─────────────────────────────────────┘           │ │
│  │ (Maximum 5 custom terms)                          │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Process Contract]                                     │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
CREATE TABLE custom_key_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  term_name VARCHAR(100) NOT NULL,
  value TEXT,
  page_number INT CHECK (page_number > 0),
  confidence_score DECIMAL(5,4) CHECK (confidence_score BETWEEN 0 AND 1),
  source_sentence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_key_terms_contract_id ON custom_key_terms(contract_id);

-- RLS Policies
ALTER TABLE custom_key_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own custom_key_terms" ON custom_key_terms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = custom_key_terms.contract_id
      AND contracts.user_id = auth.uid()
    )
  );
```

### Database Tasks

Run table creation SQL and RLS policies.

### API Routes

Custom terms are passed in the upload request:

```typescript
// POST /api/contracts/upload
{
  file: File;
  contractType: 'nda' | 'msa';
  customTerms?: string[];  // Term names to extract
}
```

Custom terms are stored during upload and included in the extraction prompt during processing.

### State Management

**Upload Page State (extended):**

```typescript
interface UploadState {
  // ... existing fields
  customTerms: string[];           // Max 5
  customTermInput: string;         // Current input value
  customTermError: string | null;  // Validation error
}
```

### Component Specification

**CustomTermInput (`components/upload/custom-term-input.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `terms` | `string[]` | Current custom terms |
| `onAdd` | `(term: string) => void` | Add term callback |
| `onRemove` | `(index: number) => void` | Remove term callback |
| `maxTerms` | `number` | Maximum allowed (5) |
| `disabled` | `boolean` | Disable input |

**States:**
- Input field for term name
- List of added terms with "Custom" badge and remove button
- Disabled add button when at max
- Character counter (max 100 chars per term)

**Validation:**
- Term name: 1-100 characters
- No duplicates
- Max 5 terms

### Design Notes

- Clear "Custom" badge to distinguish from standard terms
- Remove button (✕) on each custom term
- Disabled state when 5 terms reached
- Show remaining count: "2 of 5 custom terms used"
- Input should clear after adding

### Edge Cases

| Case | Handling |
|------|----------|
| Duplicate term name | Show error: "Term already added" |
| Empty term name | Disable add button |
| Term too long (>100 chars) | Show character count, disable add |
| Max terms reached | Disable input, show message |
| Remove all custom terms | Allow, show empty state |

### Files to Create/Modify

```
components/upload/custom-term-input.tsx
app/api/contracts/upload/route.ts (update)
app/api/contracts/[id]/process/route.ts (update)
lib/prompts/extraction.ts (update to include custom terms)
```

---

## US-006: Inline PDF Viewer

**Priority:** P1
**Story:** As a user, I want to see a preview of the PDF within the app so that I don't have to switch between windows while reviewing.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Results Page                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ← Prev | Page 3 of 12 | Next → | 🔍 - + | ⬇️ Download│ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                     │ │
│  │                                                     │ │
│  │             [PDF Page Content]                      │ │
│  │                                                     │ │
│  │                                                     │ │
│  │                                                     │ │
│  │                                                     │ │
│  │   ══════════════════════════════════════════════   │ │
│  │                                                     │ │
│  │             [Next Page Content]                     │ │
│  │                                                     │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Implementation Strategy

**Primary:** PDF.js viewer using signed URL from Supabase Storage
**Fallback:** Text viewer parsing `[PAGE N]` markers from `contract_text`

### API Routes

**Signed URL Generation:**

In GET `/api/contracts/[id]`:

```typescript
// Generate 1-hour signed URL for PDF
const { data: signedUrl } = await supabase.storage
  .from('contracts')
  .createSignedUrl(contract.file_path, 3600);

// Return in response
{
  data: {
    // ... other fields
    fileUrl: signedUrl || null,  // null if Storage failed
    contractText: contract.contract_text,  // Always included for fallback
  }
}
```

### State Management

**PDF Viewer Hook (`hooks/use-pdf-viewer.ts`):**

```typescript
interface PDFViewerState {
  pdf: PDFDocumentProxy | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  isLoading: boolean;
  error: string | null;
}

interface PDFViewerActions {
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

function usePDFViewer(url: string | null): [PDFViewerState, PDFViewerActions];
```

### Component Specification

**PDFViewer (`components/results/pdf-viewer.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `url` | `string \| null` | Signed PDF URL |
| `targetPage` | `number \| null` | Page to scroll to |
| `onPageChange` | `(page: number) => void` | Current page callback |
| `onError` | `(error: string) => void` | Error callback |

**Features:**
- Scrollable container with all pages rendered
- Page navigation controls (prev/next, page input)
- Zoom controls (fit width, fit page, 50%-200%)
- Download button
- Lazy loading of pages for performance

**TextViewer (`components/results/text-viewer.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Contract text with [PAGE N] markers |
| `targetPage` | `number \| null` | Page to scroll to |
| `onPageChange` | `(page: number) => void` | Current page callback |

**Features:**
- Parse text into pages using `[PAGE N]` markers
- Display each page as a labelled section
- Scroll to page when targetPage changes
- Same navigation controls as PDF viewer

### Design Notes

- PDF viewer should fill available vertical space
- Smooth scroll animation when navigating pages
- Loading skeleton while PDF loads
- Clear error state with retry button
- Mobile: full-width, scrollable
- Desktop: side-by-side with key terms panel

### Edge Cases

| Case | Handling |
|------|----------|
| file_path is null | Use text viewer fallback |
| Signed URL expired | Refetch URL on error |
| PDF fails to load | Show error, offer text viewer |
| Large PDF (>10 pages) | Lazy load pages |
| Complex PDF formatting | May not render perfectly, show download link |
| Mobile viewport | Stack layout (viewer on top, terms below) |

### Files to Create/Modify

```
components/results/pdf-viewer.tsx
components/results/text-viewer.tsx
hooks/use-pdf-viewer.ts
lib/utils/pdf.ts (client-side helpers)
```

---

## US-007: Chat with Contract

**Priority:** P1
**Story:** As a user, I want to chat with my contract in plain English so that I can ask specific questions without searching manually.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Results Page - Chat Tab                                │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │ 👤 What happens if I breach the NDA?         │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │ 🤖 Based on the document, if you breach the  │  │ │
│  │  │    confidentiality obligations, the          │  │ │
│  │  │    disclosing party may seek injunctive      │  │ │
│  │  │    relief and monetary damages. [Page 5]     │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ┌───────────────────────────────────────┐ [Send]  │ │
│  │ │ Ask a question about this contract... │         │ │
│  │ └───────────────────────────────────────┘         │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_contract_id ON chat_sessions(contract_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  page_citation INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- RLS Policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own chat_sessions" ON chat_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = chat_sessions.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access own chat_messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      JOIN contracts ON contracts.id = chat_sessions.contract_id
      WHERE chat_sessions.id = chat_messages.session_id
      AND contracts.user_id = auth.uid()
    )
  );
```

### Database Tasks

Run table creation SQL and RLS policies.

### API Routes

**GET `/api/contracts/[id]/chat`**

```typescript
// Response
{
  data: {
    sessionId: string;
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      pageCitation: number | null;
      createdAt: string;
    }>;
  }
}
```

**POST `/api/contracts/[id]/chat`**

```typescript
// Request
{
  message: string;  // 1-2000 characters
}

// Response
{
  data: {
    userMessage: {
      id: string;
      role: 'user';
      content: string;
      createdAt: string;
    };
    assistantMessage: {
      id: string;
      role: 'assistant';
      content: string;
      pageCitation: number | null;
      createdAt: string;
    };
  }
}
```

**Processing Logic:**

1. Validate JWT and contract ownership
2. Check contract is processed
3. Get or create chat session
4. Fetch contract text
5. Fetch conversation history (up to 200 messages)
6. Build chat prompt:
   - System: Document-grounded instructions + contract text
   - Messages: Conversation history
   - User: New question
7. Call OpenAI GPT-4o (temp 0.4, max 1000 tokens)
8. Parse response, extract page citation
9. Save both messages to DB
10. Return messages

**Chat Prompt Template:**

```
System:
You are a contract assistant. Answer questions about the provided contract.

Rules:
1. Answer ONLY from the document text provided below
2. If the answer is not in the document, say: "I cannot find this in the document."
3. Every response must include a page citation: [Page X]
4. Begin responses with "Based on the document..."
5. Never use general legal knowledge — only the document

Contract text:
{contract_text}

---

User: {question}
```

### State Management

**Chat Hook (`hooks/use-chat.ts`):**

```typescript
interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  retry: () => void;
}

function useChat(contractId: string): UseChatReturn;
```

### Component Specification

**ChatInterface (`components/chat/chat-interface.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `contractId` | `string` | Contract ID |
| `onPageCitationClick` | `(page: number) => void` | Page link click handler |

**ChatMessage (`components/chat/chat-message.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `message` | `ChatMessage` | Message data |
| `onPageClick` | `(page: number) => void` | Page citation click |

**Renders:**
- User messages: right-aligned, colored background
- Assistant messages: left-aligned, different color
- Page citation as clickable badge
- Timestamp on hover

**ChatInput (`components/chat/chat-input.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `onSend` | `(content: string) => void` | Send callback |
| `disabled` | `boolean` | Disable input |
| `isLoading` | `boolean` | Show loading state |

### Design Notes

- Messages should auto-scroll to bottom on new message
- Show typing indicator while waiting for AI
- Input should expand for multi-line questions
- Character count (max 2000)
- Page citations should match key terms panel styling
- "Not legal advice" reminder at bottom of chat

### Edge Cases

| Case | Handling |
|------|----------|
| Contract not processed | Disable chat, show message |
| Empty message | Disable send button |
| Message too long | Show character limit error |
| API timeout | Show error, offer retry |
| No answer in document | AI responds "I cannot find this..." |
| Rapid messages | Queue, process sequentially |

### Files to Create/Modify

```
components/chat/chat-interface.tsx
components/chat/chat-message.tsx
components/chat/chat-input.tsx
hooks/use-chat.ts
app/api/contracts/[id]/chat/route.ts
lib/services/chat.ts
lib/prompts/chat.ts
```

---

## US-008: Dashboard with Contract History

**Priority:** P1
**Story:** As a user, I want my dashboard to show all the contracts I've reviewed so that I have a record of my review history.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📊 Overview                                       │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐           │ │
│  │  │   12    │  │    8    │  │    4    │           │ │
│  │  │ Total   │  │  NDAs   │  │  MSAs   │           │ │
│  │  └─────────┘  └─────────┘  └─────────┘           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📄 Recent Contracts                   [Review ▶] │ │
│  │  ┌───────────────────────────────────────────────┐│ │
│  │  │ Name          │ Type │ Status    │ Date      ││ │
│  │  ├───────────────┼──────┼───────────┼───────────┤│ │
│  │  │ Vendor_NDA.pdf│ NDA  │ Processed │ Jul 15    ││ │
│  │  │ Client_MSA.pdf│ MSA  │ Processed │ Jul 14    ││ │
│  │  │ Partner_NDA..│ NDA  │ Error     │ Jul 12    ││ │
│  │  └───────────────────────────────────────────────┘│ │
│  │  Showing 1-10 of 12                 [< 1 2 >]    │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

Uses existing `contracts` table. No new tables needed.

### API Routes

**GET `/api/dashboard`**

```typescript
// Query params
{
  page?: number;      // Default 1
  limit?: number;     // Default 20, max 100
  sort?: 'created_at' | 'name' | 'type';  // Default 'created_at'
  order?: 'asc' | 'desc';  // Default 'desc'
}

// Response
{
  data: {
    stats: {
      totalContracts: number;
      ndaCount: number;
      msaCount: number;
    };
    contracts: Array<{
      id: string;
      name: string;
      type: 'nda' | 'msa';
      status: 'uploaded' | 'processing' | 'processed' | 'error';
      createdAt: string;
    }>;
  };
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}
```

### State Management

**TanStack Query:**

```typescript
function useDashboard(options: DashboardOptions) {
  return useQuery({
    queryKey: ['dashboard', options],
    queryFn: () => fetchDashboard(options),
  });
}
```

### Component Specification

**StatsCard (`components/dashboard/stats-card.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Stat label |
| `value` | `number` | Stat value |
| `icon` | `ReactNode` | Optional icon |

**ContractList (`components/dashboard/contract-list.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `contracts` | `Contract[]` | Contract array |
| `onRowClick` | `(id: string) => void` | Row click handler |
| `sortColumn` | `string` | Current sort column |
| `sortOrder` | `'asc' \| 'desc'` | Current sort order |
| `onSort` | `(column: string) => void` | Sort change handler |

**ContractCard (`components/dashboard/contract-card.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `contract` | `Contract` | Contract data |
| `onClick` | `() => void` | Click handler |

**Renders:**
- Contract name (truncated if long)
- Type badge (NDA/MSA)
- Status badge (color-coded)
- Relative date ("2 days ago")

**Pagination:**

| Prop | Type | Description |
|------|------|-------------|
| `currentPage` | `number` | Current page |
| `totalPages` | `number` | Total pages |
| `onPageChange` | `(page: number) => void` | Page change handler |

### Design Notes

- Empty state: illustration + "No contracts reviewed yet" + CTA
- Stats cards should be visually prominent
- Table should be sortable by clicking column headers
- Status badges: green (processed), yellow (processing), red (error), gray (uploaded)
- Row hover state
- Mobile: card layout instead of table

### Edge Cases

| Case | Handling |
|------|----------|
| No contracts | Show empty state with CTA |
| Many contracts | Pagination (20 per page) |
| Very long filename | Truncate with ellipsis, show full on hover |
| Processing contract | Show animated spinner in status |
| Error contract | Show retry button on hover |

### Files to Create/Modify

```
app/(protected)/dashboard/page.tsx
components/dashboard/stats-card.tsx
components/dashboard/contract-list.tsx
components/dashboard/contract-card.tsx
components/ui/pagination.tsx
app/api/dashboard/route.ts
```

---

## US-009: Inline Key Term Editing

**Priority:** P1
**Story:** As a user, I want to edit an incorrectly extracted term so that the record is accurate.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Key Terms Panel                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Governing Law            [Page 3]        92%  ✏️  │ │
│  │ State of Delaware                                  │ │
│  └───────────────────────────────────────────────────┘ │
│                         ↓ Click edit                    │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Governing Law            [Page 3]        92%      │ │
│  │ ┌─────────────────────────────────────────────┐   │ │
│  │ │ State of New York                          │   │ │
│  │ └─────────────────────────────────────────────┘   │ │
│  │                                    [Cancel] [Save]│ │
│  └───────────────────────────────────────────────────┘ │
│                         ↓ After save                    │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Governing Law  [Edited]  [Page 3]        92%  ✏️  │ │
│  │ State of New York                                  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

Uses existing `key_terms` table columns:
- `is_edited` (boolean)
- `original_value` (text)

### API Routes

**PATCH `/api/contracts/[id]/terms/[termId]`**

```typescript
// Request
{
  value: string;  // New value, max 2000 chars
}

// Response
{
  data: {
    id: string;
    termName: string;
    value: string;
    isEdited: true;
    originalValue: string;
    updatedAt: string;
  }
}
```

**Processing Logic:**

1. Validate JWT and contract ownership
2. Fetch current term
3. If not already edited, store current value in `original_value`
4. Update `value`, set `is_edited = true`
5. Return updated term

### State Management

**Term Editor State:**

```typescript
interface TermEditorState {
  editingTermId: string | null;
  editValue: string;
  isSaving: boolean;
  error: string | null;
}
```

**TanStack Query Mutation:**

```typescript
const updateTermMutation = useMutation({
  mutationFn: ({ termId, value }) => updateTerm(contractId, termId, value),
  onSuccess: () => {
    queryClient.invalidateQueries(['contract', contractId]);
  },
});
```

### Component Specification

**TermEditor (`components/results/term-editor.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `term` | `KeyTerm` | Term to edit |
| `onSave` | `(value: string) => void` | Save callback |
| `onCancel` | `() => void` | Cancel callback |
| `isSaving` | `boolean` | Loading state |

**Features:**
- Textarea for editing value
- Cancel button (revert to original)
- Save button
- Character count
- Keyboard shortcuts: Escape to cancel, Cmd+Enter to save

**Edited Badge:**

When `is_edited = true`, show a small "Edited" badge next to term name.

### Design Notes

- Edit icon should appear on hover
- Smooth transition to edit mode
- Auto-focus textarea on edit
- Show original value in tooltip on "Edited" badge
- Disable save if value unchanged
- Optimistic update with rollback on error

### Edge Cases

| Case | Handling |
|------|----------|
| Empty value | Allow (term may not exist) |
| Very long value | Show character limit (2000) |
| Network error on save | Rollback optimistic update, show error |
| Concurrent edit | Last write wins (no locking) |
| Edit then cancel | Revert to previous value |
| Multiple rapid edits | Queue, process in order |

### Files to Create/Modify

```
components/results/term-editor.tsx
components/results/key-term-row.tsx (update)
components/ui/badge.tsx
app/api/contracts/[id]/terms/[termId]/route.ts
```

---

## US-010: Feedback Rating Submission

**Priority:** P2
**Story:** As a user, I want to submit feedback on the AI's accuracy so that the product improves over time.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Results Page - Bottom Section                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Was this extraction helpful?                      │ │
│  │                                                     │ │
│  │       👍          👎                               │ │
│  │      Yes          No                               │ │
│  │                                                     │ │
│  └───────────────────────────────────────────────────┘ │
│                         ↓ Click thumbs up               │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ✅ Thanks for your feedback!                      │ │
│  │                                                     │ │
│  │  Any additional comments? (optional)               │ │
│  │  ┌───────────────────────────────────────────┐    │ │
│  │  │                                           │    │ │
│  │  └───────────────────────────────────────────┘    │ │
│  │                                      [Submit]     │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  rating VARCHAR(10) NOT NULL CHECK (rating IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contract_id)
);

CREATE INDEX idx_user_feedback_contract_id ON user_feedback(contract_id);
CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);

-- RLS Policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback" ON user_feedback
  FOR ALL USING (auth.uid() = user_id);
```

### API Routes

**POST `/api/contracts/[id]/feedback`**

```typescript
// Request
{
  rating: 'up' | 'down';
  comment?: string;  // Optional, max 1000 chars
}

// Response
{
  data: {
    id: string;
    rating: 'up' | 'down';
    comment: string | null;
    createdAt: string;
  }
}
```

**Processing Logic:**

1. Validate JWT
2. Check if feedback already exists for this user + contract
3. If exists, update; else insert
4. Return feedback record

### State Management

**Feedback State:**

```typescript
interface FeedbackState {
  rating: 'up' | 'down' | null;
  comment: string;
  isSubmitted: boolean;
  isSubmitting: boolean;
}
```

### Component Specification

**FeedbackForm (`components/feedback/feedback-form.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `contractId` | `string` | Contract ID |
| `existingFeedback` | `Feedback \| null` | Pre-existing feedback |
| `onSubmit` | `(feedback: Feedback) => void` | Submit callback |

**RatingButtons (`components/feedback/rating-buttons.tsx`):**

| Prop | Type | Description |
|------|------|-------------|
| `value` | `'up' \| 'down' \| null` | Selected rating |
| `onChange` | `(rating: 'up' \| 'down') => void` | Change callback |
| `disabled` | `boolean` | Disable buttons |

### Design Notes

- Large, tappable thumbs icons
- Visual feedback on selection (filled icon)
- Comment field appears after rating selection
- Thank you message on submit
- Show existing feedback if already submitted
- Allow changing feedback

### Edge Cases

| Case | Handling |
|------|----------|
| Already submitted | Show current rating, allow update |
| Comment too long | Character limit (1000), show count |
| Submit without rating | Disable submit button |
| Network error | Show error toast, allow retry |

### Files to Create/Modify

```
components/feedback/feedback-form.tsx
components/feedback/rating-buttons.tsx
app/api/contracts/[id]/feedback/route.ts
```

---

## US-011: Export Key Terms

**Priority:** P2
**Story:** As a user, I want to export the key terms as a CSV or PDF report so that I can share the review summary with my team.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Results Page - Key Terms Panel Header                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Key Terms (12)                    [Export ▼]     │ │
│  │                                    ┌─────────────┐│ │
│  │                                    │ CSV         ││ │
│  │                                    │ PDF Report  ││ │
│  │                                    └─────────────┘│ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Implementation (Future - P2)

**CSV Export:**
- Client-side generation using `papaparse`
- Columns: Term Name, Value, Page, Confidence, Edited, Source Sentence
- Filename: `{contract_name}_terms.csv`

**PDF Export:**
- Server-side generation using `@react-pdf/renderer` or `puppeteer`
- Formatted report with contract info header
- Table of key terms
- Disclaimer footer

### API Routes (Future)

**GET `/api/contracts/[id]/export?format=csv|pdf`**

### Files to Create (Future)

```
app/api/contracts/[id]/export/route.ts
lib/services/export.ts
```

---

## US-012: Persistent Chat History

**Priority:** P1
**Story:** As a user, I want the chat history for each contract to persist so that I can revisit my questions later.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│  Results Page - Returning to Chat                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Previous conversation (3 messages)               │ │
│  │                                                     │ │
│  │  👤 What is the governing law?                     │ │
│  │  🤖 Based on the document, the governing law is    │ │
│  │     State of Delaware. [Page 3]                    │ │
│  │  👤 Is there a non-compete clause?                 │ │
│  │  🤖 I cannot find a non-compete clause in this     │ │
│  │     document.                                       │ │
│  │                                                     │ │
│  │  ─────────────────────────────────────────────── │ │
│  │  Continue conversation...                          │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

Already covered in US-007 (`chat_sessions`, `chat_messages` tables).

### Implementation

Chat history is automatically persisted in US-007. This story ensures:

1. Messages are loaded when results page opens
2. Previous conversation is displayed
3. New messages are appended to existing history
4. Full history is passed to OpenAI for context

**History Loading:**

```typescript
// On results page load
const { data: chatHistory } = useQuery({
  queryKey: ['chat', contractId],
  queryFn: () => fetchChatHistory(contractId),
  staleTime: 60000,  // 1 minute
});
```

**Context Passing:**

All messages (up to 200) are passed to OpenAI as conversation history, enabling:
- Follow-up questions ("What did you say about the liability cap?")
- Corrections ("Actually, I meant the other clause")
- Progressive exploration ("Tell me more about that")

### Edge Cases

| Case | Handling |
|------|----------|
| Very long history (>200 messages) | Truncate oldest messages |
| Message fails to save | Retry, show error if fails |
| History fails to load | Show error, allow retry |

### Files to Create/Modify

Already covered in US-007.

---

## Summary: Implementation Order

### Phase 1: Foundation (P0)

1. **US-001**: Authentication
2. **US-002**: PDF Upload + Text Extraction
3. **US-004**: Confidence Score Display
4. **US-005**: Custom Key Terms
5. **US-003**: Page Number Attribution

### Phase 2: Enhanced Experience (P1)

6. **US-006**: Inline PDF Viewer
7. **US-007**: Chat with Contract
8. **US-012**: Persistent Chat History
9. **US-008**: Dashboard
10. **US-009**: Inline Term Editing

### Phase 3: Polish (P2)

11. **US-010**: Feedback Submission
12. **US-011**: Export (backlog)

---

*This document provides implementation-ready specifications for each feature. Refer to `engineering-doc.md` for architectural context and database schemas.*
