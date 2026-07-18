import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'
import { feedbackSchema } from '@/lib/utils/validation'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { userId, supabase } = await requireUser()

    const body = await request.json().catch(() => null)
    const result = feedbackSchema.safeParse(body)
    if (!result.success) {
      throw new ApiRouteError(
        400,
        'VALIDATION_ERROR',
        result.error.issues[0]?.message ?? 'Rating is required.'
      )
    }
    const { rating, comment } = result.data

    // user_feedback's RLS only checks auth.uid() = user_id, not contract
    // ownership — this ownership check is what actually enforces that a
    // caller can only attach feedback to a contract they own.
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Contract not found.')
    }

    const { data: feedback, error: upsertError } = await supabase
      .from('user_feedback')
      .upsert(
        { user_id: userId, contract_id: contract.id, rating, comment: comment ?? null },
        { onConflict: 'user_id,contract_id' }
      )
      .select()
      .single()

    if (upsertError || !feedback) {
      throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to save feedback.')
    }

    return Response.json(
      {
        data: {
          id: feedback.id,
          rating: feedback.rating,
          comment: feedback.comment,
          createdAt: feedback.created_at,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
