// Blocks classic prompt-injection / jailbreak phrasing in user-typed chat
// messages before they reach OpenAI. This only screens the interactive chat
// input — contract text is untrusted by a different mechanism (system-prompt
// framing in lib/prompts/chat.ts and lib/prompts/extraction.ts telling the
// model to treat it as inert data), since rejecting an upload for merely
// containing one of these phrases would break legitimate contracts that
// happen to discuss e.g. "overriding" a prior agreement.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(the\s+)?(above|prior|previous)\s+instructions?/i,
  /disregard\s+(all\s+)?(the\s+)?(above|prior|previous)\s+instructions?/i,
  /override\s+your\s+(rules|guidelines|instructions)/i,
  /reveal\s+(your|the)\s+system\s+prompt/i,
  /print\s+(your|the)\s+(system\s+)?instructions/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
  /expose\s+(the\s+)?(env(ironment)?\s+variables?|api\s+keys?)/i,
  /show\s+(me\s+)?(the\s+|your\s+)?api\s+keys?/i,
  /you\s+are\s+now\s+a\b/i,
  /pretend\s+(you\s+are|to\s+be)\b/i,
  /act\s+as\s+(if\s+you|a\s+jailbroken|an?\s+unrestricted|dan\b)/i,
  /\bjailbreak(ing|ed)?\b/i,
  /\bdan\s+mode\b/i,
  /\bdeveloper\s+mode\b/i,
]

export interface SanitizeResult {
  safe: boolean
  matchedPattern?: string
}

export function sanitizeForLLM(text: string): SanitizeResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, matchedPattern: pattern.source }
    }
  }
  return { safe: true }
}
