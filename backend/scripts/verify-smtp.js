import { loadDotenv } from '../src/config/load-dotenv.js';
import { loadEnv } from '../src/config/env.js';
import { createSmtpEmailDelivery } from '../src/email/delivery.js';

loadDotenv();
try {
  const env = loadEnv();
  if (!env.SMTP_HOST) throw new Error('SMTP_HOST is not configured');
  const delivery = createSmtpEmailDelivery({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
  });
  await delivery.verify();
  console.info('SMTP connection and authentication succeeded. No email was sent.');
} catch (error) {
  console.error(
    `SMTP verification failed (${error.code || 'configuration'}). Check SMTP settings and credentials.`,
  );
  process.exitCode = 1;
}
