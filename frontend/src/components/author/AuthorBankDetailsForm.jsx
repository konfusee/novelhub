import { useId, useRef, useState } from 'react'
import { Button, Card, Input } from '../ui'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'

const emptyDetails = {
  bankName: '',
  accountNumber: '',
  accountHolder: '',
}

const fields = [
  { key: 'bankName', maxLength: 120 },
  { key: 'accountNumber', maxLength: 34 },
  { key: 'accountHolder', maxLength: 120 },
]

export function AuthorBankDetailsForm() {
  const { t } = useLocale()
  const resource = useBackendDocument('/author/bank-details', null)
  const copy = key => t(`authorFinance.bank.${key}`)
  const loading = resource.status === 'loading'
  const ready = resource.status === 'ready' && resource.data != null

  return (
    <Card>
      <h2 className="text-h3">{copy('title')}</h2>
      <p className="mt-2 text-sm text-muted">{copy('description')}</p>

      {loading ? (
        <p role="status" className="mt-5 text-sm text-muted">
          {copy('loading')}
        </p>
      ) : !ready ? (
        <div className="mt-5 space-y-3">
          <p role="alert">{copy('loadError')}</p>
          <Button variant="secondary" onClick={resource.retry}>
            {t('reader.retry')}
          </Button>
        </div>
      ) : (
        <BankDetailsFields initialDetails={resource.data.bankDetails} />
      )}
    </Card>
  )
}

function BankDetailsFields({ initialDetails }) {
  const { t } = useLocale()
  const formId = useId()
  const copy = key => t(`authorFinance.bank.${key}`)

  const [saved, setSaved] = useState(() => ({
    ...emptyDetails,
    ...initialDetails,
  }))

  const [draft, setDraft] = useState(() => ({
    ...emptyDetails,
    ...initialDetails,
    accountNumber: '',
  }))

  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const inFlight = useRef(false)

  const changed = fields.some(({ key }) =>
    key === 'accountNumber' ? Boolean(draft[key]) : draft[key] !== saved[key],
  )

  function handleChange(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
    setFeedback(null)
  }

  function handleDiscard() {
    setDraft({ ...saved, accountNumber: '' })
    setFeedback(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!changed || inFlight.current) return

    inFlight.current = true
    setSaving(true)
    setFeedback(null)

    try {
      const result = await apiRequest('/author/bank-details', {
        method: 'PUT',
        body: {
          bankName: draft.bankName.trim(),
          accountNumber: draft.accountNumber.trim(),
          accountHolder: draft.accountHolder.trim(),
        },
      })

      if (!result?.bankDetails) {
        throw new Error('Invalid bank details response')
      }

      setSaved({ ...result.bankDetails })
      setDraft({ ...result.bankDetails, accountNumber: '' })
      setFeedback('saved')
    } catch {
      setFeedback('error')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5">
      {saved.accountNumber && (
        <p className="mb-4 text-sm text-muted">{copy('replaceNumberHint')}</p>
      )}
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        {fields.map(({ key, maxLength }) => {
          const inputId = `${formId}-${key}`

          return (
            <div key={key}>
              <label htmlFor={inputId} className="mb-2 block text-sm font-semibold">
                {copy(key)}
              </label>
              <Input
                id={inputId}
                name={key}
                value={draft[key]}
                maxLength={maxLength}
                placeholder={key === 'accountNumber' ? saved.accountNumber : undefined}
                pattern={key === 'accountNumber' ? '[0-9]{6,34}' : undefined}
                inputMode={key === 'accountNumber' ? 'numeric' : undefined}
                required
                autoComplete={key === 'accountHolder' ? 'name' : 'off'}
                onChange={event => handleChange(key, event.target.value)}
              />
            </div>
          )
        })}

        {changed && (
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleDiscard}>
              {copy('discard')}
            </Button>

            <Button type="submit">{saving ? copy('saving') : copy('save')}</Button>
          </div>
        )}
      </fieldset>

      {feedback && (
        <p role={feedback === 'error' ? 'alert' : 'status'} className="mt-4 text-sm">
          {copy(feedback === 'saved' ? 'saved' : 'saveError')}
        </p>
      )}
    </form>
  )
}
