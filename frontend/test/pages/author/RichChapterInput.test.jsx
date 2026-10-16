import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RichChapterInput } from '../../../src/pages/author/RichChapterInput';
afterEach(cleanup);
it('changes only selected block types and supports undo/redo without flattening headings or marks', () => {
  const document = {
    title: 'Chương',
    blocks: [
      { type: 'heading', level: 2, inlines: [{ text: 'Mở đầu', marks: ['bold'] }] },
      { type: 'paragraph', inlines: [{ text: 'Nội dung', marks: ['italic'] }] },
    ],
  };
  const ref = createRef();
  const onChange = vi.fn();
  render(
    <RichChapterInput
      ref={ref}
      initialDocument={document}
      label="Bản thảo"
      onChange={onChange}
      onSave={() => {}}
      onError={() => {}}
    />,
  );
  const input = screen.getByRole('textbox');
  const range = window.document.createRange();
  range.setStart(input.children[0].querySelector('strong').firstChild, 'Mở đầu'.length);
  range.setEnd(input.children[1], input.children[1].childNodes.length);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  act(() => ref.current.format('quote'));
  expect(onChange.mock.calls.at(-1)[0].blocks).toEqual([
    document.blocks[0],
    { ...document.blocks[1], type: 'quote' },
  ]);
  expect(input.children[0].tagName).toBe('H2');
  fireEvent.keyDown(input, { ctrlKey: true, key: 'z' });
  expect(onChange.mock.calls.at(-1)[0].blocks).toEqual(document.blocks);
  fireEvent.keyDown(input, { ctrlKey: true, shiftKey: true, key: 'z' });
  expect(input.children[1].tagName).toBe('BLOCKQUOTE');
  input.textContent = 'Đoạn mới thay toàn bộ';
  const replacementRange = window.document.createRange();
  replacementRange.selectNodeContents(input.firstChild);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(replacementRange);
  fireEvent.input(input);
  act(() => ref.current.format('heading2'));
  expect(onChange.mock.calls.at(-1)[0].blocks).toEqual([
    { type: 'heading', level: 2, inlines: [{ text: 'Đoạn mới thay toàn bộ', marks: [] }] },
  ]);
});
