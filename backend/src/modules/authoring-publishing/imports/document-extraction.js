import { Worker } from 'node:worker_threads'
import { HttpError } from '../../../middleware/errors.js'

let running = 0
const messages = {
  invalid_document: 'Tệp hỏng, được bảo vệ hoặc không đúng định dạng đã chọn.',
  invalid_encoding: 'Hãy lưu văn bản bằng UTF-8 hoặc UTF-16 rồi thử lại.',
  empty_document: 'Tài liệu không có văn bản.',
  document_too_long: 'Tối đa 100 trang PDF và 200.000 ký tự mỗi lần nhập.',
  pdf_no_text:
    'PDF có trang không chứa lớp văn bản. Hãy chuyển sang tài liệu văn bản trước khi nhập.',
  unsupported_markdown:
    'Markdown chứa HTML hoặc hình ảnh chưa được hỗ trợ. Hãy chuyển sang văn bản thuần.',
}
export async function extractDocument(buffer, format, { signal, timeout = 15000 } = {}) {
  if (running >= 2) {
    buffer.fill(0)
    throw new HttpError(429, 'import_busy', 'Máy chủ đang phân tích tài liệu khác. Hãy thử lại.')
  }
  if (signal?.aborted) {
    buffer.fill(0)
    throw new HttpError(400, 'import_cancelled', 'Đã hủy phân tích.')
  }
  running++
  let worker
  let timer
  let abort
  try {
    const bytes = Uint8Array.from(buffer)
    worker = new Worker(new URL('./document-extraction.worker.js', import.meta.url), {
      workerData: { bytes: bytes.buffer, format },
      transferList: [bytes.buffer],
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    })
    return await new Promise((resolve, reject) => {
      abort = () => reject(new HttpError(400, 'import_cancelled', 'Đã hủy phân tích.'))
      signal?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(
        () =>
          reject(
            new HttpError(422, 'import_timeout', 'Phân tích quá thời gian. Hãy chia nhỏ tài liệu.'),
          ),
        timeout,
      )
      worker.once('message', ({ result, error }) =>
        error ? reject(new HttpError(422, error, messages[error])) : resolve(result),
      )
      worker.once('error', () =>
        reject(new HttpError(422, 'invalid_document', messages.invalid_document)),
      )
      worker.once('exit', code => {
        if (code !== 0) reject(new HttpError(422, 'invalid_document', messages.invalid_document))
      })
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    await worker?.terminate()
    buffer.fill(0)
    running--
  }
}
