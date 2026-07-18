interface ContractTypeSelectorProps {
  value: 'nda' | 'msa' | null
  onChange: (type: 'nda' | 'msa') => void
  disabled?: boolean
}

const OPTIONS: Array<{ value: 'nda' | 'msa'; label: string; description: string }> = [
  { value: 'nda', label: 'NDA', description: 'Non-Disclosure Agreement' },
  { value: 'msa', label: 'MSA', description: 'Master Service Agreement' },
]

export function ContractTypeSelector({ value, onChange, disabled = false }: ContractTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-sm" role="radiogroup" aria-label="Contract type">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`rounded-card border p-md text-left transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
            value === option.value
              ? 'border-primary bg-accent-light'
              : 'border-border-strong hover:border-primary'
          }`}
        >
          <p className="text-body font-semibold text-text-primary">{option.label}</p>
          <p className="text-small text-text-secondary">{option.description}</p>
        </button>
      ))}
    </div>
  )
}
