'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { FileText, FilePlus, FileCheck } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/stats-card'
import { ContractList } from '@/components/dashboard/contract-list'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonClassNames } from '@/components/ui/button'
import type { DashboardContract } from '@/types/contracts'

interface DashboardResponse {
  data: {
    stats: { totalContracts: number; ndaCount: number; msaCount: number }
    contracts: DashboardContract[]
  }
  meta: { pagination: { page: number; limit: number; total: number } }
}

async function fetchDashboard(options: {
  page: number
  limit: number
  sort: string
  order: 'asc' | 'desc'
}): Promise<DashboardResponse> {
  const searchParams = new URLSearchParams({
    page: String(options.page),
    limit: String(options.limit),
    sort: options.sort,
    order: options.order,
  })
  const res = await fetch(`/api/dashboard?${searchParams.toString()}`)
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Failed to load dashboard.')
  }
  return json as DashboardResponse
}

const LIMIT = 20

export default function DashboardPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('created_at')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', { page, limit: LIMIT, sort, order }],
    queryFn: () => fetchDashboard({ page, limit: LIMIT, sort, order }),
  })

  const handleSort = (column: string) => {
    if (column === sort) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(column)
      setOrder('desc')
    }
    setPage(1)
  }

  const stats = data?.data.stats ?? { totalContracts: 0, ndaCount: 0, msaCount: 0 }
  const contracts = data?.data.contracts ?? []
  const total = data?.meta.pagination.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="mx-auto max-w-6xl px-md py-xl">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h1 className="text-h1 text-text-primary">Dashboard</h1>
        <Link href="/upload" className={buttonClassNames('primary', 'md')}>
          Review Contract
        </Link>
      </div>

      <div className="mt-lg grid gap-md sm:grid-cols-3">
        <StatsCard
          label="Total"
          value={stats.totalContracts}
          icon={<FileText size={20} strokeWidth={1.75} aria-hidden />}
        />
        <StatsCard
          label="NDAs"
          value={stats.ndaCount}
          icon={<FilePlus size={20} strokeWidth={1.75} aria-hidden />}
        />
        <StatsCard
          label="MSAs"
          value={stats.msaCount}
          icon={<FileCheck size={20} strokeWidth={1.75} aria-hidden />}
        />
      </div>

      <div className="mt-xl rounded-card border border-border bg-elevated-surface">
        <div className="border-b border-border px-md py-md">
          <h2 className="text-h4 text-text-primary">Recent Contracts</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-sm p-md">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <p className="p-md text-body text-error">Failed to load your contracts. Please refresh.</p>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center gap-sm p-2xl text-center">
            <FileText size={32} strokeWidth={1.5} className="text-text-muted" aria-hidden />
            <p className="text-body font-medium text-text-primary">No contracts reviewed yet</p>
            <Link href="/upload" className={buttonClassNames('primary', 'sm')}>
              Review Contract
            </Link>
          </div>
        ) : (
          <div className="p-md">
            <ContractList
              contracts={contracts}
              onRowClick={(id) => router.push(`/contracts/${id}`)}
              sortColumn={sort}
              sortOrder={order}
              onSort={handleSort}
            />
          </div>
        )}

        {totalPages > 1 && (
          <div className="border-t border-border p-md">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
