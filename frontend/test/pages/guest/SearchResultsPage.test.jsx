import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { SearchResultsPage } from '../../../src/pages/guest/SearchResultsPage'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest, API_BASE: '/api' }))
vi.mock('../../../src/components/public/PublicHeader', () => ({ PublicHeader: () => null }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}
const view = entry =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocaleProvider>
        <Routes>
          <Route
            path="/search"
            element={
              <>
                <SearchResultsPage />
                <Location />
              </>
            }
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
const storyPaths = () =>
  mocks.apiRequest.mock.calls
    .map(([path]) => path)
    .filter(path => path.startsWith('/catalog/stories'))

it('filters the catalogue by the ?tag= value and clears it from the chip', async () => {
  mocks.apiRequest.mockImplementation(async path =>
    path.startsWith('/catalog/categories')
      ? { items: [] }
      : { items: [], total: 0, page: 1, pageSize: 12 },
  )
  view('/search?tag=%23slow-burn')
  await waitFor(() =>
    expect(
      storyPaths().some(path => new URLSearchParams(path.split('?')[1]).get('tag') === 'slow-burn'),
    ).toBe(true),
  )
  expect(screen.getByText('Thẻ #slow-burn')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ lọc thẻ slow-burn' }))
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe(''))
  expect(screen.queryByText('Thẻ #slow-burn')).toBeNull()
})
