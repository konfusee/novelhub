import { captchaConfig } from './config.js'
import { describe, expect, it, vi } from 'vitest'
import { createCaptchaStore } from '../src/auth/captcha.js'
const solve = () => 'ABC234'
const testStore = () =>
  createCaptchaStore({
    ...captchaConfig,
    generate: () => ({ text: 'ABC234', data: '<svg xmlns="http://www.w3.org/2000/svg" />' }),
  })
describe('CAPTCHA', () => {
  it('renders glyph paths without exposing the answer as SVG text', () => {
    const result = createCaptchaStore(captchaConfig).issue('ip')
    const svg = Buffer.from(result.image.split(',')[1], 'base64').toString()
    expect(svg).toContain('<path')
    expect(svg).not.toContain('<text')
    expect(result).not.toHaveProperty('text')
  })
  it('expires, is case-insensitive and can only be consumed once', () => {
    const store = testStore()
    const challenge = store.issue('ip')
    expect(store.consume(challenge.token, solve(challenge.image).toLowerCase())).toBe(true)
    expect(store.consume(challenge.token, solve(challenge.image))).toBe(false)
    const expired = store.issue('ip')
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 301000)
    try {
      expect(store.consume(expired.token, solve(expired.image))).toBe(false)
    } finally {
      clock.mockRestore()
    }
  })
  it('limits generation and consumes a challenge even on wrong answers', () => {
    const store = createCaptchaStore(captchaConfig)
    const challenge = store.issue('ip')
    expect(store.consume(challenge.token, 'WRONG1')).toBe(false)
    expect(store.consume(challenge.token, solve(challenge.image))).toBe(false)
    for (let i = 0; i < 19; i += 1) expect(store.issue('ip')).not.toBeNull()
    expect(store.issue('ip')).toBeNull()
  })
})
