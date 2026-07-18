# Spec: Feedback Rating Submission (US-010)

**Source:** `docs/engineering/engineering-doc.md` §9 API, §10 (US-010)
**Depends on:** `docs/specs/supabase-schema.sql` (`user_feedback`), `docs/specs/04-results-page.md` (mount location)

## Purpose

Thumbs up/down + optional comment on a contract's review quality, one per user per contract, editable after submission. Rendered at the bottom of the results page.

## User Story

As a user, I want to submit feedback on the AI's accuracy so that the product improves over time.

## Files to create

```
components/feedback/feedback-form.tsx
components/feedback/rating-buttons.tsx
app/api/contracts/[id]/feedback/route.ts
```

## API: `POST /api/contracts/[id]/feedback`

**Auth:** required, contract ownership enforced (404 if not owned).

**Request:**

```typescript
{ rating: 'up' | 'down'; comment?: string } // comment max 1000 chars
```

**Processing (upsert):**

```sql
insert into user_feedback (user_id, contract_id, rating, comment)
values ($1, $2, $3, $4)
on conflict (user_id, contract_id)
do update set rating = excluded.rating, comment = excluded.comment
returning *;
```

Relies on the `unique (user_id, contract_id)` constraint from `supabase-schema.sql`.

**Response (201):**

```typescript
{
  data: { id: string; rating: 'up' | 'down'; comment: string | null; createdAt: string }
}
```

**Errors:**

| Code | Condition | Message |
|------|-----------|---------|
| 400 | Missing/invalid `rating` | "Rating is required." |
| 400 | Comment > 1000 chars | "Comment exceeds 1000 character limit." |
| 404 | Contract not found / not owned | "Contract not found." |

## Fetching existing feedback

Extend the `GET /api/contracts/[id]` response from `docs/specs/04-results-page.md` with `userFeedback: { rating; comment } | null` so the results page can pre-fill the form in the same request that loads the rest of the contract, avoiding an extra round trip.

## Component: `FeedbackForm`

| Prop | Type |
|------|------|
| `contractId` | `string` |
| `existingFeedback` | `{ rating: 'up' \| 'down'; comment: string \| null } \| null` |
| `onSubmit` | `(feedback: { rating: 'up' \| 'down'; comment: string \| null }) => void` |

State machine: renders `RatingButtons` first; once a rating is selected (or pre-filled from `existingFeedback`), reveals an optional comment textarea + Submit button. Shows "✅ Thanks for your feedback!" after successful submit, with the form still editable (re-submitting updates the row via upsert).

## Component: `RatingButtons`

| Prop | Type |
|------|------|
| `value` | `'up' \| 'down' \| null` |
| `onChange` | `(rating: 'up' \| 'down') => void` |
| `disabled` | `boolean` |

Large tappable thumbs-up/thumbs-down icons; selected state shown as filled icon with accent color per `docs/design.md`.

## Design notes

- Comment field only appears after a rating is picked (reduces friction).
- Submit disabled until a rating is selected.
- If `existingFeedback` is present on mount, pre-select that rating and pre-fill the comment, with a subtly different label ("Update feedback" instead of "Submit").

## Edge cases

| Case | Handling |
|------|----------|
| Resubmitting with a different rating | Upsert overwrites previous row (single feedback per user per contract, by design) |
| Comment too long | Inline character count + error at 1000, submit disabled |
| Submit without rating | Submit button disabled, no request sent |
| Network error on submit | Toast error, form remains in editable state for retry |

## Acceptance Criteria

- [ ] **AC-1:** Submitting a thumbs-up with no comment creates exactly one `user_feedback` row for that `(user_id, contract_id)` pair.
- [ ] **AC-2:** Submitting feedback a second time for the same contract updates the existing row rather than creating a duplicate (enforced by the `unique (user_id, contract_id)` constraint).
- [ ] **AC-3:** Reloading the results page after submitting feedback shows the previously selected rating and comment pre-filled.
- [ ] **AC-4:** A comment over 1000 characters is rejected client-side (submit disabled) and server-side (400) if bypassed.
- [ ] **AC-5:** The Submit button is disabled until a rating is selected.

## Manual test checklist

- [ ] Submit thumbs up with no comment → saved, thank-you message shown
- [ ] Reload page → previously submitted rating/comment pre-filled
- [ ] Change rating from up to down and resubmit → row updates (not duplicated)
- [ ] Enter a >1000 char comment → inline error, submit blocked
