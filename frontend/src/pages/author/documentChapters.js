// Conservative suggestions only: keep every character, and let the author review.
function ordinal(value) {
  if (/^\d+$/.test(value)) return Number(value)
  const roman = value.toUpperCase()
  if (!/^(?=.)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman)) return null
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  return [...roman].reduce(
    (total, letter, index) =>
      total + (values[letter] < (values[roman[index + 1]] ?? 0) ? -values[letter] : values[letter]),
    0,
  )
}

export function suggestDocumentChapters(
  text,
  preambleTitle,
  { format, headings: markdownHeadings, numberedHeadings } = {},
) {
  if (format === 'md' && Array.isArray(markdownHeadings) && markdownHeadings.length) {
    // An ambiguous or edited outline must not fall through to unrelated numbered lines.
    return outlinedChapters(text, preambleTitle, markdownHeadings)
  }
  if (
    format === 'md' &&
    !Array.isArray(markdownHeadings) &&
    /^ {0,3}(?:#{1,6}\s|`{3,}|~{3,})/m.test(text)
  )
    return markdownChapters(text, preambleTitle)
  const headings = []
  const lines = text.matchAll(/^.*(?:\n|$)/gm)
  for (const match of lines) {
    const title = match[0].trim()
    const heading =
      /^(chương|chapter)\s+(\d{1,4}|[ivxlcdm]+)(?:(?:\s*[:\-–—]\s*|\.\s+|\s+)(.*)|\.)?$/iu.exec(
        title,
      )
    if (!heading || title.length > 200 || /\.{2,}|…|\t/.test(title)) continue
    const number = ordinal(heading[2])
    if (!number || number > 9999) continue
    if (format === 'md' && Array.isArray(numberedHeadings) && !numberedHeadings.includes(title))
      return null
    headings.push({
      title,
      start: match.index,
      bodyStart: match.index + match[0].length,
      number,
      family: heading[1].toLowerCase(),
    })
  }
  if (headings.length < 2 || headings.length > 100) return null
  for (const [index, heading] of headings.entries()) {
    const previous = headings[index - 1]
    if (previous && (heading.family !== previous.family || heading.number !== previous.number + 1))
      return null
    const body = text.slice(heading.bodyStart, headings[index + 1]?.start ?? text.length)
    if (!/\p{L}/u.test(body)) return null
  }
  const result = []
  const firstStart = headings[0].start
  if (text.slice(0, firstStart).trim())
    result.push({ title: preambleTitle, text: text.slice(0, firstStart) })
  for (const [index, heading] of headings.entries()) {
    result.push({
      title: heading.title,
      text: text.slice(
        index === 0 && !result.length ? 0 : heading.start,
        headings[index + 1]?.start ?? text.length,
      ),
    })
  }
  return result.length > 100 ? null : result
}

function markdownChapters(text, preambleTitle) {
  const headings = []
  let fence = null
  let comment = false
  let frontmatter = /^\uFEFF?---\s*(?:\r?\n|$)/.test(text)
  for (const match of text.matchAll(/^.*(?:\n|$)/gm)) {
    const line = match[0].replace(/\r?\n$/, '')
    if (frontmatter) {
      if (match.index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) frontmatter = false
      continue
    }
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null
      continue
    }
    if (comment || line.includes('<!--')) {
      comment = !line.includes('-->')
      continue
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (opening) {
      fence = opening[1]
      continue
    }
    const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line)
    if (!heading) continue
    const title = heading[2].replace(/[ \t]+#+[ \t]*$/, '').trim()
    if (!title || title.length > 200 || /\.{2,}|…|\t/.test(title)) return null
    headings.push({
      level: heading[1].length,
      title,
      start: match.index,
      bodyStart: match.index + match[0].length,
    })
  }
  if (fence || frontmatter || comment) return null
  return splitMarkdownHeadings(text, preambleTitle, headings)
}

function outlinedChapters(text, preambleTitle, outline) {
  if (outline.length > 1000) return null
  const lines = [...text.matchAll(/^.*(?:\n|$)/gm)]
  const headings = []
  for (const item of outline) {
    if (
      !item ||
      !Number.isInteger(item.level) ||
      item.level < 1 ||
      item.level > 6 ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.length > 200 ||
      /\.{2,}|…|\t/.test(item.title)
    )
      return null
    const matches = lines.filter(line => line[0].trim() === item.title.trim())
    if (matches.length !== 1 || headings.some(heading => heading.start === matches[0].index))
      return null
    const line = matches[0]
    headings.push({
      level: item.level,
      title: item.title.trim(),
      start: line.index,
      bodyStart: line.index + line[0].length,
    })
  }
  if (headings.some((heading, index) => index > 0 && heading.start <= headings[index - 1].start))
    return null
  return splitMarkdownHeadings(text, preambleTitle, headings)
}

function splitMarkdownHeadings(text, preambleTitle, headings) {
  const level = [1, 2, 3, 4, 5, 6].find(
    value => headings.filter(heading => heading.level === value).length >= 2,
  )
  if (!level) return null
  const chapters = headings.filter(heading => heading.level === level)
  if (
    chapters.length > 100 ||
    headings.some(heading => heading.level < level && heading.start > chapters[0].start)
  )
    return null
  for (const [index, heading] of chapters.entries()) {
    if (!/\p{L}/u.test(text.slice(heading.bodyStart, chapters[index + 1]?.start ?? text.length)))
      return null
  }
  const result = []
  if (text.slice(0, chapters[0].start).trim())
    result.push({ title: preambleTitle, text: text.slice(0, chapters[0].start) })
  for (const [index, heading] of chapters.entries())
    result.push({
      title: heading.title,
      text: text.slice(
        index === 0 && !result.length ? 0 : heading.start,
        chapters[index + 1]?.start ?? text.length,
      ),
    })
  return result.length > 100 ? null : result
}
