const PDF_MAGIC_BYTES = Buffer.from('%PDF-', 'utf-8')

// The browser-supplied `file.type` is attacker-controlled (a direct API
// call can set any Content-Type), so it's checked alongside — not instead
// of — the actual file header.
export function hasValidPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)
}

// Strips directory components and any character outside a safe allowlist
// before the name is used to build a storage path, so a crafted filename
// (e.g. containing `../` or path separators) can't escape the intended
// `{userId}/{contractId}/` prefix.
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? ''
  let cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  cleaned = cleaned.slice(0, 150) || 'contract'
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`
}
