import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'
import { contractTypeSchema, customTermsSchema } from '@/lib/utils/validation'
import { extractPdfText } from '@/lib/services/pdf'
import { countTokens } from '@/lib/utils/tokens'
import { uploadContractPdf } from '@/lib/services/storage'
import { createContract, insertCustomTermPlaceholders, updateContractFilePath } from '@/lib/services/contracts'
import { checkUploadLimit } from '@/lib/services/rate-limit'
import { hasValidPdfMagicBytes, sanitizeFilename } from '@/lib/security/input-validator'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_PAGES,
  MAX_CONTRACT_TOKENS,
  MIN_WORDS_FOR_TEXT_LAYER,
} from '@/lib/constants/config'

export async function POST(request: Request) {
  try {
    const { userId, supabase } = await requireUser()
    await checkUploadLimit(supabase, userId)

    const formData = await request.formData()

    const contractTypeRaw = formData.get('contractType')
    const contractTypeResult = contractTypeSchema.safeParse(contractTypeRaw)
    if (!contractTypeResult.success) {
      throw new ApiRouteError(400, 'VALIDATION_ERROR', "contractType must be 'nda' or 'msa'.")
    }
    const contractType = contractTypeResult.data

    const file = formData.get('file')
    if (!(file instanceof File) || file.type !== 'application/pdf') {
      throw new ApiRouteError(400, 'VALIDATION_ERROR', 'Invalid file type. Only PDF files are accepted.')
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ApiRouteError(413, 'PAYLOAD_TOO_LARGE', 'File exceeds 10 MB limit.')
    }

    const customTermsRaw = formData.get('customTerms')
    let customTerms: string[] = []
    if (typeof customTermsRaw === 'string' && customTermsRaw.length > 0) {
      let parsed: unknown
      try {
        parsed = JSON.parse(customTermsRaw)
      } catch {
        throw new ApiRouteError(400, 'VALIDATION_ERROR', 'customTerms must be a JSON array of strings.')
      }
      const customTermsResult = customTermsSchema.safeParse(parsed)
      if (!customTermsResult.success) {
        throw new ApiRouteError(
          400,
          'VALIDATION_ERROR',
          customTermsResult.error.issues[0]?.message ?? 'Maximum 5 custom terms allowed.'
        )
      }
      customTerms = customTermsResult.data
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasValidPdfMagicBytes(buffer)) {
      throw new ApiRouteError(400, 'VALIDATION_ERROR', 'Invalid file type. Only PDF files are accepted.')
    }

    const extracted = await extractPdfText(buffer)

    if (extracted.pageCount > MAX_PAGES) {
      throw new ApiRouteError(400, 'VALIDATION_ERROR', 'Contract exceeds 20 page limit.')
    }
    if (extracted.wordCount < MIN_WORDS_FOR_TEXT_LAYER) {
      throw new ApiRouteError(
        422,
        'VALIDATION_ERROR',
        'Unable to extract text. Scanned PDFs are not supported.'
      )
    }

    const tokenCount = countTokens(extracted.text)
    if (tokenCount > MAX_CONTRACT_TOKENS) {
      throw new ApiRouteError(400, 'VALIDATION_ERROR', 'Contract exceeds 15,000 token limit.')
    }

    const contract = await createContract(supabase, {
      userId,
      name: file.name,
      type: contractType,
      contractText: extracted.text,
      filePath: null,
    })

    const { path } = await uploadContractPdf(supabase, userId, contract.id, sanitizeFilename(file.name), buffer)
    if (path) {
      await updateContractFilePath(supabase, contract.id, path)
    }

    if (customTerms.length > 0) {
      await insertCustomTermPlaceholders(supabase, contract.id, customTerms)
    }

    return Response.json(
      {
        data: {
          id: contract.id,
          name: contract.name,
          type: contract.type,
          status: contract.status,
          pageCount: extracted.pageCount,
          tokenCount,
          createdAt: contract.created_at,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
