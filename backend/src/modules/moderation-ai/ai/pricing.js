// USD per 1M tokens (research/researcher-01-openai.md lines 7-8 and 95-98).
// A model missing here has no price, and the worker refuses to call it.
export const PRICES_PER_MILLION = {
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-5-mini': { input: 0.25, output: 2 },
}
export const priceFor = model =>
  Object.hasOwn(PRICES_PER_MILLION, model) ? PRICES_PER_MILLION[model] : null
// Conservative for Vietnamese: two characters per token.
export const estimateTokens = chars => Math.ceil(chars / 2)
export function costUsd(model, usage) {
  const price = priceFor(model)
  if (!price) return null
  const input = usage?.input_tokens ?? usage?.prompt_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  return (input * price.input + output * price.output) / 1e6
}
