import { HttpError } from '../../../middleware/errors.js'

export const REPORT_PAGE_SIZE = 7

export function shiftMonth(periodId, offset) {
  const [year, month] = periodId.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1 + offset, 1)
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthRange(periodId) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodId)) {
    throw new HttpError(400, 'invalid_revenue_period', 'Kỳ thống kê không hợp lệ.')
  }
  const [year, month] = periodId.split('-').map(Number)
  const boundary = monthIndex => {
    const date = new Date(0)
    date.setUTCFullYear(year, monthIndex, 1)
    // Midnight in Vietnam is 17:00 UTC on the preceding calendar date.
    date.setUTCHours(-7, 0, 0, 0)
    return date
  }
  return { start: boundary(month - 1), end: boundary(month) }
}

export function normalizeAuthorSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
}

export function matchesAuthorName(name, search) {
  return normalizeAuthorSearch(name).includes(normalizeAuthorSearch(search))
}

export function assertReportAmounts(values) {
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new HttpError(409, 'invalid_revenue_total', 'Số liệu báo cáo vượt giới hạn xử lý.')
  }
}

export function paginateReport(items, page, all = false) {
  const offset = (page - 1) * REPORT_PAGE_SIZE
  return {
    page,
    pageSize: REPORT_PAGE_SIZE,
    totalItems: items.length,
    hasMore: !all && offset + REPORT_PAGE_SIZE < items.length,
    items: all ? items : items.slice(offset, offset + REPORT_PAGE_SIZE),
  }
}
