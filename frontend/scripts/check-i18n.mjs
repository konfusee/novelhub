import { readFileSync } from 'node:fs'

const locales = ['en', 'vi']
const dictionaries = Object.fromEntries(locales.map(locale => [
  locale,
  JSON.parse(readFileSync(new URL(`../src/locales/${locale}.json`, import.meta.url), 'utf8')),
]))

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return nested && typeof nested === 'object' ? flatten(nested, path) : [path]
  })
}

const reference = new Set(flatten(dictionaries.en))
let failed = false
for (const locale of locales) {
  const keys = new Set(flatten(dictionaries[locale]))
  const missing = [...reference].filter(key => !keys.has(key))
  const extra = [...keys].filter(key => !reference.has(key))
  if (missing.length || extra.length) {
    failed = true
    console.error(`${locale}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`)
  }
}

if (failed) process.exit(1)
console.log(`i18n dictionaries are synchronized (${reference.size} keys across ${locales.length} locales).`)
