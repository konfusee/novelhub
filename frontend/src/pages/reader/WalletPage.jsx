import { useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  Check,
  ChevronDown,
  Coins,
  Download,
  Heart,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { coinPackages, transactions } from '../../data/mock/wallet'

const filters = [
  ['all', 'All Transactions'],
  ['added', 'Coins Added'],
  ['unlock', 'Chapters Unlocked'],
  ['tip', 'Author Tips'],
]

export function WalletPage() {
  const [balance, setBalance] = useState(1420)
  const [autoUnlock, setAutoUnlock] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [faq, setFaq] = useState(0)
  const [records, setRecords] = useState(transactions)
  const shown = useMemo(
    () => (filter === 'all' ? records : records.filter(item => item.type === filter)),
    [filter, records],
  )
  const purchase = () => {
    if (!selected) return
    setBalance(current => current + selected.total)
    setRecords(current => [
      {
        date: 'Just now',
        type: 'added',
        label: 'Recharge',
        item: `${selected.label} (${selected.price})`,
        amount: selected.total,
        balance: balance + selected.total,
      },
      ...current,
    ])
    setSelected(null)
  }
  return (
    <ReaderLayout>
      <main className="page-reader py-7">
        <p className="text-[10px] uppercase tracking-[.2em] text-brand">
          Financial Ledger · Reader Account #NH-94821
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Wallet &amp; Coins</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Manage your balance, unlock serialized chapters, and support your favorite authors safely
          with transparent micro-tokens.
        </p>
        <div className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs text-muted">Available Reader Balance</p>
                  <p className="mt-2 flex items-center gap-3 text-4xl font-bold">
                    <span className="grid size-11 place-items-center rounded-full bg-orange/20 text-orange">
                      <Coins />
                    </span>
                    {balance.toLocaleString()} <span className="text-lg text-orange">Coins</span>
                  </p>
                  <p className="mt-2 text-[10px] text-muted">
                    Conversion Index: <strong className="text-ink">100 Coins ≈ $0.99 USD</strong> ·
                    Non-expiring credit
                  </p>
                </div>
                <div>
                  <Button onClick={() => setSelected(coinPackages[1])}>
                    <Plus size={16} />
                    Recharge Balance
                  </Button>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-brand">
                    <LockKeyhole size={12} />
                    256-bit mock checkout
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
                <div>
                  <strong className="text-sm">Auto-unlock new chapters when released</strong>
                  <p className="text-xs text-muted">
                    Automatically use stored coins for bookmarked novels.
                  </p>
                </div>
                <button
                  aria-label="Toggle auto unlock"
                  onClick={() => setAutoUnlock(!autoUnlock)}
                  className={`h-7 w-12 rounded-full p-1 ${autoUnlock ? 'bg-brand' : 'bg-line'}`}
                >
                  <span
                    className={`block size-5 rounded-full bg-white transition ${autoUnlock ? 'translate-x-5' : ''}`}
                  />
                </button>
              </div>
            </Card>
            <section>
              <h2 className="text-xl font-semibold">Top Up Coins Packages</h2>
              <p className="text-xs text-muted">
                Instant refill directly applied to your digital reading ledger.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {coinPackages.map(pack => (
                  <Card
                    key={pack.id}
                    className={`relative flex min-h-72 flex-col p-4 ${pack.badge ? 'border-brand' : ''}`}
                  >
                    {pack.badge && (
                      <Badge
                        tone="green"
                        className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap"
                      >
                        {pack.badge}
                      </Badge>
                    )}
                    <p className="text-xs text-muted">{pack.label}</p>
                    <p className="mt-4 text-2xl font-bold">{pack.coins.toLocaleString()}</p>
                    {pack.bonus && (
                      <p className="text-[10px] text-orange">
                        +{pack.bonus} Bonus · {pack.total.toLocaleString()} Total
                      </p>
                    )}
                    <p className="mt-4 text-xs leading-5 text-muted">{pack.note}</p>
                    <div className="mt-auto border-t border-line pt-4">
                      <strong className="text-lg">{pack.price}</strong>
                      <Button
                        variant={pack.badge ? 'primary' : 'secondary'}
                        onClick={() => setSelected(pack)}
                        className="mt-3 w-full min-h-9 px-2 py-1 text-xs"
                      >
                        {pack.badge ? 'Purchase Pack' : 'Select Tier'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Transaction History</h2>
                  <p className="text-xs text-muted">
                    Detailed ledger of unlocks, refills, and creator gratuities.
                  </p>
                </div>
                <button className="flex items-center gap-1 text-xs text-brand">
                  <Download size={14} />
                  Export
                </button>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto">
                {filters.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${filter === value ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="border-y border-line text-[10px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="py-3">Date &amp; Time</th>
                      <th>Type</th>
                      <th>Item Details</th>
                      <th>Amount</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(item => (
                      <tr key={`${item.date}-${item.item}`} className="border-b border-line">
                        <td className="py-4 text-muted">{item.date}</td>
                        <td
                          className={
                            item.amount > 0
                              ? 'text-brand'
                              : item.type === 'tip'
                                ? 'text-purple'
                                : 'text-ink'
                          }
                        >
                          {item.label}
                        </td>
                        <td>{item.item}</td>
                        <td className={item.amount > 0 ? 'font-semibold text-brand' : ''}>
                          {item.amount > 0 ? '+' : ''}
                          {item.amount.toLocaleString()} Coins
                        </td>
                        <td className="text-muted">{item.balance.toLocaleString()}</td>
                        <td>
                          <Badge tone="green">Completed</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <aside className="min-w-0 space-y-5">
            <Card>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                  <BadgeDollarSign />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Where do your coins go?</h2>
                  <p className="text-xs text-muted">Direct Creator Economics</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-muted">
                NovelHub operates on a fair, ethical serial ecosystem. When you spend coins, funds
                directly power the writers shaping these worlds.
              </p>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between text-sm">
                  <span>Indie Creators Share</span>
                  <strong className="text-brand">70%</strong>
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                  <span className="w-[70%] bg-brand" />
                  <span className="w-[20%] bg-orange" />
                  <span className="w-[10%] bg-muted" />
                </div>
              </div>
              <p className="mt-4 flex gap-2 rounded-xl bg-orange/10 p-3 text-xs text-orange">
                <Heart size={15} />
                Over $1.4M in micro-royalties paid to independent authors.
              </p>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Coins &amp; Wallet FAQ</h2>
              <div className="mt-4 divide-y divide-line">
                {[
                  'Do purchased coins expire?',
                  'What is the chapter unlock price?',
                  'Can I request a coin refund?',
                  'What are bonus coins?',
                ].map((question, index) => (
                  <button
                    key={question}
                    onClick={() => setFaq(faq === index ? -1 : index)}
                    className="w-full py-3 text-left text-xs font-semibold"
                  >
                    <span className="flex items-center justify-between">
                      {question}
                      <ChevronDown size={14} />
                    </span>
                    {faq === index && (
                      <p className="mt-2 font-normal leading-5 text-muted">
                        Coins never expire and remain attached to your reader profile. Support can
                        review eligible transactions.
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </Card>
            <Card className="flex gap-3 bg-purple/10">
              <Sparkles className="shrink-0 text-orange" />
              <div>
                <strong className="text-sm">Daily Reading Reward</strong>
                <p className="mt-1 text-xs text-muted">
                  Read 20 mins today to earn +5 free coins toward your next chapter.
                </p>
              </div>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(selected)}
          title="Confirm mock purchase"
          onClose={() => setSelected(null)}
        >
          {selected && (
            <div>
              <div className="flex items-center justify-between rounded-2xl bg-elevated p-4">
                <div>
                  <strong>{selected.label}</strong>
                  <p className="text-xs text-muted">{selected.total.toLocaleString()} coins</p>
                </div>
                <strong className="text-xl">{selected.price}</strong>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                <ShieldCheck className="text-brand" />
                UI demo only — no real payment is processed.
              </p>
              <Button onClick={purchase} className="mt-5 w-full">
                <Check size={16} />
                Complete Mock Purchase
              </Button>
            </div>
          )}
        </Modal>
      </main>
    </ReaderLayout>
  )
}
