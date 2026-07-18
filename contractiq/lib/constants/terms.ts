export const NDA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Term Duration',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Return/Destruction of Information',
  'Governing Law',
  'Remedies for Breach',
]

export const MSA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Term Duration',
  'Payment Terms',
  'Liability Cap',
  'Termination Clause',
  'Auto-Renewal Clause',
  'Governing Law',
  'IP Assignment',
  'Non-Compete',
]

export const STANDARD_TERMS: Record<'nda' | 'msa', string[]> = {
  nda: NDA_STANDARD_TERMS,
  msa: MSA_STANDARD_TERMS,
}
