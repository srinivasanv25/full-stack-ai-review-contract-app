'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parsePagesFromMarkedText } from '@/lib/utils/pdf'

interface TextViewerProps {
  text: string
  targetPage: number | null
  onPageChange: (page: number) => void
}

export function TextViewer({ text, targetPage, onPageChange }: TextViewerProps) {
  const pages = parsePagesFromMarkedText(text)
  const totalPages = pages.length
  const [currentPage, setCurrentPage] = useState(pages[0]?.page ?? 1)
  const [pageInput, setPageInput] = useState(String(pages[0]?.page ?? 1))
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null)

  const scrollToPage = (page: number) => {
    const el = document.getElementById(`page-${page}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCurrentPage(page)
    setPageInput(String(page))
    setHighlightedPage(page)
    onPageChange(page)
    setTimeout(() => setHighlightedPage(null), 1500)
  }

  useEffect(() => {
    if (targetPage === null || pages.length === 0) return
    const exists = pages.some((p) => p.page === targetPage)
    const clamped = exists ? targetPage : (pages[totalPages - 1]?.page ?? targetPage)
    scrollToPage(clamped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPage])

  const goToPageIndex = (delta: number) => {
    const currentIndex = pages.findIndex((p) => p.page === currentPage)
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), totalPages - 1)
    const nextPage = pages[nextIndex]?.page
    if (nextPage !== undefined) scrollToPage(nextPage)
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-lg text-center text-body text-text-muted">
        No text content available for this contract.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-border px-md py-sm">
        <div className="flex items-center gap-xs">
          <button
            type="button"
            onClick={() => goToPageIndex(-1)}
            aria-label="Previous page"
            className="text-text-secondary hover:text-primary"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={() => scrollToPage(Number(pageInput) || pages[0].page)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') scrollToPage(Number(pageInput) || pages[0].page)
            }}
            aria-label="Page number"
            className="h-8 w-12 rounded-input border border-border-strong bg-elevated-surface text-center text-small text-text-primary"
          />
          <span className="text-small text-text-muted">of {totalPages}</span>
          <button
            type="button"
            onClick={() => goToPageIndex(1)}
            aria-label="Next page"
            className="text-text-secondary hover:text-primary"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p className="text-small text-text-muted">Text view (PDF preview unavailable)</p>
      </div>

      <div className="flex-1 overflow-y-auto bg-background-subtle p-md">
        {pages.map(({ page, content }) => (
          <section
            key={page}
            id={`page-${page}`}
            className={`mx-auto mb-md max-w-2xl rounded-input bg-elevated-surface p-lg shadow-sm transition-shadow duration-300 ${
              highlightedPage === page ? 'ring-4 ring-warning' : ''
            }`}
          >
            <p className="mb-sm text-small font-semibold text-text-muted">Page {page}</p>
            <p className="whitespace-pre-wrap text-body text-text-secondary">{content}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
