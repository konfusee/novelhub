import { createOpenAIProvider } from './openai-provider.js'
import { createSimilaritySearch } from './similarity-search.js'
import { StageError } from './stage-error.js'

const unconfigured = async () => {
  throw new StageError('provider-unconfigured')
}
// Test doubles in config.ai win; the real client exists only with an explicit key.
export function resolveAiProviders(ai) {
  const openai = ai.openai ? createOpenAIProvider(ai) : null
  return {
    embed: ai.embed ?? openai?.embed ?? unconfigured,
    review: ai.review ?? openai?.review ?? unconfigured,
    findSimilar: ai.findSimilar ?? createSimilaritySearch(ai).findSimilar,
  }
}
