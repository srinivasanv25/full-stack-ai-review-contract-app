import type { Database } from '@/types/database'
import type { AppSupabaseClient } from '@/lib/supabase/server'
import { ApiRouteError } from '@/lib/utils/errors'

type Contract = Database['public']['Tables']['contracts']['Row']
type ContractStatus = Contract['status']

export async function createContract(
  supabase: AppSupabaseClient,
  input: {
    userId: string
    name: string
    type: 'nda' | 'msa'
    contractText: string
    filePath: string | null
  }
): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      user_id: input.userId,
      name: input.name,
      type: input.type,
      contract_text: input.contractText,
      file_path: input.filePath,
      status: 'uploaded',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('createContract failed:', error)
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to create contract record.')
  }

  return data
}

export async function insertCustomTermPlaceholders(
  supabase: AppSupabaseClient,
  contractId: string,
  termNames: string[]
): Promise<void> {
  if (termNames.length === 0) return

  const { error } = await supabase
    .from('custom_key_terms')
    .insert(termNames.map((term_name) => ({ contract_id: contractId, term_name })))

  if (error) {
    console.error('insertCustomTermPlaceholders failed:', error)
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to save custom terms.')
  }
}

export async function updateContractStatus(
  supabase: AppSupabaseClient,
  contractId: string,
  status: ContractStatus
): Promise<void> {
  const { error } = await supabase.from('contracts').update({ status }).eq('id', contractId)

  if (error) {
    console.error('updateContractStatus failed:', error)
    throw new ApiRouteError(500, 'INTERNAL_ERROR', 'Failed to update contract status.')
  }
}

export async function updateContractFilePath(
  supabase: AppSupabaseClient,
  contractId: string,
  filePath: string
): Promise<void> {
  const { error } = await supabase.from('contracts').update({ file_path: filePath }).eq('id', contractId)

  if (error) {
    // Non-fatal: the contract still works via the text-viewer fallback.
    console.error('updateContractFilePath failed:', error)
  }
}
