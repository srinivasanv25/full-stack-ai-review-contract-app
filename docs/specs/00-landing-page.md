# Spec: Marketing Landing Page (Flow 1)

**Source:** `docs/engineering/engineering-doc.md` §4 Flow 1, §5 Frontend Architecture
**Depends on:** `docs/specs/01-auth.md` (sign-up modal/redirect target)

## Purpose

The public `/` route. Communicates the value proposition ("90 minutes → 15 minutes"), gets a visitor into the sign-up flow, and is the only unauthenticated page besides `/login` and `/signup`. Currently scaffolded as a placeholder in `contractiq/app/page.tsx` (Stage 3) — this spec defines the real content and behavior.

## Files to create/modify

```
app/page.tsx                      (replace placeholder)
components/layout/header.tsx
components/layout/footer.tsx
```

## User Flow

```
Land on /              → Render landing page → Display value prop, feature highlights, demo GIF/screenshot
Click "Get Started Free" → Navigate to /signup  → (see docs/specs/01-auth.md)
Click "Sign In"           → Navigate to /login   → (see docs/specs/01-auth.md)
```

If a session already exists (`middleware.ts` from `docs/specs/01-auth.md` only guards `/dashboard`, `/upload`, `/contracts` — it does not redirect an authenticated user away from `/`), the header CTA should read "Go to Dashboard" instead of "Get Started Free" so a returning logged-in user isn't funneled back through sign-up. This requires `app/page.tsx` to check session client-side (via `useAuth()`) for the CTA label only — the page body itself remains statically renderable.

## Content sections (in order)

1. **Header** — logo/wordmark, "Sign In" link, "Get Started Free" primary button.
2. **Hero** — headline stating the core promise ("Review contracts in 15 minutes, not 90"), subheadline naming the mechanism (AI extraction with page-level citations and confidence scores), primary CTA ("Get Started Free"), secondary CTA ("See how it works" — anchor-scrolls to the demo section).
3. **Problem/solution strip** — 3 short value props matching the PRD pain points: missed obligations, high legal cost, no page-level attribution in generic tools.
4. **Demo section** — static screenshot or GIF of the results page (PDF viewer + key terms panel) illustrating page attribution and confidence scoring. Use a placeholder asset (`public/demo-placeholder.png`) until a real capture exists.
5. **How it works** — 3-step visual: Upload → AI Extraction → Review & Chat.
6. **Trust/disclaimer strip** — "Not legal advice" note, matching the disclaimer shown throughout the authenticated app (§8 Hallucination Guardrails in the engineering doc).
7. **Final CTA** — repeat of "Get Started Free".
8. **Footer** — copyright, disclaimer link, contact/support link placeholder.

## Component: `Header`

| Prop | Type |
|------|------|
| `variant` | `'marketing' \| 'app'` — marketing variant used on `/`, `/login`, `/signup`; app variant (with nav + sign-out) used inside `(protected)/layout.tsx` per `docs/specs/01-auth.md` |

## Component: `Footer`

Static, no props. Includes the "ContractIQ does not provide legal advice" disclaimer required on every page per the engineering doc's hallucination guardrails (§8).

## Design

Apply `docs/design.md` tokens throughout — primary blue for CTAs, grey scale for text/background, per `contractiq/tailwind.config.ts`. No feature-specific colors (confidence badges, status badges) belong on this page.

## Server/Client boundary

`app/page.tsx` remains a Server Component by default. Do not attach `onClick`/`onMouseOver` handlers to it — the "Go to Dashboard" vs. "Get Started Free" CTA swap requires reading auth state, so extract just the CTA button into a small Client Component (`components/layout/header.tsx` with `'use client'`) that calls `useAuth()`; the rest of the page stays server-rendered.

## Acceptance Criteria

- [ ] **AC-1:** A first-time visitor to `/` sees the hero headline, both CTAs, and the "Not legal advice" disclaimer without needing to scroll below the fold on a standard 1440×900 desktop viewport.
- [ ] **AC-2:** Clicking "Get Started Free" (header or hero) navigates to `/signup`.
- [ ] **AC-3:** Clicking "Sign In" navigates to `/login`.
- [ ] **AC-4:** A signed-in user visiting `/` sees "Go to Dashboard" instead of "Get Started Free" in the header, and it navigates to `/dashboard`.
- [ ] **AC-5:** Page passes WCAG 2.1 AA contrast on all text against its background (per `docs/design.md` token choices).
- [ ] **AC-6:** Page is responsive: single-column stacked layout below the `md` breakpoint, no horizontal scroll at 375px width.
- [ ] **AC-7:** No client-side JS errors on load; `app/page.tsx` itself contains no event-handler props (Server Component rule from `skills/frontend-setup/SKILL.md`).

## Edge cases

| Case | Handling |
|------|----------|
| Auth state still loading (`useAuth().isLoading`) | Header CTA shows a skeleton/neutral state briefly rather than flashing "Get Started Free" then swapping to "Go to Dashboard" |
| JS disabled / hydration failure | Server-rendered content (hero, sections, footer) still displays; only the CTA auth-swap is unavailable, degrading to "Get Started Free" as the safe default |
| Demo asset missing | Fall back to a static illustration/placeholder rather than a broken image |

## Manual test checklist

- [ ] Load `/` logged out → see marketing content, CTAs work
- [ ] Load `/` logged in → header shows "Go to Dashboard"
- [ ] Resize to mobile width → layout stacks cleanly, no overflow
- [ ] Run Lighthouse accessibility audit → no critical contrast/ARIA issues
