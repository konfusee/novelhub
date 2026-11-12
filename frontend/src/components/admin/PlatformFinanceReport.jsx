import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card, Input, Select } from '../ui'
import { FinanceExportButton } from './FinanceExportButton'

const emptyOptions = { authors: [], stories: [], chapters: [], policies: [] }
const empty = { summary: {}, unlocks: [], registrations: [], balances: [], bank: [], payouts: [] }
const select = response => {
  if (
    !response?.summary ||
    ['unlocks', 'registrations', 'balances', 'bank', 'payouts'].some(
      key => !Array.isArray(response[key]),
    )
  )
    throw new Error('Invalid report')
  return response
}
const selectOptions = response => {
  if (Object.keys(emptyOptions).some(key => !Array.isArray(response?.[key])))
    throw new Error('Invalid report options')
  return response
}
const metrics = [
  'registeredAccounts',
  'purchasedChapters',
  'unlockCoins',
  'topUpCoins',
  'authorCoins',
  'platformCoins',
]

function initialDates() {
  const local = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  return { from: local.slice(0, 7) + '-01', to: local }
}

export function PlatformFinanceReport() {
  const { t, formatNumber } = useLocale()
  const m = key => t(`platformFinance.${key}`)
  const [draft, setDraft] = useState(() => ({
    ...initialDates(),
    groupBy: 'month',
    policyId: '',
    authorId: '',
    storyId: '',
    chapterId: '',
  }))
  const [optionSearch, setOptionSearch] = useState('')
  const [optionSearchDraft, setOptionSearchDraft] = useState('')
  const [applied, setApplied] = useState(draft)
  const [page, setPage] = useState(1)
  const options = useBackendResource(
    `/admin/transactions/report-options?${new URLSearchParams({ search: optionSearch, ...(draft.authorId ? { authorId: draft.authorId } : {}), ...(draft.storyId ? { storyId: draft.storyId } : {}) })}`,
    emptyOptions,
    selectOptions,
  )
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(applied).filter(([, value]) => value)),
    from: new Date(applied.from + 'T00:00:00+07:00').toISOString(),
    to: new Date(+new Date(applied.to + 'T00:00:00+07:00') + 86400000).toISOString(),
    page: String(page),
  })
  const feed = useBackendResource(`/admin/transactions/report?${query}`, empty, select)
  const update = (key, value) =>
    setDraft(previous => ({
      ...previous,
      [key]: value,
      ...(key === 'authorId'
        ? { storyId: '', chapterId: '' }
        : key === 'storyId'
          ? { chapterId: '' }
          : {}),
    }))
  const ready = feed.status === 'ready'
  const groups = [
    [
      'ledger',
      (feed.data.ledger ?? []).map(row => [
        row.bucket +
          ' · ' +
          t('financialTransactions.' + row.purpose) +
          ' · ' +
          t('financialTransactions.' + row.type),
        row.count,
        row.netCoins,
      ]),
    ],
    [
      'registrations',
      feed.data.registrations.map(row => [row.bucket + ' · ' + m(row.status), row.count, null]),
    ],
    [
      'balances',
      feed.data.balances.map(row => [
        t('financialTransactions.' + row.purpose),
        row.count,
        row.balanceCoins,
      ]),
    ],
    [
      'bank',
      feed.data.bank.map(row => [
        [row.bucket, t('financialTransactions.' + row.status)].filter(Boolean).join(' · '),
        row.count,
        row.amountVnd,
      ]),
    ],
    [
      'payouts',
      feed.data.payouts.map(row => [
        [row.bucket, m(row.result), m(row.mode)].filter(Boolean).join(' · '),
        row.count,
        row.coins,
      ]),
    ],
  ]
  return (
    <section id="finance-report" className="mt-8 space-y-5">
      <div>
        <h2 className="text-h2">{m('title')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{m('hint')}</p>
      </div>
      <Card>
        <form
          className="mb-5 flex flex-wrap items-end gap-3"
          onSubmit={event => {
            event.preventDefault()
            setOptionSearch(optionSearchDraft)
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
            {m('optionSearch')}
            <Input
              type="search"
              maxLength={100}
              value={optionSearchDraft}
              onChange={event => setOptionSearchDraft(event.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary">
            {m('searchOptions')}
          </Button>
          <p className="w-full text-xs text-muted">{m('optionSearchHint')}</p>
        </form>
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={event => {
            event.preventDefault()
            setApplied(draft)
            setPage(1)
          }}
        >
          {['from', 'to'].map(key => (
            <label key={key} className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              {m(key)}
              <Input
                type="date"
                required
                value={draft[key]}
                max={key === 'from' ? draft.to : undefined}
                min={key === 'to' ? draft.from : undefined}
                onChange={event => update(key, event.target.value)}
              />
            </label>
          ))}
          <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
            {m('groupBy')}
            <Select value={draft.groupBy} onChange={event => update('groupBy', event.target.value)}>
              {['day', 'week', 'month', 'story', 'chapter', 'author'].map(value => (
                <option key={value} value={value}>
                  {m(value)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
            {m('policy')}
            <Select
              value={draft.policyId}
              onChange={event => update('policyId', event.target.value)}
              disabled={options.status !== 'ready'}
            >
              <option value="">{m('all')}</option>
              {options.data.policies.map(row => (
                <option key={row._id} value={row._id}>
                  {t('platformFinance.policyVersion', {
                    version: row.version,
                    date: new Date(row.effectiveAt).toLocaleDateString('vi-VN'),
                  })}
                </option>
              ))}
            </Select>
          </label>
          {['authorId', 'storyId', 'chapterId'].map(key => {
            const rows =
              key === 'authorId'
                ? options.data.authors
                : key === 'storyId'
                  ? options.data.stories.filter(
                      row => !draft.authorId || row.authorAccountId === draft.authorId,
                    )
                  : options.data.chapters.filter(row => row.storyId === draft.storyId)
            return (
              <label key={key} className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                {m(key)}
                <Select
                  value={draft[key]}
                  onChange={event => update(key, event.target.value)}
                  disabled={options.status !== 'ready' || (key === 'chapterId' && !draft.storyId)}
                >
                  <option value="">{m('all')}</option>
                  {rows.map(row => (
                    <option key={row._id} value={row._id}>
                      {row.displayName ?? row.title}
                    </option>
                  ))}
                </Select>
              </label>
            )
          })}
          {Object.entries({
            walletPurpose: ['reader-coins', 'author-earnings', 'system-earnings'],
            ledgerType: [
              'topup-credit',
              'unlock-debit',
              'allocation-credit',
              'withdrawal-debit',
              'adjustment',
              'reversal',
              'deletion-forfeiture',
            ],
            payoutStatus: ['pending', 'paid'],
            bankState: [
              'matched',
              'unmatched',
              'amount-mismatch',
              'expired',
              'already-paid',
              'resolved',
            ],
          }).map(([key, values]) => (
            <label key={key} className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              {m(key)}
              <Select value={draft[key] ?? ''} onChange={event => update(key, event.target.value)}>
                <option value="">{m('all')}</option>
                {values.map(value => (
                  <option key={value} value={value}>
                    {t('financialTransactions.' + value)}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          <div className="flex flex-wrap items-end gap-3">
            <Button type="submit">{m('apply')}</Button>
            <Button type="button" variant="secondary" onClick={feed.retry}>
              {m('reload')}
            </Button>
          </div>
        </form>
        <p className="mt-4 text-xs leading-5 text-muted">{m('scopeHint')}</p>
        {options.status === 'error' && (
          <p role="alert" className="mt-3 text-sm">
            {m('optionsError')}{' '}
            <Button variant="ghost" onClick={options.retry}>
              {m('reload')}
            </Button>
          </p>
        )}
      </Card>
      {feed.status === 'loading' ? (
        <p role="status">{m('loading')}</p>
      ) : feed.status === 'error' ? (
        <p role="alert">{m('error')}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(key => (
              <Card key={key}>
                <p className="text-sm text-muted">{m(key)}</p>
                <p className="mt-2 text-h2 tabular-nums">
                  {formatNumber(feed.data.summary[key] ?? 0)}
                </p>
              </Card>
            ))}
          </div>
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-h3">{m('unlocks')}</h3>
              <FinanceExportButton
                path={`/admin/transactions/report?${query}`}
                filename="bao-cao-mo-khoa.csv"
                disabled={!ready || !feed.data.totalGroups}
                headers={[m('group'), m('count'), m('coins')]}
                mapRow={row => [row.label, row.count, row.coins]}
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {['group', 'count', 'coins'].map(key => (
                      <th scope="col" key={key} className="px-3 py-3">
                        {m(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feed.data.unlocks.map(row => (
                    <tr key={row.id} className="border-b border-line">
                      <td className="px-3 py-3">{row.label}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(row.count)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(row.coins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!feed.data.unlocks.length && <p className="mt-4 text-muted">{m('empty')}</p>}
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(value => value - 1)}
              >
                {m('previous')}
              </Button>
              <span className="self-center">{page}</span>
              <Button
                variant="secondary"
                disabled={!feed.data.hasMore}
                onClick={() => setPage(value => value + 1)}
              >
                {m('next')}
              </Button>
            </div>
          </Card>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {groups.map(([key, rows]) => (
              <Card key={key} className="min-w-0">
                <h3 className="text-h3">{m(key)}</h3>
                <div className="mt-4 max-h-80 overflow-auto">
                  <table className="w-full min-w-[400px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        {['group', 'count', key === 'bank' ? 'money' : 'coins'].map(column => (
                          <th key={column} scope="col" className="px-3 py-3">
                            {m(column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([label, count, amount]) => (
                        <tr key={label} className="border-b border-line">
                          <td className="px-3 py-3">{label}</td>
                          <td className="px-3 py-3 tabular-nums">{formatNumber(count)}</td>
                          <td className="px-3 py-3 tabular-nums">
                            {amount == null ? '—' : formatNumber(amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!rows.length && <p className="mt-4 text-muted">{m('empty')}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
