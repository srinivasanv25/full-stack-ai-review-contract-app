'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?redirectTo=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, user, router, pathname])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-subtle">
        <Loader2 className="animate-spin text-primary" size={28} strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return <>{children}</>
}
