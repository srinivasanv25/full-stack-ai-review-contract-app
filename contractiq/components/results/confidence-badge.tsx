import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface ConfidenceBadgeProps {
  score: number | null
  showPercentage?: boolean
  size?: 'sm' | 'md'
}

export function ConfidenceBadge({ score, showPercentage = true, size = 'sm' }: ConfidenceBadgeProps) {
  if (score === null) {
    return (
      <Badge variant="muted" size={size}>
        N/A
      </Badge>
    )
  }

  const percentage = Math.round(score * 100)
  const tier = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low'
  const variant = tier === 'high' ? 'success' : tier === 'medium' ? 'warning' : 'error'
  const colorClassName = tier === 'high' ? 'bg-success' : tier === 'medium' ? 'bg-warning' : 'bg-error'

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center gap-xs">
        {tier === 'low' && (
          <AlertTriangle size={14} strokeWidth={2} className="shrink-0 text-error" aria-hidden />
        )}
        <Progress value={percentage} colorClassName={colorClassName} size={size} className="w-16" />
        {showPercentage && (
          <Badge variant={variant} size={size}>
            {percentage}%
          </Badge>
        )}
      </div>
      {tier === 'low' && (
        <p className="text-small text-error">Low confidence — verify in document</p>
      )}
    </div>
  )
}
