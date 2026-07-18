'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { Card } from '@/components/ui/card'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  return <AuthForm mode="login" onSuccess={() => router.push(redirectTo)} />
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background-subtle px-md">
      <div className="w-full max-w-sm">
        <div className="mb-lg text-center">
          <Link href="/" className="text-h3 font-bold text-primary">
            ContractIQ
          </Link>
          <h1 className="mt-md text-h2 text-text-primary">Sign in</h1>
          <p className="mt-xs text-body text-text-secondary">
            Welcome back. Enter your details to continue.
          </p>
        </div>

        <Card>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </Card>

        <p className="mt-lg text-center text-body text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:text-primary-hover">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  )
}
