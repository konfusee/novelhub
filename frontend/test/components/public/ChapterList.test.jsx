import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { ChapterList } from '../../../src/components/public/ChapterList'

const auth = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../../../src/context/AuthContext', () => ({ useAuth: () => auth }))

afterEach(cleanup)

const STORY = 'story-1'
const view = chapters =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <ChapterList storyId={STORY} chapters={chapters} />
      </LocaleProvider>
    </MemoryRouter>,
  )
const row = title => screen.getByText(title).closest('li')

describe('ChapterList', () => {
  it('shows an unlocked chapter as readable without its coin price', () => {
    auth.isAuthenticated = true
    view([
      {
        id: 'c2',
        number: 2,
        orderKey: 2,
        title: 'Đã mua',
        unlocked: true,
        locked: false,
        earlyAccess: { coinPrice: 30 },
      },
      {
        id: 'c3',
        number: 3,
        orderKey: 3,
        title: 'Còn khóa',
        locked: true,
        earlyAccess: { coinPrice: 40 },
      },
    ])
    const unlocked = within(row('Đã mua'))
    expect(unlocked.getByText('Đã mở khóa')).toBeTruthy()
    expect(unlocked.getByRole('link', { name: 'Đọc' }).getAttribute('href')).toBe(
      `/read/${STORY}/c2`,
    )
    expect(unlocked.queryByText(/xu/)).toBeNull()
    const locked = within(row('Còn khóa'))
    expect(locked.getByText(/40 xu/)).toBeTruthy()
    expect(locked.getByRole('link', { name: 'Mở khóa' })).toBeTruthy()
  })

  it('marks only the orderKey 1 chapter as the Guest preview', () => {
    auth.isAuthenticated = false
    view([
      { id: 'b', number: 1, orderKey: 2, title: 'Thứ hai', locked: false },
      { id: 'a', number: 2, orderKey: 1, title: 'Thứ nhất', locked: false },
    ])
    expect(within(row('Thứ nhất')).getByText('Đọc thử miễn phí')).toBeTruthy()
    expect(within(row('Thứ hai')).queryByText('Đọc thử miễn phí')).toBeNull()
  })
})
