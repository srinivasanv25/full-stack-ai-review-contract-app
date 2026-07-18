import { z } from 'zod'
import { MAX_CUSTOM_TERMS, MAX_CUSTOM_TERM_LENGTH } from '@/lib/constants/config'

export const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type AuthFormValues = z.infer<typeof authSchema>

export const contractTypeSchema = z.enum(['nda', 'msa'])

export const customTermsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Custom term cannot be empty')
      .max(MAX_CUSTOM_TERM_LENGTH, `Custom term must be ${MAX_CUSTOM_TERM_LENGTH} characters or fewer`)
  )
  .max(MAX_CUSTOM_TERMS, `Maximum ${MAX_CUSTOM_TERMS} custom terms allowed.`)
  .refine((terms) => new Set(terms.map((t) => t.toLowerCase())).size === terms.length, {
    message: 'Custom terms must be unique.',
  })

export const updateTermValueSchema = z.object({
  value: z.string().max(2000, 'Value exceeds 2000 character limit.'),
})

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required.')
    .max(2000, 'Message exceeds 2000 character limit.'),
})

export const feedbackSchema = z.object({
  rating: z.enum(['up', 'down'], {
    required_error: 'Rating is required.',
    invalid_type_error: 'Rating is required.',
  }),
  comment: z.string().max(1000, 'Comment exceeds 1000 character limit.').optional(),
})
