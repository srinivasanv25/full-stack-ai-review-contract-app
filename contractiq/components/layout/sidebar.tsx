'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Upload, LogOut, FileText } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Review Contract', icon: Upload },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <aside className="flex w-full flex-row items-center justify-between bg-primary px-md py-sm md:h-screen md:w-sidebar md:flex-shrink-0 md:flex-col md:items-stretch md:justify-start md:p-lg">
      <Link href="/dashboard" className="flex items-center gap-sm text-white">
        <FileText size={22} strokeWidth={1.5} aria-hidden />
        <span className="text-h4 font-bold">ContractIQ</span>
      </Link>

      <nav className="flex flex-row gap-xs md:mt-2xl md:flex-col md:gap-xs">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-sm rounded-input px-md py-sm text-body font-medium transition-colors duration-150 ease-out ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={1.5} aria-hidden />
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="hidden md:mt-auto md:flex md:flex-col md:gap-sm">
        <p className="truncate text-small text-white/60">{user?.email}</p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-sm rounded-input px-md py-sm text-body font-medium text-white/70 transition-colors duration-150 ease-out hover:bg-white/5 hover:text-white"
        >
          <LogOut size={18} strokeWidth={1.5} aria-hidden />
          Sign out
        </button>
      </div>

      <button
        onClick={handleSignOut}
        aria-label="Sign out"
        className="text-white/70 hover:text-white md:hidden"
      >
        <LogOut size={20} strokeWidth={1.5} />
      </button>
    </aside>
  )
}
