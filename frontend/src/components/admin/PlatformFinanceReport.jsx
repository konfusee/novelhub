import { useState } from 'react'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card, Input, Select, Tabs } from '../ui'
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
const filters = {
  overview: [],
  purchases: ['groupBy', 'policyId', 'authorId', 'storyId', 'chapterId'],
  topups: ['bankState'],
  wallets: ['walletPurpose', 'ledgerType'],
  disbursements: ['payoutStatus'],
}
const choices = {
  groupBy: ['day', 'week', 'month', 'story', 'chapter', 'author'],
  bankState: ['matched', 'unmatched', 'amount-mismatch', 'expired', 'already-paid', 'resolved'],
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
}
function initialDates() {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  return { from: today.slice(0, 7) + '-01', to: today, groupBy: 'month' }
}

function ReportTable({ title, columns, rows, emptyLabel, actions }) {
  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-h3">{title}</h3>
        {actions}
      </div>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label={title}>
          <table
            className={`w-full text-left text-sm ${columns.length > 5 ? 'min-w-[720px]' : 'min-w-[480px]'}`}
          >
            <thead>
              <tr className="border-b border-line bg-elevated">
                {columns.map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={`px-4 py-3 font-medium ${index === columns.length - 1 ? 'text-right' : ''}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-line last:border-0 hover:bg-elevated">
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      className={`px-4 py-4 leading-6 ${column === row.length - 1 ? 'whitespace-nowrap text-right tabular-nums' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>
      )}
    </Card>
  )
}

export function PlatformFinanceReport() {
  const { t, formatNumber } = useLocale()
  const m = (key, values) => t(`platformFinance.${key}`, values)
  const f = value => formatNumber(value ?? 0)
  const [tab, setTab] = useState('overview')
  const [advanced, setAdvanced] = useState(false)
  const [draft, setDraft] = useState(initialDates)
  const [applied, setApplied] = useState(draft)
  const [page, setPage] = useState(1)
  const [optionSearch, setOptionSearch] = useState('')
  const [optionSearchDraft, setOptionSearchDraft] = useState('')
  const optionsQuery = new URLSearchParams({
    search: optionSearch,
    ...(draft.authorId ? { authorId: draft.authorId } : {}),
    ...(draft.storyId ? { storyId: draft.storyId } : {}),
  })
  const options = useBackendResource(
    tab === 'purchases' && advanced ? `/admin/transactions/report-options?${optionsQuery}` : null,
    emptyOptions,
    selectOptions,
  )
  // Only send filters belonging to the visible report. Hidden filters cannot change its totals.
  const query = new URLSearchParams({
    groupBy: 'month',
    ...Object.fromEntries(filters[tab].filter(key => applied[key]).map(key => [key, applied[key]])),
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
  const table = (title, columns, rows, actions) => (
    <ReportTable
      title={m(title)}
      columns={columns.map(key => m(key))}
      rows={rows}
      emptyLabel={m('empty')}
      actions={actions}
    />
  )
  const metricKeys =
    tab === 'overview'
      ? ['topUpCoins', 'unlockCoins', 'platformCoins']
      : tab === 'purchases'
        ? ['purchasedChapters', 'authorCoins', 'platformCoins']
        : tab === 'topups'
          ? ['topUpCoins']
          : []
  const purchaseFilterCount = filters.purchases.filter(
    key => key !== 'groupBy' && applied[key],
  ).length
  const renderSelect = (key, values, labels = value => t('financialTransactions.' + value)) => (
    <label key={key} className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      {m(key)}
      <Select value={draft[key] ?? ''} onChange={event => update(key, event.target.value)}>
        {key !== 'groupBy' && <option value="">{m('all')}</option>}
        {values.map(value => (
          <option key={value} value={value}>
            {labels(value)}
          </option>
        ))}
      </Select>
    </label>
  )

  return (
    <section id="finance-report" className="mt-8 min-w-0 space-y-5">
      <div>
        <h2 className="text-h2">{m('title')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{m('hint')}</p>
      </div>
      <Tabs
        label={m('reportTabs')}
        items={Object.keys(filters).map(value => ({ value, label: m(value) }))}
        value={tab}
        onChange={value => {
          setTab(value)
          setPage(1)
          setAdvanced(false)
        }}
      />
      <Card>
        <p className="mb-4 text-sm leading-6 text-muted">{m(tab + 'Hint')}</p>
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={event => {
            event.preventDefault()
            setApplied(previous => ({
              ...previous,
              from: draft.from,
              to: draft.to,
              ...Object.fromEntries(filters[tab].map(key => [key, draft[key] ?? ''])),
            }))
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
          {filters[tab]
            .filter(key => choices[key])
            .map(key =>
              renderSelect(key, choices[key], key === 'groupBy' ? value => m(value) : undefined),
            )}
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit">{m('apply')}</Button>
            <Button type="button" variant="secondary" onClick={feed.retry}>
              {m('reload')}
            </Button>
          </div>
          {tab === 'purchases' && (
            <div className="sm:col-span-2 xl:col-span-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  aria-expanded={advanced}
                  onClick={() => setAdvanced(value => !value)}
                >
                  {m(advanced ? 'hideAdvanced' : 'advanced')}
                </Button>
                {purchaseFilterCount > 0 && (
                  <span className="text-sm text-brand">
                    {m('purchaseFiltersActive', { count: purchaseFilterCount })}
                  </span>
                )}
                {purchaseFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDraft(previous => ({
                        ...previous,
                        policyId: '',
                        authorId: '',
                        storyId: '',
                        chapterId: '',
                      }))
                      setApplied(previous => ({
                        ...previous,
                        policyId: '',
                        authorId: '',
                        storyId: '',
                        chapterId: '',
                      }))
                      setPage(1)
                    }}
                  >
                    {m('clearFilters')}
                  </Button>
                )}
              </div>
              {advanced && (
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                      {m('optionSearch')}
                      <Input
                        type="search"
                        maxLength={100}
                        value={optionSearchDraft}
                        onChange={event => setOptionSearchDraft(event.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOptionSearch(optionSearchDraft)}
                    >
                      {m('searchOptions')}
                    </Button>
                    <p className="w-full text-xs text-muted">{m('optionSearchHint')}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {['authorId', 'storyId', 'chapterId', 'policyId'].map(key => {
                      const rows =
                        key === 'authorId'
                          ? options.data.authors
                          : key === 'storyId'
                            ? options.data.stories.filter(
                                row => !draft.authorId || row.authorAccountId === draft.authorId,
                              )
                            : key === 'chapterId'
                              ? options.data.chapters.filter(row => row.storyId === draft.storyId)
                              : options.data.policies
                      return (
                        <label
                          key={key}
                          className="flex min-w-0 flex-col gap-2 text-sm font-medium"
                        >
                          {m(key === 'policyId' ? 'policy' : key)}
                          <Select
                            value={draft[key] ?? ''}
                            onChange={event => update(key, event.target.value)}
                            disabled={
                              options.status !== 'ready' || (key === 'chapterId' && !draft.storyId)
                            }
                          >
                            <option value="">{m('all')}</option>
                            {rows.map(row => (
                              <option key={row._id} value={row._id}>
                                {key === 'policyId'
                                  ? m('policyVersion', {
                                      version: row.version,
                                      date: new Date(row.effectiveAt).toLocaleDateString('vi-VN'),
                                    })
                                  : (row.displayName ?? row.title)}
                              </option>
                            ))}
                          </Select>
                        </label>
                      )
                    })}
                  </div>
                  {options.status === 'error' && (
                    <p role="alert" className="text-sm">
                      {m('optionsError')}{' '}
                      <Button type="button" variant="ghost" onClick={options.retry}>
                        {m('reload')}
                      </Button>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </Card>
      {feed.status === 'loading' ? (
        <p role="status">{m('loading')}</p>
      ) : feed.status === 'error' ? (
        <p role="alert">{m('error')}</p>
      ) : (
        <>
          {metricKeys.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metricKeys.map(key => (
                <Card key={key}>
                  <p className="text-sm text-muted">{m(key)}</p>
                  <p className="mt-2 text-h2 tabular-nums">{f(feed.data.summary[key])}</p>
                  <p className="mt-1 text-xs text-muted">{m('inSelectedPeriod')}</p>
                </Card>
              ))}
            </div>
          )}
          {tab === 'overview' && (
            <>
              <Card>
                <h3 className="text-h3">{m('activity')}</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {['registeredAccounts', 'purchasedChapters'].map(key => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-elevated p-4"
                    >
                      <dt className="text-sm text-muted">{m(key)}</dt>
                      <dd className="text-xl font-semibold tabular-nums">
                        {f(feed.data.summary[key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <p className="text-sm text-muted">{m('overviewNext')}</p>
              <details className="rounded-2xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {m('registrations')}
                </summary>
                <div className="mt-4">
                  {table(
                    'registrations',
                    ['period', 'accountStatus', 'accountCount'],
                    feed.data.registrations.map(row => [row.bucket, m(row.status), f(row.count)]),
                  )}
                </div>
              </details>
            </>
          )}
          {tab === 'purchases' && (
            <>
              {table(
                'unlocks',
                [applied.groupBy, 'purchaseCount', 'coinsSpent'],
                feed.data.unlocks.map(row => [row.label, f(row.count), f(row.coins)]),
                <FinanceExportButton
                  path={`/admin/transactions/report?${query}`}
                  filename="bao-cao-mo-khoa.csv"
                  disabled={!feed.data.totalGroups}
                  headers={[m('group'), m('purchaseCount'), m('coinsSpent')]}
                  mapRow={row => [row.label, row.count, row.coins]}
                />,
              )}
              {feed.data.totalGroups > 0 && (
                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(value => value - 1)}
                  >
                    {m('previous')}
                  </Button>
                  <span className="text-sm tabular-nums">{m('pageNumber', { page })}</span>
                  <Button
                    variant="secondary"
                    disabled={!feed.data.hasMore}
                    onClick={() => setPage(value => value + 1)}
                  >
                    {m('next')}
                  </Button>
                </div>
              )}
            </>
          )}
          {tab === 'topups' &&
            table(
              'bank',
              ['period', 'reconciliation', 'transactionCount', 'money'],
              feed.data.bank.map(row => [
                row.bucket,
                t('financialTransactions.' + row.status),
                f(row.count),
                f(row.amountVnd),
              ]),
            )}
          {tab === 'wallets' && (
            <>
              <p className="text-sm text-muted">{m('balanceHint')}</p>
              {table(
                'balances',
                ['walletKind', 'walletCount', 'balanceCoins'],
                feed.data.balances.map(row => [
                  t('financialTransactions.' + row.purpose),
                  f(row.count),
                  f(row.balanceCoins),
                ]),
              )}
              {table(
                'ledger',
                [
                  'period',
                  'walletKind',
                  'transactionKind',
                  'transactionCount',
                  'creditCoins',
                  'debitCoins',
                  'netCoins',
                ],
                (feed.data.ledger ?? []).map(row => [
                  row.bucket,
                  t('financialTransactions.' + row.purpose),
                  t('financialTransactions.' + row.type),
                  f(row.count),
                  f(row.creditCoins),
                  f(row.debitCoins),
                  f(row.netCoins),
                ]),
              )}
            </>
          )}
          {tab === 'disbursements' &&
            table(
              'payouts',
              ['period', 'result', 'paymentMode', 'payoutCount', 'coins'],
              feed.data.payouts.map(row => [
                row.bucket,
                m(row.result),
                m(row.mode),
                f(row.count),
                f(row.coins),
              ]),
            )}
        </>
      )}
    </section>
  )
}
