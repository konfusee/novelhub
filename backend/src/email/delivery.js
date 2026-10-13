export function createDevelopmentEmailDelivery({ logger } = {}) {
  return {
    async send({ to, subject, actionUrl }) {
      // Development-only fallback. Never enabled by production configuration.
      logger?.info({ to, subject, actionUrl }, 'development authentication email');
      if (!logger) console.info(`[development email] ${to}: ${subject}\n${actionUrl}`);
      return { provider: 'development-console', accepted: true };
    },
  };
}

export function unavailableEmailDelivery() {
  return {
    async send() {
      throw new Error('Production email delivery is not configured');
    },
  };
}

export async function sendWithRetry(delivery, message, { attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await delivery.send({ ...message, attempt });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
