import { useEffect, useImperativeHandle, useRef } from 'react'
import { readChapterDom, writeChapterDom } from './richChapterDom'

export function RichChapterInput({
  ref,
  initialDocument,
  disabled,
  label,
  onChange,
  onSave,
  onError,
}) {
  const root = useRef(null)
  const initial = useRef(initialDocument)
  const current = useRef(initialDocument)
  const history = useRef([])
  const future = useRef([])
  const normalize = () => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode
    const focus = selection?.focusNode
    const anchorOffset = selection?.anchorOffset
    const focusOffset = selection?.focusOffset
    const allowed = new Set(['P', 'DIV', 'H2', 'H3', 'BLOCKQUOTE', 'HR', 'FIGURE'])
    let paragraph
    let changed = false
    for (const node of [...root.current.childNodes]) {
      if (node.nodeType === 1 && allowed.has(node.tagName)) {
        paragraph = null
        continue
      }
      if (!paragraph) {
        paragraph = document.createElement('p')
        node.before(paragraph)
      }
      paragraph.append(node)
      changed = true
    }
    if (
      changed &&
      anchor &&
      focus &&
      root.current.contains(anchor) &&
      root.current.contains(focus)
    ) {
      selection.setBaseAndExtent(
        anchor,
        Math.min(anchorOffset, anchor.nodeType === 3 ? anchor.length : anchor.childNodes.length),
        focus,
        Math.min(focusOffset, focus.nodeType === 3 ? focus.length : focus.childNodes.length),
      )
    }
  }
  const emit = () => {
    normalize()
    const next = { ...initial.current, blocks: readChapterDom(root.current) }
    if (JSON.stringify(next.blocks) !== JSON.stringify(current.current.blocks)) {
      history.current = [...history.current.slice(-49), current.current]
      future.current = []
      current.current = next
      onChange(next)
    }
  }
  const undo = (redo = false) => {
    if (disabled) return
    const from = redo ? future : history
    const to = redo ? history : future
    const next = from.current.at(-1)
    if (!next) return
    from.current = from.current.slice(0, -1)
    to.current = [...to.current, current.current]
    current.current = next
    writeChapterDom(root.current, next)
    onChange(next)
    const range = document.createRange()
    range.selectNodeContents(root.current)
    range.collapse(false)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
  }
  useEffect(() => {
    writeChapterDom(root.current, initial.current)
  }, [])
  useImperativeHandle(ref, () => ({
    changeImage(index, changes) {
      if (disabled) return false
      const next = { ...current.current, blocks: [...current.current.blocks] }
      if (index === null) next.blocks.push(changes, { type: 'paragraph', inlines: [] })
      else if (next.blocks[index]?.type === 'image') {
        if (changes === null) next.blocks.splice(index, 1)
        else next.blocks[index] = { ...next.blocks[index], ...changes }
      } else return false
      if (!next.blocks.length) next.blocks.push({ type: 'paragraph', inlines: [] })
      if (
        next.blocks.length > 1000 ||
        next.blocks.filter(block => block.type === 'image').length > 20
      )
        return false
      history.current = [...history.current.slice(-49), current.current]
      future.current = []
      current.current = next
      writeChapterDom(root.current, next)
      onChange(next)
      return true
    },
    replace(document) {
      initial.current = document
      current.current = document
      history.current = []
      future.current = []
      writeChapterDom(root.current, document)
    },
    format(key) {
      normalize()
      const selection = window.getSelection()
      if (
        !selection?.rangeCount ||
        !root.current.contains(selection.anchorNode) ||
        !root.current.contains(selection.focusNode)
      )
        return false
      const commands = {
        bold: ['bold'],
        italic: ['italic'],
        underline: ['underline'],
        heading2: ['formatBlock', 'h2'],
        heading3: ['formatBlock', 'h3'],
        quote: ['formatBlock', 'blockquote'],
      }
      const command = commands[key]
      const activeRange = selection.getRangeAt(0).cloneRange()
      root.current.focus()
      selection.removeAllRanges()
      selection.addRange(activeRange)
      if (command?.[0] === 'formatBlock') {
        const range = selection.getRangeAt(0)
        let selected = [...root.current.children].filter(node => {
          if (['HR', 'FIGURE'].includes(node.tagName)) return false
          if (range.collapsed)
            return (
              node.contains(range.startContainer) ||
              (range.startContainer === root.current &&
                node === root.current.childNodes[range.startOffset])
            )
          if (!range.intersectsNode(node)) return false
          // Selection tools/browsers may anchor at the end of the preceding
          // paragraph. A touching boundary must not format that paragraph.
          const bounds = document.createRange()
          bounds.selectNodeContents(node)
          const intersection = range.cloneRange()
          if (intersection.compareBoundaryPoints(Range.START_TO_START, bounds) < 0)
            intersection.setStart(bounds.startContainer, bounds.startOffset)
          if (intersection.compareBoundaryPoints(Range.END_TO_END, bounds) > 0)
            intersection.setEnd(bounds.endContainer, bounds.endOffset)
          return !intersection.collapsed && intersection.toString().length > 0
        })
        if (!selected.length && !root.current.children.length) {
          const paragraph = document.createElement('p')
          paragraph.append(...root.current.childNodes)
          root.current.append(paragraph)
          selected = [paragraph]
        }
        if (!selected.length) return false
        const tag = selected.every(node => node.tagName.toLowerCase() === command[1])
          ? 'p'
          : command[1]
        const replacements = selected.map(node => {
          const replacement = document.createElement(tag)
          replacement.append(...node.childNodes)
          node.replaceWith(replacement)
          return replacement
        })
        const nextRange = document.createRange()
        nextRange.setStart(replacements[0], 0)
        nextRange.setEnd(replacements.at(-1), replacements.at(-1).childNodes.length)
        selection.removeAllRanges()
        selection.addRange(nextRange)
      } else if (command) document.execCommand(command[0], false, command[1])
      else if (key === 'sceneBreak') document.execCommand('insertHorizontalRule')
      else if (key === 'dialogue')
        document.execCommand('insertText', false, `“${selection.toString()}”`)
      else if (key === 'mention')
        document.execCommand('insertText', false, `@${selection.toString()}`)
      emit()
      return true
    },
  }))
  return (
    <div
      ref={root}
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={emit}
      onBeforeInput={event => {
        if (['historyUndo', 'historyRedo'].includes(event.nativeEvent.inputType)) {
          event.preventDefault()
          undo(event.nativeEvent.inputType === 'historyRedo')
        }
      }}
      onPaste={event => {
        event.preventDefault()
        if (disabled) return
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
        emit()
      }}
      onDrop={event => {
        event.preventDefault()
        if (!disabled) onError()
      }}
      onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
          event.preventDefault()
          undo(event.key.toLowerCase() === 'y' || event.shiftKey)
          return
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          onSave()
          return
        }
        if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
          event.preventDefault()
          const command = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()]
          document.execCommand(command)
          emit()
        }
      }}
      className="mt-6 min-h-[60dvh] w-full whitespace-pre-wrap break-words rounded-2xl bg-transparent text-base leading-8 text-ink outline-none sm:text-lg sm:leading-9 [&_p]:mb-5 [&_h2]:mb-5 [&_h2]:text-h2 [&_h3]:mb-5 [&_h3]:text-h3 [&_blockquote]:mb-5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic [&_hr]:my-6 [&_hr]:border-line"
    />
  )
}
