// Public contracts for other fields. Mutations accept the caller's transaction.
export { requireAuth, requireRole } from '../../middleware/auth.js'
export { policy, getEffective } from './policy.js'
export { notify } from './notifications.js'
export { registerLifecycleHook, runLifecycleHooks } from './lifecycle.js'
export { recordAudit } from './audit.js'
