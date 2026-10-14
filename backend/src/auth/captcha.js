import { randomBytes, timingSafeEqual } from 'node:crypto';
import svgCaptcha from 'svg-captcha';
import { digestToken } from './session.js';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function createCaptchaStore({
  captchaTtlMinutes,
  captchaMaxEntries,
  captchaMaxRequests,
  generate = () =>
    svgCaptcha.create({
      size: 6,
      noise: 4,
      color: true,
      background: '#ecf2ed',
      width: 220,
      height: 70,
      fontSize: 42,
      charPreset: ALPHABET,
    }),
}) {
  const challenges = new Map();
  const requests = new Map();
  return {
    issue(ip) {
      const now = Date.now();
      for (const [key, value] of challenges) if (value.expiresAt <= now) challenges.delete(key);
      for (const [key, value] of requests) if (value.expiresAt <= now) requests.delete(key);
      const limit = requests.get(ip) || { count: 0, expiresAt: now + 60_000 };
      limit.count += 1;
      requests.set(ip, limit);
      if (limit.count > captchaMaxRequests || challenges.size >= captchaMaxEntries) return null;
      const token = randomBytes(32).toString('base64url');
      const { text: code, data: svg } = generate();
      challenges.set(digestToken(token), {
        answerHash: digestToken(token + ':' + code),
        expiresAt: now + captchaTtlMinutes * 60_000,
      });
      return {
        token,
        image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'),
        expiresInSeconds: captchaTtlMinutes * 60,
      };
    },
    consume(token, answer) {
      const hash = digestToken(token);
      const challenge = challenges.get(hash);
      challenges.delete(hash);
      if (!challenge || challenge.expiresAt <= Date.now()) return false;
      return timingSafeEqual(
        Buffer.from(challenge.answerHash),
        Buffer.from(digestToken(token + ':' + answer.trim().toUpperCase())),
      );
    },
  };
}
