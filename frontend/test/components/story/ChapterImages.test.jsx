import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  PublishedChapterImage,
  PrivateChapterImage,
} from '../../../src/components/story/PrivateChapterImage'
import { LocaleProvider } from '../../../src/context/LocaleContext'
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ API_BASE: '/api', apiRequest: mocks.apiRequest }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const block = {
  type: 'image',
  mediaId: 'image',
  alt: 'Khu rừng đầy nắng',
  caption: 'Minh họa chương',
}
const target = { storyId: 'story', chapterId: 'chapter', revisionId: 'approved' }
it('resets an image error for a different published revision without falling back to a private URL', () => {
  const view = render(
    <LocaleProvider>
      <PublishedChapterImage block={block} target={target} />
    </LocaleProvider>,
  )
  fireEvent.error(screen.getByRole('img'))
  view.rerender(
    <LocaleProvider>
      <PublishedChapterImage block={block} target={{ ...target, revisionId: 'new-approved' }} />
    </LocaleProvider>,
  )
  expect(screen.getByRole('img').getAttribute('src')).toContain(
    '/revisions/new-approved/media/image',
  )
  expect(screen.getByRole('img').getAttribute('src')).not.toContain('/author/')
})
it('preserves private draft and exact submission image URLs', () => {
  const view = render(
    <LocaleProvider>
      <PrivateChapterImage block={block} />
    </LocaleProvider>,
  )
  expect(screen.getByRole('img').getAttribute('src')).toBe('/api/author/media/image/content')
  view.rerender(
    <LocaleProvider>
      <PrivateChapterImage block={block} submissionId="submitted" />
    </LocaleProvider>,
  )
  expect(screen.getByRole('img').getAttribute('src')).toBe(
    '/api/author/submissions/submitted/media/image/content',
  )
})
