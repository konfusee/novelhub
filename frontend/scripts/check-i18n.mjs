import { readFileSync } from 'node:fs'

const dictionary = JSON.parse(
  readFileSync(new URL('../src/locales/vi.json', import.meta.url), 'utf8'),
)

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return nested && typeof nested === 'object' ? flatten(nested, path) : [path]
  })
}

const keys = new Set(flatten(dictionary))
if (!keys.size) {
  console.error('Từ điển tiếng Việt đang trống.')
  process.exit(1)
}
console.log(`Nguồn nội dung tiếng Việt hợp lệ (${keys.size} khóa).`)
