// DOM is an editing surface only. Persist an allowlisted text AST, never HTML.
const blocks = new Set(['P', 'DIV', 'H2', 'H3', 'BLOCKQUOTE']);
const markTags = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic', U: 'underline' };
export function readChapterDom(root) {
  const result = [];
  let pending = [];
  const flush = (type = 'paragraph', level) => {
    result.push({ type, ...(level ? { level } : {}), inlines: pending });
    pending = [];
  };
  function inline(node, inherited = []) {
    if (node.nodeType === 3) {
      if (!node.textContent) return;
      const marks = [...new Set(inherited)].sort();
      const last = pending.at(-1);
      if (last && JSON.stringify(last.marks) === JSON.stringify(marks))
        last.text += node.textContent;
      else pending.push({ text: node.textContent, marks });
      return;
    }
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IMG', 'IFRAME'].includes(node.tagName)) return;
    if (node.tagName === 'BR') {
      inline(root.ownerDocument.createTextNode('\n'), inherited);
      return;
    }
    const mark = markTags[node.tagName];
    const next = mark ? [...inherited, mark] : [...inherited];
    // Chromium's underline command may produce styled spans. No other style is persisted.
    if (node.style?.fontWeight === 'bold' || Number(node.style?.fontWeight) >= 600)
      next.push('bold');
    if (node.style?.fontStyle === 'italic') next.push('italic');
    if (
      node.style?.textDecorationLine?.includes('underline') ||
      node.style?.textDecoration?.includes('underline')
    )
      next.push('underline');
    for (const child of node.childNodes) inline(child, next);
  }
  function visit(node, context) {
    if (node.nodeType === 1 && node.tagName === 'HR') {
      if (pending.length) flush();
      result.push({ type: 'scene-break' });
    } else if (node.nodeType === 1 && blocks.has(node.tagName)) {
      if (pending.length) flush();
      const nested = [...node.children].some(
        (child) => blocks.has(child.tagName) || child.tagName === 'HR',
      );
      if (nested) {
        for (const child of node.childNodes)
          visit(child, node.tagName === 'BLOCKQUOTE' ? 'quote' : context);
      } else {
        // A lone BR is the browser's empty paragraph placeholder.
        if (!(node.childNodes.length === 1 && node.firstChild.nodeName === 'BR')) inline(node);
        const type =
          node.tagName === 'BLOCKQUOTE'
            ? 'quote'
            : /^H[23]$/.test(node.tagName)
              ? 'heading'
              : (context ?? 'paragraph');
        flush(type, type === 'heading' ? Number(node.tagName[1]) : undefined);
      }
    } else inline(node);
  }
  for (const node of root.childNodes) visit(node);
  if (pending.length || !result.length) flush();
  return result;
}

export function writeChapterDom(root, document) {
  const dom = root.ownerDocument;
  const nodes = document.blocks.map((block) => {
    const tag = {
      paragraph: 'p',
      heading: `h${block.level}`,
      quote: 'blockquote',
      'scene-break': 'hr',
    }[block.type];
    const element = dom.createElement(tag);
    if (block.type === 'scene-break') return element;
    for (const span of block.inlines) {
      let node = dom.createTextNode(span.text);
      for (const mark of span.marks) {
        const wrapper = dom.createElement({ bold: 'strong', italic: 'em', underline: 'u' }[mark]);
        wrapper.append(node);
        node = wrapper;
      }
      element.append(node);
    }
    if (!element.childNodes.length) element.append(dom.createElement('br'));
    return element;
  });
  root.replaceChildren(...nodes);
}

export const richChapterBody = (document) =>
  document.blocks
    .map((block) =>
      block.type === 'scene-break'
        ? '*     *     *'
        : block.inlines.map((span) => span.text).join(''),
    )
    .join('\n\n');
