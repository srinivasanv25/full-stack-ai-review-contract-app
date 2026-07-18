'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface PDFViewerState {
  pdf: PDFDocumentProxy | null
  currentPage: number
  totalPages: number
  scale: number
  isLoading: boolean
  error: string | null
}

interface PDFViewerActions {
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  reload: () => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 2.0
const DEFAULT_SCALE = 1.0
const ZOOM_STEP = 0.25

export function usePdfViewer(url: string | null): [PDFViewerState, PDFViewerActions] {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!url) {
      setPdf(null)
      setTotalPages(0)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    import('pdfjs-dist')
      .then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        return pdfjsLib.getDocument(url).promise
      })
      .then((doc) => {
        if (cancelled) return
        setPdf(doc)
        setTotalPages(doc.numPages)
        setCurrentPage(1)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load PDF:', err)
        setError('Failed to load PDF document.')
        setPdf(null)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url, reloadToken])

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, page))
  }, [])

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (totalPages > 0 ? Math.min(prev + 1, totalPages) : prev + 1))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }, [])

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, Number((prev + ZOOM_STEP).toFixed(2))))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_SCALE, Number((prev - ZOOM_STEP).toFixed(2))))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(DEFAULT_SCALE)
  }, [])

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1)
  }, [])

  return [
    { pdf, currentPage, totalPages, scale, isLoading, error },
    { goToPage, nextPage, prevPage, zoomIn, zoomOut, resetZoom, reload },
  ]
}
