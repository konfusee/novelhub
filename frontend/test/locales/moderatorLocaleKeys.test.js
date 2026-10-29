// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import dictionary from '../../src/locales/vi.json'

const pagesDir = new URL('../../src/pages/moderator/', import.meta.url)
const lookup = key => key.split('.').reduce((node, part) => node?.[part], dictionary)
const usedKeys = () =>
  readdirSync(pagesDir)
    .filter(name => /\.(js|jsx)$/.test(name))
    .flatMap(name =>
      [
        ...readFileSync(new URL(name, pagesDir), 'utf8').matchAll(
          /'((?:manualReview|reviewClaims|reviewHistory|submissionData)\.[A-Za-z0-9_.-]+)'/g,
        ),
      ].map(match => match[1]),
    )
    .filter(key => !key.endsWith('.'))

describe('moderator locale keys', () => {
  it('removes the AI-deferred admission keys', () => {
    for (const key of [
      'manualReview.admit',
      'manualReview.aiDeferred',
      'manualReview.acknowledgement',
      'manualReview.admitNote',
    ])
      expect(lookup(key)).toBeUndefined()
  })

  it('defines every literal locale key used by moderator pages', () => {
    const missing = usedKeys().filter(key => typeof lookup(key) !== 'string')
    expect(missing).toEqual([])
  })
})
