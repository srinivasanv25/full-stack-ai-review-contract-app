import { Check } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

type UploadStep = 'uploading' | 'extracting' | 'analyzing'

interface UploadProgressProps {
  step: UploadStep
  progress: number
}

const STEPS: Array<{ key: UploadStep; label: string }> = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'extracting', label: 'Extracting Text' },
  { key: 'analyzing', label: 'Analyzing with AI' },
]

export function UploadProgress({ step, progress }: UploadProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <div className="flex flex-col gap-md">
      <ol className="flex items-start justify-between">
        {STEPS.map((s, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-xs">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-small font-semibold ${
                  isComplete
                    ? 'bg-success text-white'
                    : isCurrent
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-muted'
                }`}
              >
                {isComplete ? <Check size={16} strokeWidth={2} /> : index + 1}
              </span>
              <span
                className={`text-center text-small ${
                  isCurrent ? 'font-semibold text-text-primary' : 'text-text-muted'
                }`}
              >
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>
      <Progress value={progress} />
    </div>
  )
}
