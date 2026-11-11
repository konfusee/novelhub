import { releaseAccountClaims } from '../moderation-ai/account-lifecycle.js'
import { prepareAccountDeletion } from '../coins-payouts/account-lifecycle.js'
import { cancelAuthorWork } from '../authoring-publishing/account-lifecycle.js'
const events = [
  'onAccountSuspended',
  'onAuthorRoleRevoked',
  'onAccountDeleted',
  'onStaffRoleRevoked',
]
const registry = new Map(events.map(event => [event, new Map()]))
for (const event of ['onAccountSuspended', 'onAccountDeleted', 'onStaffRoleRevoked']) {
  registry.get(event).set('moderation-ai', releaseAccountClaims)
}
registry.get('onAccountDeleted').set('coins-payouts', prepareAccountDeletion)
registry.get('onAccountDeleted').set('authoring-publishing', cancelAuthorWork)
registry.get('onAuthorRoleRevoked').set('authoring-publishing', cancelAuthorWork)

/** Register a field's transaction-only hook. Returns an unregister function. */
export function registerLifecycleHook(event, field, handler) {
  if (!registry.has(event) || typeof handler !== 'function')
    throw new Error('Invalid lifecycle hook')
  const hooks = registry.get(event)
  if (hooks.has(field)) throw new Error(`Lifecycle hook already registered: ${event}/${field}`)
  hooks.set(field, handler)
  return () => hooks.delete(field)
}

/** Hooks must use this session, propagate failures, and never call external providers. */
export async function runLifecycleHooks(event, context) {
  if (!context.session?.inTransaction()) throw new Error('Lifecycle hooks require a transaction')
  if (!registry.has(event)) throw new Error('Invalid lifecycle event')
  const results = {}
  for (const [field, handler] of registry.get(event)) results[field] = await handler(context)
  return results
}
