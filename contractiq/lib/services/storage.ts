import type { AppSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'contracts'

// Path convention: {user_id}/{contract_id}/{filename}.pdf within the
// `contracts` bucket — the storage RLS policies key off the first path
// segment being the caller's own user id.
export async function uploadContractPdf(
  supabase: AppSupabaseClient,
  userId: string,
  contractId: string,
  filename: string,
  buffer: Buffer
): Promise<{ path: string | null; error: string | null }> {
  const path = `${userId}/${contractId}/${filename}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  })

  if (error) {
    console.error('uploadContractPdf failed:', error)
    return { path: null, error: error.message }
  }

  return { path, error: null }
}

export async function getSignedContractUrl(
  supabase: AppSupabaseClient,
  filePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds)

  if (error || !data) {
    console.error('getSignedContractUrl failed:', error)
    return null
  }

  return data.signedUrl
}
