# Spec: Authentication (US-001)

**Source:** `docs/engineering/engineering-doc.md` §4 Flow 1–2, §5 Frontend Architecture, §6 Backend Architecture, §10 (US-001)
**Depends on:** `docs/specs/supabase-schema.sql` (uses built-in `auth.users`, no custom tables)

## Purpose

Email/password sign up, sign in, sign out via Supabase Auth. Protects all app routes except `/`, `/login`, `/signup`. Every other feature spec assumes `requireUser()` (see `docs/specs/09-api-conventions.md`) and `useAuth()` from this spec already exist.

## User Story

As a founder, I want to sign up with my email and password so that my contracts and chat history are saved privately.

## Supabase Configuration (manual, one-time)

1. Supabase Dashboard → Authentication → Providers → enable **Email**.
2. Authentication → Settings → set **Confirm email** to your preference (OFF is fine for MVP to reduce friction; ON is more secure).
3. Authentication → URL Configuration → add `NEXT_PUBLIC_APP_URL` (and `/auth/callback` if email confirmation is ON) to **Redirect URLs**.

## Files to create

```
lib/supabase/client.ts        # browser client
lib/supabase/server.ts        # server client (route handlers, server components)
middleware.ts                 # route protection
contexts/auth-context.tsx     # session/user provider
hooks/use-auth.ts             # useAuth() hook
components/auth/auth-form.tsx
components/auth/auth-guard.tsx
app/(auth)/login/page.tsx
app/(auth)/signup/page.tsx
app/(protected)/layout.tsx    # wraps dashboard/upload/contracts in AuthGuard + app shell
```

## User Flow

```
Land on /                → Render landing page          → —                          → Display value prop
Click "Get Started Free" → Navigate to /signup           → —                          → Show email/password form
Submit signup form       → Call supabase.auth.signUp()   → Supabase creates user      → Return session token
Auth success              → Store session, redirect       → —                          → Navigate to /dashboard
```

```
Navigate to app          → Check Supabase session        → Validate JWT               → If valid, proceed; else redirect to /login
```

## Database Schema

None — uses Supabase's built-in `auth.users` table. No migration required beyond enabling the Email provider.

## `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

## `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

## `middleware.ts`

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PREFIXES = ['/dashboard', '/upload', '/contracts']
const AUTH_PAGES = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p))
  const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

## `contexts/auth-context.tsx`

```typescript
'use client'

import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, isLoading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}
```

## `hooks/use-auth.ts`

```typescript
'use client'

import { useContext } from 'react'
import { AuthContext } from '@/contexts/auth-context'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

## Validation (Zod)

```typescript
import { z } from 'zod'

export const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
```

## Component: `AuthForm`

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `'login' \| 'signup'` | Form mode |
| `onSuccess` | `() => void` | Redirect callback |

States: `idle` → `submitting` → `error` \| `success`. Password field has a show/hide toggle. Email input uses `type="email"`.

## Component: `AuthGuard`

Client component wrapping protected page content as a defense-in-depth check alongside `middleware.ts`. Shows a loading skeleton while `isLoading`, redirects to `/login` if no user once loaded.

## API surface

No custom API routes — all operations go through the Supabase client directly (`supabase.auth.signUp`, `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`). Every other feature's API routes depend on this spec's `requireUser()` helper (`docs/specs/09-api-conventions.md`) to read the session server-side.

## Edge cases

| Case | Handling |
|------|----------|
| User already exists (signup) | Supabase returns an error; show "An account with this email already exists" |
| Invalid credentials (login) | Show "Invalid email or password" |
| Network error | Show "Connection failed. Please try again." |
| Weak password | Inline Zod validation error before submit |
| Session expired mid-session | Next protected fetch gets 401 → redirect to `/login?redirectTo=<path>` |
| User navigates directly to `/dashboard` with an expired cookie | `middleware.ts` catches it server-side before any page code runs |

## Acceptance Criteria

- [ ] **AC-1:** Submitting the sign-up form with a new, valid email/password (≥8 chars) creates a Supabase user and redirects to `/dashboard` in under 10 seconds.
- [ ] **AC-2:** Submitting the sign-up form with an email already in use shows "An account with this email already exists" without navigating away.
- [ ] **AC-3:** Submitting the login form with valid credentials redirects to `/dashboard`; with invalid credentials shows "Invalid email or password".
- [ ] **AC-4:** An unauthenticated request to `/dashboard`, `/upload`, or `/contracts/[id]` is redirected to `/login?redirectTo=<original path>` by `middleware.ts` before any page component renders.
- [ ] **AC-5:** An authenticated user visiting `/login` or `/signup` is redirected to `/dashboard`.
- [ ] **AC-6:** After `signOut()`, the next request to any protected route redirects to `/login`.
- [ ] **AC-7:** Session persists across a full page reload (no re-login required) as long as the Supabase session cookie is valid.
- [ ] **AC-8:** Password field supports a show/hide toggle; email field uses `type="email"` for mobile keyboard optimization.

## Manual test checklist

- [ ] Sign up with a new email → redirected to `/dashboard`
- [ ] Sign up with an existing email → inline error shown
- [ ] Sign in with wrong password → inline error shown
- [ ] Visit `/dashboard` while logged out → redirected to `/login`
- [ ] Visit `/login` while logged in → redirected to `/dashboard`
- [ ] Sign out → redirected to `/`, protected routes now redirect to `/login`
