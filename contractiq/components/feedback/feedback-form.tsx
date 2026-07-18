'use client'

import { useState } from 'react'
import { RatingButtons } from './rating-buttons'
import { Button } from '@/components/ui/button'

const MAX_COMMENT_LENGTH = 1000

interface FeedbackFormProps {
  existingFeedback: { rating: 'up' | 'down'; comment: string | null } | null
  onSubmit: (feedback: { rating: 'up' | 'down'; comment: string | null }) => void
  isSubmitting?: boolean
}

export function FeedbackForm({ existingFeedback, onSubmit, isSubmitting = false }: FeedbackFormProps) {
  const [rating, setRating] = useState<'up' | 'down' | null>(existingFeedback?.rating ?? null)
  const [comment, setComment] = useState(existingFeedback?.comment ?? '')
  const [justSubmitted, setJustSubmitted] = useState(false)

  const commentTooLong = comment.length > MAX_COMMENT_LENGTH

  const handleRatingChange = (value: 'up' | 'down') => {
    setRating(value)
    setJustSubmitted(false)
  }

  const handleSubmit = () => {
    if (!rating || commentTooLong) return
    onSubmit({ rating, comment: comment.trim().length > 0 ? comment.trim() : null })
    setJustSubmitted(true)
  }

  return (
    <div className="flex flex-col items-center gap-md text-center">
      <p className="text-body font-medium text-text-primary">Was this extraction helpful?</p>
      <RatingButtons value={rating} onChange={handleRatingChange} disabled={isSubmitting} />

      {rating && (
        <div className="w-full max-w-md text-left">
          <textarea
            value={comment}
            onChange={(event) => {
              setComment(event.target.value)
              setJustSubmitted(false)
            }}
            placeholder="Any additional comments? (optional)"
            rows={3}
            disabled={isSubmitting}
            className="w-full rounded-input border border-border-strong bg-elevated-surface px-md py-sm text-body text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-xs flex items-center justify-between">
            <p className={`text-small ${commentTooLong ? 'text-error' : 'text-text-muted'}`}>
              {comment.length} / {MAX_COMMENT_LENGTH}
            </p>
            <Button size="sm" onClick={handleSubmit} disabled={commentTooLong} isLoading={isSubmitting}>
              {existingFeedback ? 'Update feedback' : 'Submit'}
            </Button>
          </div>
          {justSubmitted && !isSubmitting && (
            <p className="mt-sm text-small font-medium text-success">
              Thanks for your feedback!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
