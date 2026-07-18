'use client'

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload, FileText, X } from 'lucide-react'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  accept: string
  maxSize: number
  disabled?: boolean
  selectedFile?: File | null
  onClear?: () => void
}

export function FileDropzone({
  onFileSelect,
  accept,
  maxSize,
  disabled = false,
  selectedFile = null,
  onClear,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are accepted.')
        return
      }
      if (file.size > maxSize) {
        setError('File exceeds 10 MB limit.')
        return
      }
      onFileSelect(file)
    },
    [maxSize, onFileSelect]
  )

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = event.dataTransfer.files[0]
    if (file) validateAndSelect(file)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) validateAndSelect(file)
    event.target.value = ''
  }

  if (selectedFile) {
    return (
      <div className="flex items-center justify-between rounded-card border border-border bg-elevated-surface p-md">
        <div className="flex items-center gap-sm">
          <FileText size={20} className="text-primary" strokeWidth={1.75} aria-hidden />
          <div>
            <p className="text-body font-medium text-text-primary">{selectedFile.name}</p>
            <p className="text-small text-text-muted">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>
        {onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove file"
            className="text-text-muted hover:text-text-primary"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={`flex flex-col items-center justify-center gap-sm rounded-card border-2 border-dashed p-2xl text-center transition-colors duration-150 ease-out ${
          disabled
            ? 'cursor-not-allowed border-border opacity-60'
            : isDragging
              ? 'cursor-pointer border-primary bg-accent-light'
              : 'cursor-pointer border-border-strong hover:border-primary hover:bg-background-subtle'
        }`}
      >
        <Upload size={28} strokeWidth={1.5} className="text-text-muted" aria-hidden />
        <p className="text-body font-medium text-text-primary">Drag and drop your PDF here</p>
        <p className="text-small text-text-muted">or click to browse &middot; max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={handleChange}
        />
      </div>
      {error && (
        <p role="alert" className="mt-sm text-small text-error">
          {error}
        </p>
      )}
    </div>
  )
}
