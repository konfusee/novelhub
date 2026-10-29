// MongoDB reports a missing collection as NamespaceNotFound (code 26).
const NAMESPACE_NOT_FOUND = 26

/**
 * Read-only preview of what `Model.syncIndexes()` would change: logs one line per model and
 * returns one `<collection> would drop <names>` clause per collection that would lose an index.
 * Only a missing collection is tolerated; any other error is rethrown, so a failed inspection is
 * never reported as a safe diff.
 */
export async function diffModelIndexes(models, { log = console.log } = {}) {
  const drops = []
  for (const model of models) {
    const collection = model.collection.collectionName
    let diff
    try {
      diff = await model.diffIndexes()
    } catch (error) {
      if (error?.codeName !== 'NamespaceNotFound' && error?.code !== NAMESPACE_NOT_FOUND)
        throw error
      log(`${collection}: missing collection (would be created)`)
      continue
    }
    log(
      `${collection}: create ${JSON.stringify(diff.toCreate)} drop ${JSON.stringify(diff.toDrop)}`,
    )
    if (diff.toDrop.length) drops.push(`${collection} would drop ${diff.toDrop.join(', ')}`)
  }
  return drops
}
