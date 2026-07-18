import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelativeDate } from '@/lib/utils/format'
import type { DashboardContract } from '@/types/contracts'

const STATUS_CONFIG: Record<
  DashboardContract['status'],
  { label: string; variant: 'success' | 'warning' | 'error' | 'muted' }
> = {
  processed: { label: 'Processed', variant: 'success' },
  processing: { label: 'Processing', variant: 'warning' },
  error: { label: 'Error', variant: 'error' },
  uploaded: { label: 'Uploaded', variant: 'muted' },
}

export function StatusBadge({ status }: { status: DashboardContract['status'] }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className="gap-xs">
      {status === 'processing' && (
        <Loader2 size={10} className="animate-spin" strokeWidth={2.5} aria-hidden />
      )}
      {config.label}
    </Badge>
  )
}

interface ContractCardProps {
  contract: DashboardContract
  onClick: () => void
}

export function ContractCard({ contract, onClick }: ContractCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-xs rounded-card border border-border bg-elevated-surface p-md text-left transition-colors duration-150 ease-out hover:border-primary"
    >
      <div className="flex items-center justify-between gap-sm">
        <p className="truncate text-body font-semibold text-text-primary" title={contract.name}>
          {contract.name}
        </p>
        <Badge variant="default">{contract.type.toUpperCase()}</Badge>
      </div>
      <div className="flex items-center justify-between gap-sm">
        <StatusBadge status={contract.status} />
        <p className="text-small text-text-muted">{formatRelativeDate(contract.createdAt)}</p>
      </div>
    </button>
  )
}
