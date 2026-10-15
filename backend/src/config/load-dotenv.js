import { fileURLToPath } from 'node:url';

const DEFAULT_PATH = fileURLToPath(new URL('../../.env', import.meta.url));

/**
 * Loads `backend/.env` into process.env, whatever the current working directory
 * (npm scripts, `node src/server.js`, debuggers, nodemon). Variables already set
 * in the real environment win. A missing file is fine: production sets real env vars.
 */
export function loadDotenv(path = DEFAULT_PATH) {
  try {
    process.loadEnvFile(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
