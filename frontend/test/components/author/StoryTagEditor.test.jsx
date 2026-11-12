import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { StoryTagEditor } from '../../../src/components/author/StoryTagEditor'

afterEach(cleanup)

function Harness({ initial = [] }) {
  const [tags, setTags] = useState(initial)
  return <StoryTagEditor id="tags" tags={tags} onChange={setTags} />
}
const shown = () =>
  [...(screen.queryByRole('list', { name: 'Thẻ đã thêm' })?.querySelectorAll('li') ?? [])].map(
    item => item.textContent.replace(/^#/, ''),
  )
const add = value => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Thẻ khám phá' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thẻ', exact: true }))
}
const DESERET = '\u{10428}' // one supplementary-plane letter, two UTF-16 units

it('normalizes decomposed Vietnamese input to NFC like the server', () => {
  render(<Harness />)
  add('#Ky\u0300-a\u0309o')
  expect(shown()).toEqual(['K\u1EF3-\u1EA3o'])
  expect(screen.queryByRole('alert')).toBeNull()
})

it('treats NFC and NFD spellings as duplicates regardless of case', () => {
  render(<Harness initial={['K\u1EF3-\u1EA3o']} />)
  add('KY\u0300-A\u0309O')
  expect(screen.getByRole('alert').textContent).toBe('Thẻ này đã có trong danh sách.')
  expect(shown()).toEqual(['K\u1EF3-\u1EA3o'])
})

it('counts length in code points after normalization', () => {
  render(<Harness />)
  add(DESERET.repeat(30))
  expect(shown()).toEqual([DESERET.repeat(30)])
  add('a'.repeat(31))
  expect(screen.getByRole('alert').textContent).toContain('2–30 ký tự')
  add('e\u0301'.repeat(30))
  expect(shown()).toEqual([DESERET.repeat(30), '\u00E9'.repeat(30)])
})
