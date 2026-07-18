import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface StatsCardProps {
  label: string
  value: number
  icon?: ReactNode
}

export function StatsCard({ label, value, icon }: StatsCardProps) {
  return (
    <Card className="flex items-center gap-md">
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-light text-primary">
          {icon}
        </span>
      )}
      <div>
        <p className="text-h2 font-bold text-text-primary">{value}</p>
        <p className="text-small text-text-muted">{label}</p>
      </div>
    </Card>
  )
}
