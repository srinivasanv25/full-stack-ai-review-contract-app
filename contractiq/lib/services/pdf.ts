import pdf from 'pdf-parse'

export interface ExtractedPdf {
  text: string // full text with `[PAGE N]` markers inserted before each page's content
  pageCount: number
  wordCount: number // whitespace-split word count, used to detect scanned PDFs
}

interface PdfTextItem {
  str: string
  transform: number[]
}

interface PdfJsPage {
  pageNumber: number
  getTextContent: (options: {
    normalizeWhitespace: boolean
    disableCombineTextItems: boolean
  }) => Promise<{ items: Array<PdfTextItem | Record<string, unknown>> }>
}

async function renderPageWithPageMarker(pageData: PdfJsPage): Promise<string> {
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  })

  let lastY: number | undefined
  let text = ''
  for (const item of textContent.items) {
    if (!('str' in item)) continue
    const { str, transform } = item as PdfTextItem
    if (lastY === transform[5] || lastY === undefined) {
      text += str
    } else {
      text += '\n' + str
    }
    lastY = transform[5]
  }

  return `\n[PAGE ${pageData.pageNumber}]\n${text}`
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const data = await pdf(buffer, { pagerender: renderPageWithPageMarker })
  const trimmed = data.text.trim()
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length

  return {
    text: data.text,
    pageCount: data.numpages,
    wordCount,
  }
}
