// One-off data migration for the paragraph-based reading progress. The old shape kept one row
// per (account, story, chapter, mode): text rows stored a scroll fraction in `position`, audio
// rows stored playback seconds in `position`. The new shape keeps one row per
// (account, story, chapter) with `paragraph`, `audioSeconds` and `position` 0–1.
// For every chapter with old rows:
// - the newest row (by lastReadAt) decides `mode` and `lastReadAt`;
// - `paragraph` starts at 0 (a scroll fraction cannot be turned into a paragraph);
// - when the newest row is an audio row its seconds become `audioSeconds` (kept with `duration`);
// - `position` becomes 0–1 (audio: seconds / duration), `completedAt` the earliest of the rows;
// - the other rows of that chapter are deleted.
// Re-running changes nothing. Dry run by default; take a backup first:
//   npm run db:migrate-reading-progress --workspace backend            # writes nothing
//   npm run db:migrate-reading-progress --workspace backend -- --apply
// Afterwards `npm run db:sync-indexes --workspace backend` swaps the unique index
// (accountId, storyId, chapterId, mode) for (accountId, storyId, chapterId).
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import { ReadingProgress } from '../src/models/index.js'

const time = date => date?.getTime() ?? 0
const earliest = dates => dates.filter(Boolean).sort((left, right) => left - right)[0] ?? null

/** The single new-shape row that replaces one chapter's old rows. */
export function mergedRow(rows) {
  const newest = rows.reduce((best, row) =>
    time(row.lastReadAt) > time(best.lastReadAt) ? row : best,
  )
  const completedAt = earliest(rows.map(row => row.completedAt))
  const audio = newest.mode === 'audio'
  const seconds = audio ? (newest.position ?? 0) : null
  const fraction = audio
    ? newest.duration
      ? Math.min(1, seconds / newest.duration)
      : 0
    : Math.min(1, Math.max(0, newest.position ?? 0))
  return {
    keepId: newest._id,
    set: {
      mode: audio ? 'audio' : 'text',
      paragraph: 0,
      position: completedAt ? 1 : fraction,
      audioSeconds: seconds,
      duration: audio ? (newest.duration ?? null) : null,
      completedAt,
    },
    deleteIds: rows.filter(row => row._id !== newest._id).map(row => row._id),
  }
}

/** Converts every chapter that still has old-shape rows (rows without `paragraph`). */
export async function migrateReadingProgress({ apply = false } = {}) {
  const groups = await ReadingProgress.collection
    .aggregate([
      { $match: { paragraph: { $exists: false } } },
      {
        $group: { _id: { accountId: '$accountId', storyId: '$storyId', chapterId: '$chapterId' } },
      },
    ])
    .toArray()
  const summary = { mode: apply ? 'apply' : 'dry-run', chapters: 0, rowsDeleted: 0 }
  for (const { _id: key } of groups) {
    const rows = await ReadingProgress.collection.find(key).toArray()
    const { keepId, set, deleteIds } = mergedRow(rows)
    summary.chapters += 1
    summary.rowsDeleted += deleteIds.length
    if (!apply) continue
    // Delete first: the old unique index includes `mode`, so the kept row may take over the
    // mode of a row being removed.
    if (deleteIds.length) await ReadingProgress.collection.deleteMany({ _id: { $in: deleteIds } })
    await ReadingProgress.collection.updateOne({ _id: keepId }, { $set: set })
  }
  return summary
}

const invokedDirectly = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } })
  loadDotenv()
  const env = loadEnv()
  await connectDatabase(env.MONGODB_URI, {
    serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
  })
  try {
    console.log(
      `Reading progress migration: ${JSON.stringify(await migrateReadingProgress(values))}`,
    )
  } finally {
    await disconnectDatabase()
  }
}
