import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'
import { getSignedContractUrl } from '@/lib/services/storage'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId, supabase } = await requireUser()

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Contract not found.')
    }

    const [keyTermsResult, customKeyTermsResult, feedbackResult] = await Promise.all([
      supabase
        .from('key_terms')
        .select('*')
        .eq('contract_id', contract.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('custom_key_terms')
        .select('*')
        .eq('contract_id', contract.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('user_feedback')
        .select('rating, comment')
        .eq('contract_id', contract.id)
        .maybeSingle(),
    ])

    if (keyTermsResult.error || customKeyTermsResult.error) {
      throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to load key terms.')
    }

    const fileUrl = contract.file_path
      ? await getSignedContractUrl(supabase, contract.file_path)
      : null

    return Response.json({
      data: {
        id: contract.id,
        name: contract.name,
        type: contract.type,
        status: contract.status,
        fileUrl,
        contractText: contract.contract_text ?? '',
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
        keyTerms: (keyTermsResult.data ?? []).map((term) => ({
          id: term.id,
          termName: term.term_name,
          value: term.value,
          pageNumber: term.page_number,
          confidenceScore: term.confidence_score,
          sourceSentence: term.source_sentence,
          isEdited: term.is_edited,
        })),
        customKeyTerms: (customKeyTermsResult.data ?? []).map((term) => ({
          id: term.id,
          termName: term.term_name,
          value: term.value,
          pageNumber: term.page_number,
          confidenceScore: term.confidence_score,
          sourceSentence: term.source_sentence,
          isEdited: false,
        })),
        userFeedback: feedbackResult.data
          ? { rating: feedbackResult.data.rating, comment: feedbackResult.data.comment }
          : null,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
