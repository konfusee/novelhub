import { hostname } from 'node:os'

// Identifies the process that ran an evidence attempt (recorded in responseMetadata.runner).
export const RUNNER_ID = hostname() + ':' + process.pid
