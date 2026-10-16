// Conservative suggestions only: keep every character, and let the author review.
function ordinal(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const roman = value.toUpperCase();
  if (!/^(?=.)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman)) return null;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return [...roman].reduce(
    (total, letter, index) =>
      total + (values[letter] < (values[roman[index + 1]] ?? 0) ? -values[letter] : values[letter]),
    0,
  );
}

export function suggestDocumentChapters(text, preambleTitle) {
  const headings = [];
  const lines = text.matchAll(/^.*(?:\n|$)/gm);
  for (const match of lines) {
    const title = match[0].trim();
    const heading =
      /^(chương|chapter)\s+(\d{1,4}|[ivxlcdm]+)(?:(?:\s*[:\-–—]\s*|\.\s+|\s+)(.*)|\.)?$/iu.exec(
        title,
      );
    if (!heading || title.length > 200 || /\.{2,}|…|\t/.test(title)) continue;
    const number = ordinal(heading[2]);
    if (!number || number > 9999) continue;
    headings.push({
      title,
      start: match.index,
      bodyStart: match.index + match[0].length,
      number,
      family: heading[1].toLowerCase(),
    });
  }
  if (headings.length < 2 || headings.length > 100) return null;
  for (const [index, heading] of headings.entries()) {
    const previous = headings[index - 1];
    if (previous && (heading.family !== previous.family || heading.number !== previous.number + 1))
      return null;
    const body = text.slice(heading.bodyStart, headings[index + 1]?.start ?? text.length);
    if (!/\p{L}/u.test(body)) return null;
  }
  const result = [];
  const firstStart = headings[0].start;
  if (text.slice(0, firstStart).trim())
    result.push({ title: preambleTitle, text: text.slice(0, firstStart) });
  for (const [index, heading] of headings.entries()) {
    result.push({
      title: heading.title,
      text: text.slice(
        index === 0 && !result.length ? 0 : heading.start,
        headings[index + 1]?.start ?? text.length,
      ),
    });
  }
  return result.length > 100 ? null : result;
}
