// A classified evidence-stage failure. Retryable failures get another attempt; others go to manual review.
export class StageError extends Error {
  constructor(code, { retryable = false, metadata, cause } = {}) {
    super(code, cause ? { cause } : undefined)
    this.name = 'StageError'
    this.code = code
    this.retryable = retryable
    this.metadata = metadata
  }
}
