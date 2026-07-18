import { ApiRouteError } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new ApiRouteError(401, 'UNAUTHORIZED', 'Authentication required.')
  }

  return { userId: user.id, supabase }
}
