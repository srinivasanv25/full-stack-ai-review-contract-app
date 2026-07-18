import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'
import { updateTermValueSchema } from '@/lib/utils/validation'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; termId: string } }
) {
  try {
    const { userId, supabase } = await requireUser()

    const body = await request.json().catch(() => null)
    const result = updateTermValueSchema.safeParse(body)
    if (!result.success) {
      throw new ApiRouteError(
        400,
        'VALIDATION_ERROR',
        result.error.issues[0]?.message ?? 'Invalid value.'
      )
    }
    const { value } = result.data

    // key_terms has no user_id column — ownership only flows through the
    // parent contract, so it must be checked explicitly here rather than
    // relying solely on the join-based RLS policy.
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Contract not found.')
    }

    const { data: term, error: termError } = await supabase
      .from('key_terms')
      .select('*')
      .eq('id', params.termId)
      .eq('contract_id', params.id)
      .single()

    if (termError || !term) {
      throw new ApiRouteError(404, 'NOT_FOUND', 'Term not found.')
    }

    const originalValue = term.is_edited ? term.original_value : term.value

    const { data: updated, error: updateError } = await supabase
      .from('key_terms')
      .update({ value, is_edited: true, original_value: originalValue })
      .eq('id', term.id)
      .select()
      .single()

    if (updateError || !updated) {
      throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to update term.')
    }

    return Response.json({
      data: {
        id: updated.id,
        termName: updated.term_name,
        value: updated.value,
        isEdited: true as const,
        originalValue: updated.original_value ?? '',
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
