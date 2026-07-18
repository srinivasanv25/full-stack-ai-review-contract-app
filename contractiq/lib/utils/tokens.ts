// Approximates OpenAI's tokenizer without pulling in a tokenizer dependency:
// ~4 characters per token is a standard heuristic for English prose.
export function countTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
