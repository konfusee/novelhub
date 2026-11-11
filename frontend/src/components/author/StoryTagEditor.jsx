import { useState } from 'react'
import { Plus, X } from '../icons'
import { Badge, Button, Input } from '../ui'

const MAX_STORY_TAGS = 10
const TAG_PATTERN = /^[\p{L}\p{N}_-]{2,30}$/u

/**
 * Same normalization as the server: trim, drop a leading `#`, remove all whitespace, then NFC.
 * The pattern counts code points (`u` flag), so length is checked after normalization.
 */
const normalizeTag = value =>
  String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '')
    .normalize('NFC')
/** Duplicate key, as the server's `tagKeys`: NFC plus lowercase. */
const tagKey = tag => tag.normalize('NFC').toLowerCase()

/**
 * Free-form story tags shown as `#tag` chips: 2–30 letters, digits, `-` or `_`, at most 10,
 * unique case-insensitively. Used by the create form and the story manager edit form.
 */
export function StoryTagEditor({ id, tags, onChange, disabled = false, hint }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const inputId = `${id}-input`
  const hintId = `${id}-hint`
  const add = () => {
    const value = normalizeTag(draft)
    if (!value) return setError('Hãy nhập nội dung thẻ.')
    if (!TAG_PATTERN.test(value))
      return setError('Thẻ dài 2–30 ký tự, chỉ gồm chữ, số, gạch nối hoặc gạch dưới.')
    if (tags.some(tag => tagKey(tag) === tagKey(value)))
      return setError('Thẻ này đã có trong danh sách.')
    if (tags.length >= MAX_STORY_TAGS)
      return setError(`Tối đa ${MAX_STORY_TAGS} thẻ cho mỗi truyện.`)
    onChange([...tags, value])
    setDraft('')
    setError('')
  }
  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-semibold">
        Thẻ khám phá
      </label>
      <div className="mt-2 rounded-3xl border border-line bg-surface p-3">
        {tags.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2" aria-label="Thẻ đã thêm">
            {tags.map(tag => (
              <li key={tag}>
                <Badge tone="green" className="pr-1.5">
                  #{tag}
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Xóa thẻ ${tag}`}
                    onClick={() => onChange(tags.filter(item => item !== tag))}
                    className="-my-1.5 -mr-1 grid size-8 place-items-center rounded-full transition-colors hover:bg-brand/20 disabled:opacity-50 pointer-coarse:-my-2.5 pointer-coarse:-mr-2 pointer-coarse:size-11"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
            disabled={disabled}
            value={draft}
            placeholder="Ví dụ: BiAnCoDai"
            aria-invalid={Boolean(error)}
            aria-describedby={hintId}
            onChange={event => {
              setDraft(event.target.value)
              setError('')
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || tags.length >= MAX_STORY_TAGS}
            onClick={add}
          >
            <Plus size={16} aria-hidden="true" />
            Thêm thẻ
          </Button>
        </div>
      </div>
      <p
        id={hintId}
        role={error ? 'alert' : undefined}
        className={`mt-2 text-xs ${error ? 'text-rose-strong' : 'text-muted'}`}
      >
        {error ||
          hint ||
          `Tối đa ${MAX_STORY_TAGS} thẻ, mỗi thẻ 2–30 ký tự gồm chữ, số, gạch nối hoặc gạch dưới. Nhấn Enter để thêm.`}
      </p>
    </div>
  )
}
