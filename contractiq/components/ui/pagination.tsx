import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

function getPageNumbers(current: number, total: number): number[] {
  const window = 1
  const pages = new Set<number>([1, total])
  for (let p = current - window; p <= current + window; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  return Array.from(pages).sort((a, b) => a - b)
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-xs">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
        className="flex h-9 w-9 items-center justify-center rounded-input text-text-secondary hover:bg-background-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={18} strokeWidth={1.75} />
      </button>

      {pages.map((page, index) => {
        const prevPage = pages[index - 1]
        const showEllipsis = prevPage !== undefined && page - prevPage > 1
        return (
          <span key={page} className="flex items-center gap-xs">
            {showEllipsis && <span className="px-xs text-text-muted">&hellip;</span>}
            <button
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-input text-small font-medium ${
                page === currentPage
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-background-subtle'
              }`}
            >
              {page}
            </button>
          </span>
        )
      })}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
        className="flex h-9 w-9 items-center justify-center rounded-input text-text-secondary hover:bg-background-subtle disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={18} strokeWidth={1.75} />
      </button>
    </nav>
  )
}
