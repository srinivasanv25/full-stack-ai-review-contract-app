'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { FileDropzone } from '@/components/upload/file-dropzone'
import { ContractTypeSelector } from '@/components/upload/contract-type-selector'
import { CustomTermInput } from '@/components/upload/custom-term-input'
import { UploadProgress } from '@/components/upload/upload-progress'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { STANDARD_TERMS } from '@/lib/constants/terms'
import { MAX_FILE_SIZE_BYTES, MAX_CUSTOM_TERMS } from '@/lib/constants/config'

interface UploadResponseData {
  id: string
  name: string
  type: 'nda' | 'msa'
  status: 'uploaded'
  pageCount: number
  tokenCount: number
  createdAt: string
}

interface ProcessResponseData {
  contractId: string
  status: 'processed'
  termsExtracted: number
  processingTimeMs: number
}

async function uploadContract(params: {
  file: File
  contractType: 'nda' | 'msa'
  customTerms: string[]
}): Promise<UploadResponseData> {
  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('contractType', params.contractType)
  if (params.customTerms.length > 0) {
    formData.append('customTerms', JSON.stringify(params.customTerms))
  }

  const res = await fetch('/api/contracts/upload', { method: 'POST', body: formData })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Upload failed.')
  }
  return json.data as UploadResponseData
}

async function processContract(contractId: string): Promise<ProcessResponseData> {
  const res = await fetch(`/api/contracts/${contractId}/process`, { method: 'POST' })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Processing failed.')
  }
  return json.data as ProcessResponseData
}

export default function UploadPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [contractType, setContractType] = useState<'nda' | 'msa' | null>(null)
  const [customTerms, setCustomTerms] = useState<string[]>([])

  const processMutation = useMutation({
    mutationFn: processContract,
    onSuccess: (data) => {
      router.push(`/contracts/${data.contractId}`)
    },
    onError: (err: Error) => {
      showToast(err.message, 'error')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: uploadContract,
    onSuccess: (data) => {
      processMutation.mutate(data.id)
    },
    onError: (err: Error) => {
      showToast(err.message, 'error')
    },
  })

  const isSubmitting = uploadMutation.isPending || processMutation.isPending
  const canSubmit = Boolean(file) && Boolean(contractType) && !isSubmitting
  const standardTerms = contractType ? STANDARD_TERMS[contractType] : []

  const handleSubmit = () => {
    if (!file || !contractType) return
    uploadMutation.mutate({ file, contractType, customTerms })
  }

  if (isSubmitting) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-md">
        <Card className="w-full">
          <h1 className="text-h3 text-text-primary">Processing your contract</h1>
          <p className="mt-xs text-body text-text-secondary">This usually takes under 30 seconds.</p>
          <div className="mt-lg">
            <UploadProgress
              step={uploadMutation.isPending ? 'uploading' : 'analyzing'}
              progress={uploadMutation.isPending ? 40 : 80}
            />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-md py-2xl">
      <h1 className="text-h1 text-text-primary">Review a contract</h1>
      <p className="mt-xs text-body text-text-secondary">
        Upload a PDF and we&apos;ll extract the key terms automatically.
      </p>

      <div className="mt-xl flex flex-col gap-xl">
        <section>
          <h2 className="mb-sm text-h4 text-text-primary">1. Contract type</h2>
          <ContractTypeSelector value={contractType} onChange={setContractType} />
        </section>

        <section>
          <h2 className="mb-sm text-h4 text-text-primary">2. Upload PDF</h2>
          <FileDropzone
            onFileSelect={setFile}
            accept="application/pdf"
            maxSize={MAX_FILE_SIZE_BYTES}
            selectedFile={file}
            onClear={() => setFile(null)}
          />
        </section>

        {contractType && (
          <section>
            <h2 className="mb-sm text-h4 text-text-primary">Standard terms to extract</h2>
            <div className="flex flex-wrap gap-xs">
              {standardTerms.map((term) => (
                <span
                  key={term}
                  className="rounded-full bg-surface px-sm py-[2px] text-small text-text-secondary"
                >
                  {term}
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-sm text-h4 text-text-primary">3. Custom terms (optional)</h2>
          <CustomTermInput
            terms={customTerms}
            onAdd={(term) => setCustomTerms((prev) => [...prev, term])}
            onRemove={(index) => setCustomTerms((prev) => prev.filter((_, i) => i !== index))}
            maxTerms={MAX_CUSTOM_TERMS}
          />
        </section>

        {(uploadMutation.isError || processMutation.isError) && (
          <div
            role="alert"
            className="flex items-center gap-sm rounded-input bg-error/10 px-md py-sm text-small text-error"
          >
            <AlertCircle size={16} strokeWidth={1.75} aria-hidden />
            {(uploadMutation.error as Error | null)?.message ??
              (processMutation.error as Error | null)?.message}
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit} isLoading={isSubmitting} className="w-full">
          Process Contract
        </Button>
      </div>
    </div>
  )
}
