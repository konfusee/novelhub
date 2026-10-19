import nodemailer from 'nodemailer'
import { renderOtpEmail } from './otp-template.js'

export function createDevelopmentEmailDelivery({ logger } = {}) {
  return {
    async send({ to, subject, actionUrl, otp }) {
      // Development-only fallback. Never enabled by production configuration.
      logger?.info({ to, subject, actionUrl, otp }, 'development authentication email')
      if (!logger) console.info(`[development email] ${to}: ${subject}\n${otp || actionUrl}`)
      return { provider: 'development-console', accepted: true }
    },
  }
}

export function unavailableEmailDelivery() {
  return {
    async send() {
      throw new Error('Production email delivery is not configured')
    },
  }
}

export async function sendWithRetry(delivery, message, { attempts }) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await delivery.send({ ...message, attempt })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
export function createSmtpEmailDelivery(config) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: config.connectionTimeoutMs,
    greetingTimeout: config.greetingTimeoutMs,
    socketTimeout: config.socketTimeoutMs,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  return {
    verify: () => transport.verify(),
    async send({ to, subject, actionUrl, otp, expiresInMinutes, purpose, text }) {
      const result = await transport.sendMail({
        from: config.from,
        to,
        subject,
        ...(typeof text === 'string'
          ? { text }
          : otp
            ? renderOtpEmail({ otp, expiresInMinutes, purpose })
            : {
                text: `${subject}\n\nOpen this link to continue:\n${actionUrl}\n\nIf you did not request this email, you can ignore it.`,
              }),
      })
      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error('SMTP server did not accept the recipient')
      }
      return { provider: 'smtp', accepted: true, messageId: result.messageId }
    },
  }
}
