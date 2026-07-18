'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { Card } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background-subtle px-md">
      <div className="w-full max-w-sm">
        <div className="mb-lg text-center">
          <Link href="/" className="text-h3 font-bold text-primary">
            ContractIQ
          </Link>
          <h1 className="mt-md text-h2 text-text-primary">Create your account</h1>
          <p className="mt-xs text-body text-text-secondary">
            Start reviewing contracts in minutes, not hours.
          </p>
        </div>

        <Card>
          <AuthForm mode="signup" onSuccess={() => router.push('/dashboard')} />
        </Card>

        <p className="mt-lg text-center text-body text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
