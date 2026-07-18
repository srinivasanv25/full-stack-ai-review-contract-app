'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import type { DashboardContract } from '@/types/contracts'
import { formatRelativeDate } from '@/lib/utils/format'
import { ContractCard, StatusBadge } from './contract-card'

interface ContractListProps {
  contracts: DashboardContract[]
  onRowClick: (id: string) => void
  sortColumn: string
  sortOrder: 'asc' | 'desc'
  onSort: (column: string) => void
}

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'created_at', label: 'Date' },
]

export function ContractList({
  contracts,
  onRowClick,
  sortColumn,
  sortOrder,
  onSort,
}: ContractListProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-md py-sm">
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="flex items-center gap-xs text-small font-semibold text-text-muted hover:text-text-primary"
                  >
                    {column.label}
                    {sortColumn === column.key &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp size={12} strokeWidth={2} aria-hidden />
                      ) : (
                        <ArrowDown size={12} strokeWidth={2} aria-hidden />
                      ))}
                  </button>
                </th>
              ))}
              <th className="px-md py-sm text-small font-semibold text-text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr
                key={contract.id}
                onClick={() => onRowClick(contract.id)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-background-subtle"
              >
                <td
                  className="max-w-xs truncate px-md py-sm text-body text-text-primary"
                  title={contract.name}
                >
                  {contract.name}
                </td>
                <td className="px-md py-sm text-body text-text-secondary">
                  {contract.type.toUpperCase()}
                </td>
                <td className="px-md py-sm text-body text-text-secondary">
                  {formatRelativeDate(contract.createdAt)}
                </td>
                <td className="px-md py-sm">
                  <StatusBadge status={contract.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-sm md:hidden">
        {contracts.map((contract) => (
          <ContractCard key={contract.id} contract={contract} onClick={() => onRowClick(contract.id)} />
        ))}
      </div>
    </>
  )
}
