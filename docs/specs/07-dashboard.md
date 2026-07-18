# Spec: Dashboard (US-008)

**Source:** `docs/engineering/engineering-doc.md` §4 Flow 2, §10 (US-008)
**Depends on:** `docs/specs/01-auth.md`, `docs/specs/supabase-schema.sql` (`contracts`)

## Purpose

`/dashboard` shows the signed-in user's contract history with summary stats, sortable/paginated table, and a CTA to review a new contract.

## User Story

As a user, I want my dashboard to show all the contracts I've reviewed so that I have a record of my review history.

## Files to create

```
app/(protected)/dashboard/page.tsx
components/dashboard/stats-card.tsx
components/dashboard/contract-list.tsx
components/dashboard/contract-card.tsx
components/ui/pagination.tsx
app/api/dashboard/route.ts
```

## User Flow

```
Navigate to app          → Check Supabase session      → Validate JWT               → If valid, proceed; else redirect to /login
Load dashboard            → Fetch user contracts         → GET /api/dashboard          → Render contract list with stats
Click contract row         → Navigate to results page     → —                           → Load /contracts/[id]
```

## API: `GET /api/dashboard`

**Auth:** required.

**Query params:**

| Param | Type | Default |
|-------|------|---------|
| `page` | `number` | `1` |
| `limit` | `number` | `20` (max `100`) |
| `sort` | `'created_at' \| 'name' \| 'type'` | `'created_at'` |
| `order` | `'asc' \| 'desc'` | `'desc'` |

**Response (200):**

```typescript
{
  data: {
    stats: { totalContracts: number; ndaCount: number; msaCount: number }
    contracts: Array<{
      id: string
      name: string
      type: 'nda' | 'msa'
      status: 'uploaded' | 'processing' | 'processed' | 'error'
      createdAt: string
    }>
  }
  meta: { pagination: { page: number; limit: number; total: number } }
}
```

**Processing:**
1. `stats`: three `count`-only queries against `contracts` filtered by `user_id = auth.uid()` (RLS enforces this automatically; still filter explicitly in the query for clarity and index usage) — total, `type='nda'`, `type='msa'`.
2. `contracts`: `SELECT id, name, type, status, created_at FROM contracts WHERE user_id = $1 ORDER BY {sort} {order} LIMIT {limit} OFFSET {(page-1)*limit}`.
3. `meta.pagination.total` = the count from step 1's total.
4. Clamp `limit` to 100, `page` to `≥1` server-side regardless of query input.

## Data fetching

```typescript
function useDashboard(options: { page: number; limit: number; sort: string; order: 'asc' | 'desc' }) {
  return useQuery({
    queryKey: ['dashboard', options],
    queryFn: () => fetchDashboard(options),
  })
}
```

## Component: `StatsCard`

| Prop | Type |
|------|------|
| `label` | `string` |
| `value` | `number` |
| `icon` | `ReactNode?` |

Three cards rendered: Total, NDAs, MSAs.

## Component: `ContractList`

| Prop | Type |
|------|------|
| `contracts` | `Contract[]` |
| `onRowClick` | `(id: string) => void` |
| `sortColumn` | `string` |
| `sortOrder` | `'asc' \| 'desc'` |
| `onSort` | `(column: string) => void` |

Desktop: sortable table (click column header toggles `sortOrder`, switching column resets to `desc`). Mobile: renders `ContractCard` list instead (breakpoint per `docs/design.md`).

## Component: `ContractCard`

| Prop | Type |
|------|------|
| `contract` | `Contract` |
| `onClick` | `() => void` |

Shows truncated name (full name on hover/title attr), type badge, status badge, relative date (`"2 days ago"`).

Status badge colors: `processed` green, `processing` amber + animated spinner, `error` red, `uploaded` gray.

## Component: `Pagination`

| Prop | Type |
|------|------|
| `currentPage` | `number` |
| `totalPages` | `number` |
| `onPageChange` | `(page: number) => void` |

## Design notes

- Empty state (no contracts): illustration/icon + "No contracts reviewed yet" + "Review Contract" CTA button linking to `/upload`.
- Stats cards should be visually prominent.
- Table sortable by clicking column headers.
- Row click navigates to `/contracts/[id]`.
- "Review Contract" CTA always visible in the page header, not just the empty state.

## Edge cases

| Case | Handling |
|------|----------|
| No contracts | Empty state, stats all show `0` |
| `error` status contract | Status badge red; clicking still navigates to results page, which should show a friendly retry-processing affordance (out of scope here — surfaced generically) |
| Very long filename | `text-overflow: ellipsis`, full name in `title` attribute |
| `page` beyond available pages | Clamp to last valid page server-side rather than erroring |

## Acceptance Criteria

- [ ] **AC-1:** A user with zero contracts sees an empty state with a "Review Contract" CTA and stats showing 0/0/0.
- [ ] **AC-2:** Stats cards (`Total`, `NDAs`, `MSAs`) reflect exact counts of the signed-in user's contracts only — never another user's data (verified against RLS).
- [ ] **AC-3:** Sorting by `name` ascending/descending reorders the visible rows correctly; switching sort column resets order to `desc`.
- [ ] **AC-4:** With more than `limit` contracts, pagination controls correctly page through the full set with no duplicate or skipped rows.
- [ ] **AC-5:** Clicking any contract row navigates to `/contracts/[id]` for that exact contract.
- [ ] **AC-6:** On a mobile viewport, the table is replaced by a stacked `ContractCard` list with no horizontal overflow.

## Manual test checklist

- [ ] New user visits `/dashboard` → empty state with CTA
- [ ] Upload + process a few contracts → stats and list update
- [ ] Sort by name ascending/descending → order changes correctly
- [ ] With >20 contracts, paginate → correct subset per page
- [ ] Click a row → navigates to `/contracts/[id]`
