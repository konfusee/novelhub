// Render source formatting within a text interval; annotations can wrap intervals
// without changing the original text offsets used by selection and notes.
export function ChapterInlineText({ inlines, start = 0, end = Infinity }) {
  let offset = 0;
  return inlines.map((span, index) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(span.text.length, end - offset);
    offset += span.text.length;
    if (to <= from) return null;
    let node = span.text.slice(from, to);
    if (span.marks.includes('bold')) node = <strong>{node}</strong>;
    if (span.marks.includes('italic')) node = <em>{node}</em>;
    if (span.marks.includes('underline')) node = <u>{node}</u>;
    return <span key={index}>{node}</span>;
  });
}
