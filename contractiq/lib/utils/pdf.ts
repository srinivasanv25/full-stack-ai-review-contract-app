export interface ParsedPage {
  page: number
  content: string
}

export function parsePagesFromMarkedText(text: string): ParsedPage[] {
  const markerPattern = /\[PAGE (\d+)\]/g
  const markers = Array.from(text.matchAll(markerPattern))

  if (markers.length === 0) {
    return text.trim().length > 0 ? [{ page: 1, content: text.trim() }] : []
  }

  return markers.map((marker, index) => {
    const page = Number(marker[1])
    const contentStart = (marker.index ?? 0) + marker[0].length
    const contentEnd = index + 1 < markers.length ? (markers[index + 1].index ?? text.length) : text.length
    return { page, content: text.slice(contentStart, contentEnd).trim() }
  })
}
