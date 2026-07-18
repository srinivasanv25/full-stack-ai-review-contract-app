import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'
import { checkExtractionLimit } from '@/lib/services/rate-limit'
import { updateContractStatus } from '@/lib/services/contracts'
import { extractKeyTerms } from '@/lib/services/openai'
import { STANDARD_TERMS } from '@/lib/constants/terms'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId, supabase } = await requireUser()
    await checkExtractionLimit(supabase, userId)

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, type, status, contract_text')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Contract not found.')
    }
    if (contract.status === 'processing') {
      throw new ApiRouteError(409, 'CONFLICT', 'Contract is already being processed.')
    }
    if (contract.status === 'processed') {
      throw new ApiRouteError(409, 'CONFLICT', 'Contract has already been processed.')
    }

    await updateContractStatus(supabase, contract.id, 'processing')
    const startTime = Date.now()

    try {
      const { data: customTermRows, error: customTermsError } = await supabase
        .from('custom_key_terms')
        .select('term_name')
        .eq('contract_id', contract.id)

      if (customTermsError) {
        throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to load custom terms.')
      }

      const customTermNames = (customTermRows ?? []).map((row) => row.term_name)
      const standardTermNames = STANDARD_TERMS[contract.type]

      const extracted = await extractKeyTerms({
        contractType: contract.type,
        contractText: contract.contract_text ?? '',
        standardTerms: standardTermNames,
        customTerms: customTermNames,
      })

      const standardTermSet = new Set(standardTermNames)
      const customTermSet = new Set(customTermNames)

      const validExtracted = extracted.filter((term) => {
        if (term.page_number <= 0) {
          console.warn(`Dropping term "${term.term_name}" with invalid page_number`, term.page_number)
          return false
        }
        return true
      })

      const standardRows = validExtracted
        .filter((term) => standardTermSet.has(term.term_name))
        .map((term) => ({
          contract_id: contract.id,
          term_name: term.term_name,
          value: term.value,
          page_number: term.page_number,
          confidence_score: term.confidence_score,
          source_sentence: term.source_sentence,
        }))

      if (standardRows.length > 0) {
        const { error: insertError } = await supabase.from('key_terms').insert(standardRows)
        if (insertError) {
          throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to save extracted terms.')
        }
      }

      const customResults = validExtracted.filter((term) => customTermSet.has(term.term_name))

      for (const term of customResults) {
        const { error: updateError } = await supabase
          .from('custom_key_terms')
          .update({
            value: term.value,
            page_number: term.page_number,
            confidence_score: term.confidence_score,
            source_sentence: term.source_sentence,
          })
          .eq('contract_id', contract.id)
          .eq('term_name', term.term_name)

        if (updateError) {
          console.error('Failed to update custom term result:', updateError)
        }
      }

      await updateContractStatus(supabase, contract.id, 'processed')

      return Response.json({
        data: {
          contractId: contract.id,
          status: 'processed' as const,
          termsExtracted: standardRows.length + customResults.length,
          processingTimeMs: Date.now() - startTime,
        },
      })
    } catch (err) {
      await updateContractStatus(supabase, contract.id, 'error')
      throw err
    }
  } catch (err) {
    return handleRouteError(err)
  }
}
