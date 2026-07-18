import { requireUser } from '@/lib/supabase/route-auth'
import { ApiRouteError, handleRouteError } from '@/lib/utils/errors'

const SORT_COLUMNS = new Set(['created_at', 'name', 'type'])

export async function GET(request: Request) {
  try {
    const { userId, supabase } = await requireUser()
    const url = new URL(request.url)

    const pageParam = Number(url.searchParams.get('page') ?? '1')
    const limitParam = Number(url.searchParams.get('limit') ?? '20')
    const sortParam = url.searchParams.get('sort') ?? 'created_at'
    const orderParam = url.searchParams.get('order') ?? 'desc'

    const requestedPage = Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 100) : 20
    const sort = SORT_COLUMNS.has(sortParam) ? sortParam : 'created_at'
    const order: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc'

    const { count: total, error: totalError } = await supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (totalError) {
      throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to load contracts.')
    }

    const totalCount = total ?? 0
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))
    const page = Math.min(requestedPage, totalPages)

    const [ndaResult, msaResult, contractsResult] = await Promise.all([
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'nda'),
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'msa'),
      supabase
        .from('contracts')
        .select('id, name, type, status, created_at')
        .eq('user_id', userId)
        .order(sort, { ascending: order === 'asc' })
        .range((page - 1) * limit, (page - 1) * limit + limit - 1),
    ])

    if (contractsResult.error) {
      throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to load contracts.')
    }

    return Response.json({
      data: {
        stats: {
          totalContracts: totalCount,
          ndaCount: ndaResult.count ?? 0,
          msaCount: msaResult.count ?? 0,
        },
        contracts: (contractsResult.data ?? []).map((contract) => ({
          id: contract.id,
          name: contract.name,
          type: contract.type,
          status: contract.status,
          createdAt: contract.created_at,
        })),
      },
      meta: {
        pagination: { page, limit, total: totalCount },
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
