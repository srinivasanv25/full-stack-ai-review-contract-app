// Hand-written to match docs/specs/supabase-schema.sql. Keep in sync with
// that file if the schema changes — regenerate with `supabase gen types`
// once a live project exists, if preferred.

export type ContractType = 'nda' | 'msa'
export type ContractStatus = 'uploaded' | 'processing' | 'processed' | 'error'
export type ChatRole = 'user' | 'assistant'
export type ChatSource = 'contract' | 'history' | 'both'
export type FeedbackRating = 'up' | 'down'

export interface Database {
  public: {
    Tables: {
      contracts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: ContractType
          contract_text: string | null
          file_path: string | null
          status: ContractStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: ContractType
          contract_text?: string | null
          file_path?: string | null
          status?: ContractStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: ContractType
          contract_text?: string | null
          file_path?: string | null
          status?: ContractStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      key_terms: {
        Row: {
          id: string
          contract_id: string
          term_name: string
          value: string | null
          page_number: number | null
          confidence_score: number | null
          source_sentence: string | null
          is_edited: boolean
          original_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          term_name: string
          value?: string | null
          page_number?: number | null
          confidence_score?: number | null
          source_sentence?: string | null
          is_edited?: boolean
          original_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          term_name?: string
          value?: string | null
          page_number?: number | null
          confidence_score?: number | null
          source_sentence?: string | null
          is_edited?: boolean
          original_value?: string | null
          created_at?: string
        }
        Relationships: []
      }
      custom_key_terms: {
        Row: {
          id: string
          contract_id: string
          term_name: string
          value: string | null
          page_number: number | null
          confidence_score: number | null
          source_sentence: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          term_name: string
          value?: string | null
          page_number?: number | null
          confidence_score?: number | null
          source_sentence?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          term_name?: string
          value?: string | null
          page_number?: number | null
          confidence_score?: number | null
          source_sentence?: string | null
          created_at?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          id: string
          contract_id: string
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          created_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: ChatRole
          content: string
          page_citation: number | null
          source: ChatSource | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: ChatRole
          content: string
          page_citation?: number | null
          source?: ChatSource | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: ChatRole
          content?: string
          page_citation?: number | null
          source?: ChatSource | null
          created_at?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          id: string
          user_id: string
          contract_id: string
          rating: FeedbackRating
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contract_id: string
          rating: FeedbackRating
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contract_id?: string
          rating?: FeedbackRating
          comment?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
