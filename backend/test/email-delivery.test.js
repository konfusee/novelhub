import { testEnv } from './config.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { createSmtpEmailDelivery, sendWithRetry } from '../src/email/delivery.js';
import { loadEnv } from '../src/config/env.js';

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
const smtp = {
  host: 'smtp.example.test',
  port: 587,
  secure: false,
  user: 'user',
  password: 'secret',
  from: 'sender@example.test',
};
let transport;
beforeEach(() => {
  vi.clearAllMocks();
  transport = { sendMail: vi.fn(), verify: vi.fn().mockResolvedValue(true) };
  nodemailer.createTransport.mockReturnValue(transport);
});

describe('SMTP delivery', () => {
  it('requires STARTTLS, verifies credentials and sends the recovery link', async () => {
    transport.sendMail.mockResolvedValue({
      accepted: ['reader@example.test'],
      rejected: [],
      messageId: 'id',
    });
    const delivery = createSmtpEmailDelivery(smtp);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        requireTLS: true,
        secure: false,
        auth: { user: 'user', pass: 'secret' },
      }),
    );
    await expect(delivery.verify()).resolves.toBe(true);
    await expect(
      delivery.send({
        to: 'reader@example.test',
        subject: 'Reset password',
        actionUrl: 'https://novelhub.test/reset-password?token=abc',
      }),
    ).resolves.toMatchObject({ provider: 'smtp', accepted: true });
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: smtp.from,
        to: 'reader@example.test',
        text: expect.stringContaining('/reset-password?token=abc'),
      }),
    );
  });
  it('sends a six-digit recovery OTP with its expiry instead of a link', async () => {
    transport.sendMail.mockResolvedValue({ accepted: ['reader@example.test'], rejected: [] });
    await createSmtpEmailDelivery(smtp).send({
      to: 'reader@example.test',
      subject: 'NovelHub OTP',
      otp: '012345',
      purpose: 'password-reset',
      expiresInMinutes: 10,
    });
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('012345') }),
    );
    const message = transport.sendMail.mock.calls[0][0];
    expect(message.text).toContain('10');
    expect(message.text).not.toContain('undefined');
    expect(message.text).not.toContain('/reset-password');
    expect(message.html).toContain('Đặt lại mật khẩu');
    expect(message.html).toContain('>012345</span>');
    expect(message.html).toContain('Sao chép');
    expect(message.html).not.toMatch(/<script|onclick=|012 345/);
  });
  it('rejects unsafe or malformed OTP markup before sending', async () => {
    await expect(
      createSmtpEmailDelivery(smtp).send({
        to: 'reader@example.test',
        otp: '<script>',
        expiresInMinutes: 10,
      }),
    ).rejects.toThrow('six digits');
    expect(transport.sendMail).not.toHaveBeenCalled();
  });
  it('uses implicit TLS for a secure transport', () => {
    createSmtpEmailDelivery({ ...smtp, port: 465, secure: true });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, requireTLS: false }),
    );
  });
  it('retries failures up to three times and propagates rejection', async () => {
    transport.sendMail.mockResolvedValue({ accepted: [], rejected: ['reader@example.test'] });
    await expect(
      sendWithRetry(createSmtpEmailDelivery(smtp), { to: 'reader@example.test' }, { attempts: 3 }),
    ).rejects.toThrow('did not accept');
    expect(transport.sendMail).toHaveBeenCalledTimes(3);
  });
});

describe('SMTP environment', () => {
  const base = { ...testEnv, MONGODB_URI: 'mongodb://x' };
  it('allows blank SMTP settings in development', () => {
    expect(loadEnv({ ...base, SMTP_HOST: '', SMTP_PASSWORD: '' }).SMTP_HOST).toBeUndefined();
  });
  it('rejects partial SMTP settings and missing production delivery', () => {
    expect(() => loadEnv({ ...base, SMTP_HOST: smtp.host })).toThrow(/SMTP_USER/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/SMTP_HOST/);
  });
  it('parses false correctly and rejects invalid sender addresses', () => {
    const configured = {
      ...base,
      SMTP_HOST: smtp.host,
      SMTP_USER: smtp.user,
      SMTP_PASSWORD: smtp.password,
      SMTP_FROM: smtp.from,
      SMTP_SECURE: 'false',
    };
    expect(loadEnv(configured).SMTP_SECURE).toBe(false);
    expect(() => loadEnv({ ...configured, SMTP_FROM: 'invalid' })).toThrow(/SMTP_FROM/);
  });
});
