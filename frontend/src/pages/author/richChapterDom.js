import { privateMediaUrl } from '../../api/media'
// DOM is an editing surface only. Persist an allowlisted AST, never HTML.
const blocks = new Set(['P', 'DIV', 'H2', 'H3', 'BLOCKQUOTE'])
const markTags = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic', U: 'underline' }
export function readChapterDom(root) {
  const result = []
  let pending = []
  const flush = (type = 'paragraph', level) => {
    result.push({ type, ...(level ? { level } : {}), inlines: pending })
    pending = []
  }
  const imageFrom = node => ({
    type: 'image',
    mediaId: node.dataset.mediaId ?? '',
    alt: node.dataset.alt ?? '',
    caption: node.dataset.caption ?? '',
  })
  function inline(node, inherited = [], context = {}) {
    // Browsers can wrap a non-editable figure while formatting adjacent text.
    // Keep its reference instead of turning its caption into ordinary prose.
    if (node.nodeType === 1 && node.tagName === 'FIGURE') {
      if (pending.length) flush(context.type ?? 'paragraph', context.level)
      result.push(imageFrom(node))
      return
    }
    if (node.nodeType === 3) {
      if (!node.textContent) return
      const marks = [...new Set(inherited)].sort()
      const last = pending.at(-1)
      if (last && JSON.stringify(last.marks) === JSON.stringify(marks))
        last.text += node.textContent
      else pending.push({ text: node.textContent, marks })
      return
    }
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IMG', 'IFRAME'].includes(node.tagName)) return
    if (node.tagName === 'BR') {
      inline(root.ownerDocument.createTextNode('\n'), inherited, context)
      return
    }
    const mark = markTags[node.tagName]
    const next = mark ? [...inherited, mark] : [...inherited]
    // Chromium's underline command may produce styled spans. No other style is persisted.
    if (node.style?.fontWeight === 'bold' || Number(node.style?.fontWeight) >= 600)
      next.push('bold')
    if (node.style?.fontStyle === 'italic') next.push('italic')
    if (
      node.style?.textDecorationLine?.includes('underline') ||
      node.style?.textDecoration?.includes('underline')
    )
      next.push('underline')
    for (const child of node.childNodes) inline(child, next, context)
  }
  function visit(node, context) {
    if (node.nodeType === 1 && node.tagName === 'FIGURE') {
      if (pending.length) flush()
      result.push(imageFrom(node))
    } else if (node.nodeType === 1 && node.tagName === 'HR') {
      if (pending.length) flush()
      result.push({ type: 'scene-break' })
    } else if (node.nodeType === 1 && blocks.has(node.tagName)) {
      if (pending.length) flush()
      const nested = [...node.children].some(
        child => blocks.has(child.tagName) || ['HR', 'FIGURE'].includes(child.tagName),
      )
      if (nested) {
        for (const child of node.childNodes)
          visit(child, node.tagName === 'BLOCKQUOTE' ? 'quote' : context)
      } else {
        const type =
          node.tagName === 'BLOCKQUOTE'
            ? 'quote'
            : /^H[23]$/.test(node.tagName)
              ? 'heading'
              : (context ?? 'paragraph')
        const level = type === 'heading' ? Number(node.tagName[1]) : undefined
        const before = result.length
        // A lone BR is the browser's empty paragraph placeholder.
        if (!(node.childNodes.length === 1 && node.firstChild.nodeName === 'BR'))
          inline(node, [], { type, level })
        if (pending.length || result.length === before) flush(type, level)
      }
    } else inline(node)
  }
  for (const node of root.childNodes) visit(node)
  if (pending.length || !result.length) flush()
  return result
}

export function writeChapterDom(root, document) {
  const dom = root.ownerDocument
  const nodes = document.blocks.map(block => {
    if (block.type === 'image') {
      const figure = dom.createElement('figure')
      figure.contentEditable = 'false'
      figure.dataset.mediaId = block.mediaId
      figure.dataset.alt = block.alt
      figure.dataset.caption = block.caption ?? ''
      figure.className = 'my-6 rounded-2xl border border-hairline p-3'
      const image = dom.createElement('img')
      image.crossOrigin = 'use-credentials'
      image.src = privateMediaUrl(block.mediaId)
      image.alt = block.alt
      image.className = 'mx-auto max-h-[60dvh] max-w-full object-contain'
      const caption = dom.createElement('figcaption')
      caption.textContent = block.caption ?? ''
      caption.className = 'mt-2 text-center text-sm text-muted'
      figure.append(image, caption)
      return figure
    }
    const tag = {
      paragraph: 'p',
      heading: `h${block.level}`,
      quote: 'blockquote',
      'scene-break': 'hr',
    }[block.type]
    const element = dom.createElement(tag)
    if (block.type === 'scene-break') return element
    for (const span of block.inlines) {
      let node = dom.createTextNode(span.text)
      for (const mark of span.marks) {
        const wrapper = dom.createElement({ bold: 'strong', italic: 'em', underline: 'u' }[mark])
        wrapper.append(node)
        node = wrapper
      }
      element.append(node)
    }
    if (!element.childNodes.length) element.append(dom.createElement('br'))
    return element
  })
  root.replaceChildren(...nodes)
}

export const richChapterBody = document =>
  document.blocks
    .map(block =>
      block.type === 'image'
        ? ''
        : block.type === 'scene-break'
          ? '*     *     *'
          : block.inlines.map(span => span.text).join(''),
    )
    .join('\n\n')
