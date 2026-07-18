export interface KeyTerm {
  id: string
  termName: string
  value: string | null
  pageNumber: number | null
  confidenceScore: number | null
  sourceSentence: string | null
  isEdited: boolean
}

export interface UserFeedback {
  rating: 'up' | 'down'
  comment: string | null
}

export type ChatContextType = 'contract' | 'history' | 'both'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pageCitation: number | null
  source: ChatContextType | null
  createdAt: string
}

export interface DashboardContract {
  id: string
  name: string
  type: 'nda' | 'msa'
  status: 'uploaded' | 'processing' | 'processed' | 'error'
  createdAt: string
}

export interface ContractDetail {
  id: string
  name: string
  type: 'nda' | 'msa'
  status: 'uploaded' | 'processing' | 'processed' | 'error'
  fileUrl: string | null
  contractText: string
  createdAt: string
  updatedAt: string
  keyTerms: KeyTerm[]
  customKeyTerms: KeyTerm[]
  userFeedback: UserFeedback | null
}
