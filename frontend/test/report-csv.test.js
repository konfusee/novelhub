import { expect, it } from 'vitest'
import { reportCsv } from '../src/utils/reportCsv'

it('exports Vietnamese, quotes, multiline fields and blocks spreadsheet formulas', () => {
  const csv = reportCsv(
    ['Tác giả', 'Số xu'],
    [
      ['Đặng "An", A\nB', 100],
      [' =HYPERLINK("x")', null],
    ],
  )
  expect(csv).toBe(
    '\uFEFF"Tác giả","Số xu"\r\n"Đặng ""An"", A\nB","100"\r\n"\' =HYPERLINK(""x"")",""',
  )
})
