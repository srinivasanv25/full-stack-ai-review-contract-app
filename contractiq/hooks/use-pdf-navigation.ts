'use client'

import { useState, useCallback } from 'react'

export function usePdfNavigation() {
  const [targetPage, setTargetPage] = useState<number | null>(null)

  const scrollToPage = useCallback((page: number) => {
    setTargetPage(page)
  }, [])

  const onPageScrollComplete = useCallback(() => {
    setTargetPage(null)
  }, [])

  return { targetPage, scrollToPage, onPageScrollComplete }
}
