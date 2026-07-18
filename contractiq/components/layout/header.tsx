'use client'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { buttonClassNames } from '@/components/ui/button'

interface HeaderProps {
  variant?: 'marketing' | 'app'
}

export function Header({ variant = 'marketing' }: HeaderProps) {
  const { user, isLoading } = useAuth()
  const isAuthed = variant === 'marketing' && !isLoading && Boolean(user)

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-elevated-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-md">
        <Link href="/" className="flex items-center gap-sm text-text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-input bg-primary text-white">
            <FileText size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-h4 font-bold">ContractIQ</span>
        </Link>

        <nav className="flex items-center gap-md">
          {isAuthed ? (
            <Link href="/dashboard" className={buttonClassNames('primary', 'sm')}>
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-body font-medium text-text-secondary hover:text-text-primary"
              >
                Sign In
              </Link>
              <Link href="/signup" className={buttonClassNames('primary', 'sm')}>
                Get Started Free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
