import { useBackendDocument, useBackendResource } from '../../api/useBackendResource'

export const CATALOG_SORTS = ['popular', 'rating', 'newest']
export const CATALOG_STATUSES = ['ongoing', 'completed']
export const CATALOG_PAGE_SIZE = 12

/** Builds `/catalog/stories?...` from the supported filters; blank values are omitted. */
export function catalogStoriesPath({ q, sort, category, tag, status, page, pageSize } = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ q, sort, category, tag, status, page, pageSize }))
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  const query = params.toString()
  return `/catalog/stories${query ? `?${query}` : ''}`
}

const emptyPage = Object.freeze({ items: [], total: 0, page: 1, pageSize: CATALOG_PAGE_SIZE })
const pageFrom = response => {
  if (!Array.isArray(response?.items)) throw new Error('Dữ liệu danh sách truyện không hợp lệ.')
  return response
}

/** One page of published story cards; status is `empty` when the page has no items. */
export function useCatalogStories(filters) {
  const resource = useBackendResource(catalogStoriesPath(filters), emptyPage, pageFrom)
  const empty = resource.status === 'ready' && !resource.data.items.length
  return { ...resource, status: empty ? 'empty' : resource.status }
}

export function useCatalogCategories() {
  return useBackendResource('/catalog/categories')
}

export function useStoryDetail(storyId) {
  return useBackendDocument(`/catalog/stories/${encodeURIComponent(storyId)}`, null)
}

/** Keeps a URL search param value only when it is one of the allowed values. */
export const pick = (value, allowed, fallback = '') => (allowed.includes(value) ? value : fallback)
