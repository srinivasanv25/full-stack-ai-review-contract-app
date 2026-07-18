'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, RotateCcw } from 'lucide-react'
import { usePdfViewer } from '@/hooks/use-pdf-viewer'
import { Skeleton } from '@/components/ui/skeleton'

interface PDFViewerProps {
  url: string | null
  targetPage: number | null
  onPageChange: (page: number) => void
  onError: (error: string) => void
}

const PAGE_ASPECT_RATIO_FALLBACK = 0.773 // US Letter portrait, width/height

function PdfPageCanvas({
  pdf,
  pageNumber,
  scale,
  isHighlighted,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  isHighlighted: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isVisible, setIsVisible] = useState(pageNumber === 1)
  const [aspectRatio, setAspectRatio] = useState(PAGE_ASPECT_RATIO_FALLBACK)

  useEffect(() => {
    const node = containerRef.current
    if (!node || isVisible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setIsVisible(true)
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    let cancelled = false

    pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      setAspectRatio(viewport.width / viewport.height)
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: context, viewport }).promise
    })

    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, scale, isVisible])

  return (
    <div
      id={`page-${pageNumber}`}
      ref={containerRef}
      className={`mx-auto mb-md flex justify-center rounded-input transition-shadow duration-300 ${
        isHighlighted ? 'ring-4 ring-warning' : ''
      }`}
    >
      {isVisible ? (
        <canvas ref={canvasRef} className="max-w-full rounded-input shadow-sm" />
      ) : (
        <Skeleton className="w-full" style={{ aspectRatio }} />
      )}
    </div>
  )
}

export function PDFViewer({ url, targetPage, onPageChange, onError }: PDFViewerProps) {
  const [
    { pdf, currentPage, totalPages, scale, isLoading, error },
    { goToPage, nextPage, prevPage, zoomIn, zoomOut, resetZoom, reload },
  ] = usePdfViewer(url)
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null)
  const [pageInput, setPageInput] = useState('1')

  useEffect(() => {
    if (error) onError(error)
  }, [error, onError])

  // External navigation request (e.g. clicking a key term's page badge).
  useEffect(() => {
    if (targetPage === null || !pdf) return
    goToPage(targetPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPage, pdf])

  // Scroll to whichever page is current, whether set by prev/next, direct
  // input, or the external targetPage navigation above.
  useEffect(() => {
    if (!pdf || totalPages === 0) return
    const clamped = Math.min(Math.max(currentPage, 1), totalPages)
    const el = document.getElementById(`page-${clamped}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPageInput(String(clamped))
    setHighlightedPage(clamped)
    const timeout = setTimeout(() => setHighlightedPage(null), 1500)
    onPageChange(clamped)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pdf, totalPages])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-sm p-md">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="w-full flex-1" style={{ aspectRatio: PAGE_ASPECT_RATIO_FALLBACK }} />
      </div>
    )
  }

  if (error || !pdf) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-sm p-lg text-center">
        <p className="text-body text-error">{error ?? 'Unable to load PDF.'}</p>
        <button
          type="button"
          onClick={reload}
          className="flex items-center gap-xs rounded-input bg-primary px-md py-sm text-small font-semibold text-white hover:bg-primary-hover"
        >
          <RotateCcw size={14} strokeWidth={2} aria-hidden />
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-sm border-b border-border px-md py-sm">
        <div className="flex items-center gap-xs">
          <button
            type="button"
            onClick={prevPage}
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
            onBlur={() => goToPage(Number(pageInput) || 1)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') goToPage(Number(pageInput) || 1)
            }}
            aria-label="Page number"
            className="h-8 w-12 rounded-input border border-border-strong bg-elevated-surface text-center text-small text-text-primary"
          />
          <span className="text-small text-text-muted">of {totalPages}</span>
          <button
            type="button"
            onClick={nextPage}
            aria-label="Next page"
            className="text-text-secondary hover:text-primary"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={zoomOut}
            aria-label="Zoom out"
            className="text-text-secondary hover:text-primary"
          >
            <ZoomOut size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="w-12 text-center text-small text-text-secondary hover:text-primary"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            aria-label="Zoom in"
            className="text-text-secondary hover:text-primary"
          >
            <ZoomIn size={18} strokeWidth={1.75} />
          </button>
          <a
            href={url ?? undefined}
            download
            aria-label="Download PDF"
            className="text-text-secondary hover:text-primary"
          >
            <Download size={18} strokeWidth={1.75} />
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background-subtle p-md">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
          <PdfPageCanvas
            key={pageNumber}
            pdf={pdf}
            pageNumber={pageNumber}
            scale={scale}
            isHighlighted={highlightedPage === pageNumber}
          />
        ))}
      </div>
    </div>
  )
}
