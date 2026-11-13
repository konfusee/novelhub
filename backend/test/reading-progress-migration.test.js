import { expect, it } from 'vitest'
import { Types } from 'mongoose'
import { ReadingProgress } from '../src/models/index.js'
import { mergedRow, migrateReadingProgress } from '../scripts/migrate-reading-progress.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const ids = () => ({
  accountId: new Types.ObjectId(),
  storyId: new Types.ObjectId(),
  chapterId: new Types.ObjectId(),
})

it('merges a chapter’s old text and audio rows into one, the newest deciding the point', () => {
  const text = {
    _id: new Types.ObjectId(),
    mode: 'text',
    position: 0.6,
    lastReadAt: new Date('2026-11-01'),
    completedAt: new Date('2026-10-01'),
  }
  const audio = {
    _id: new Types.ObjectId(),
    mode: 'audio',
    position: 30,
    duration: 120,
    lastReadAt: new Date('2026-11-02'),
  }
  expect(mergedRow([text, audio])).toEqual({
    keepId: audio._id,
    set: {
      mode: 'audio',
      paragraph: 0,
      position: 1,
      audioSeconds: 30,
      duration: 120,
      completedAt: text.completedAt,
    },
    deleteIds: [text._id],
  })
  expect(mergedRow([{ ...text, completedAt: null }]).set).toMatchObject({
    mode: 'text',
    position: 0.6,
    audioSeconds: null,
  })
})

it('converts old rows once and leaves new rows alone', async () => {
  const old = { ...ids(), mode: 'audio', position: 30, duration: 120, lastReadAt: new Date() }
  const current = { ...ids(), mode: 'text', paragraph: 2, paragraphCount: 4, position: 0.5 }
  await ReadingProgress.collection.insertMany([old, current])

  expect(await migrateReadingProgress()).toEqual({ mode: 'dry-run', chapters: 1, rowsDeleted: 0 })
  expect(await ReadingProgress.findById(old._id).lean()).not.toHaveProperty('paragraph')

  await migrateReadingProgress({ apply: true })
  expect(await ReadingProgress.findById(old._id).lean()).toMatchObject({
    mode: 'audio',
    paragraph: 0,
    position: 0.25,
    audioSeconds: 30,
  })
  expect(await ReadingProgress.findById(current._id).lean()).toMatchObject({ paragraph: 2 })
  expect(await migrateReadingProgress({ apply: true })).toMatchObject({ chapters: 0 })
})
