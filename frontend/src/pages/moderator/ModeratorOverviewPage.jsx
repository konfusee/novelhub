import { useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  FileWarning,
  Flag,
  Gavel,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { ModeratorLayout } from '../../layouts'
import { moderationStats, urgentModerationItems } from '../../data/mock/moderation'
import { Badge, Button, Card, Modal } from '../../components/ui'

const metricIcons = [BookOpenCheck, Flag, Bot, Scale, Gavel]
const workload = [
  ['Fantasy & Mythic Fiction', 42, '2h 15m remaining', 'brand'],
  ['Romance & Contemporary Drama', 28, '3h 40m remaining', 'rose'],
  ['Sci-Fi & Cyberpunk', 18, '4h 05m remaining', 'purple'],
  ['Mystery & Thriller', 12, '5h 20m remaining', 'orange'],
]
const audit = [
  ['14:22', 'Approved Chapter 15 of “A Dragon’s Wish”', 'Pass Verified'],
  ['14:05', 'Changes Requested for “Echoes of Void”', 'Action Required'],
  ['13:40', 'Dismissed false report on “The Last Kingdom”', 'Dismissed'],
  ['12:55', 'Escalated IP Dossier #IP-4402 to Senior Legal Desk', 'Tier-2 Escalation'],
]

export function ModeratorOverviewPage() {
  const [priority, setPriority] = useState('All')
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState('')
  const items = urgentModerationItems.filter(
    item => priority === 'All' || item.tone === priority.toLowerCase(),
  )
  return (
    <ModeratorLayout>
      <main className="page-moderator py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-muted">
              Shift: 03h 45m · Reviewed Today: <strong className="text-ink">42 items</strong> · SLA
              Met: <strong className="text-brand">98.4%</strong>
            </p>
            <h1 className="mt-1 text-2xl font-bold">Moderator Operations Overview</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['All', 'Green', 'Orange', 'Red', 'Purple'].map(item => (
              <button
                key={item}
                onClick={() => setPriority(item)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs ${priority === item ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}
              >
                {item === 'All' ? 'All Priority' : item}
              </button>
            ))}
          </div>
        </div>
        <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
          {moderationStats.map(([label, value, note, tone], index) => {
            const Icon = metricIcons[index]
            return (
              <Card key={label} className="p-4">
                <div className="flex justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-muted">
                    {label}
                  </span>
                  <Icon
                    size={16}
                    className={
                      tone === 'red'
                        ? 'text-rose'
                        : tone === 'orange'
                          ? 'text-orange'
                          : tone === 'purple'
                            ? 'text-purple'
                            : 'text-brand'
                    }
                  />
                </div>
                <strong className="mt-4 block text-3xl">{value}</strong>
                <Badge tone={tone} className="mt-2">
                  {note}
                </Badge>
                <div className="mt-3 h-1 rounded-full bg-elevated">
                  <div
                    className={`h-full w-2/3 rounded-full ${tone === 'red' ? 'bg-rose' : tone === 'orange' ? 'bg-orange' : tone === 'purple' ? 'bg-purple' : 'bg-brand'}`}
                  />
                </div>
              </Card>
            )
          })}
        </section>
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <span className="size-2 rounded-full bg-red-600" />
                  Urgent Priority Action Items
                </h2>
                <span className="text-[10px] text-muted">{items.length} items require action</span>
              </div>
              <div className="mt-5 space-y-3">
                {items.map(item => (
                  <UrgentItem key={item.id} item={item} onOpen={() => setSelected(item)} />
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Workload &amp; Intake Volume by Category
                  </h2>
                  <p className="text-xs text-muted">
                    Real-time queue distribution across publishing genres
                  </p>
                </div>
                <Badge>Updated every 60s</Badge>
              </div>
              <div className="mt-5 space-y-5">
                {workload.map(([label, value, sla, tone]) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 text-xs">
                      <span>{label}</span>
                      <span className="ml-auto text-[10px] text-brand">SLA: {sla}</span>
                      <strong>{value}%</strong>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-elevated">
                      <div
                        className={`h-full rounded-full ${tone === 'rose' ? 'bg-rose' : tone === 'purple' ? 'bg-purple' : tone === 'orange' ? 'bg-orange' : 'bg-brand'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <h2 className="text-lg font-semibold">
                  Recent Moderator Decisions &amp; Audit Stream
                </h2>
                <button onClick={() => window.location.assign('/moderator/audit-trail')} className="text-xs text-brand">View Full Audit Log</button>
              </div>
              <div className="mt-5 space-y-4 border-l border-line pl-5">
                {audit.map(([time, title, status], index) => (
                  <div key={time} className="relative">
                    <span
                      className={`absolute -left-[25px] top-1 size-2.5 rounded-full ${index === 0 ? 'bg-brand' : index === 1 ? 'bg-orange' : index === 2 ? 'bg-blue-500' : 'bg-purple'}`}
                    />
                    <p className="text-xs">
                      <strong>{time}</strong> · {title} <Badge className="ml-2">{status}</Badge>
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      Recorded by Sarah Jenkins · Immutable audit reference
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="text-brand" />
                Policy Directives
              </h2>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between">
                  <strong className="text-xs">Creator Rights v4.2</strong>
                  <Badge tone="green">Active</Badge>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-muted">
                  Fair use excerpt guidelines extended to 350 words for critical commentary and
                  satire.
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-orange/40 bg-orange/10 p-4">
                <strong className="flex gap-2 text-xs text-orange">
                  <AlertTriangle size={14} />
                  AI Signal Guidance
                </strong>
                <p className="mt-2 text-[10px] leading-5 text-muted">
                  Automated telemetry scores are advisory benchmarks, not conclusive verdicts.
                </p>
              </div>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Queue Velocity &amp; SLA</h2>
              <div className="mt-4 space-y-5">
                <Sla label="Pre-Flight Triage" value={100} />
                <Sla label="Publishing Approval SLA" value={94} />
                <Sla label="User Report Resolution" value={96} />
              </div>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Escalation Desk</h2>
              <div className="mt-4 space-y-3">
                {['Senior Legal Desk', 'Lead Moderator'].map((name, index) => (
                  <div key={name} className="flex items-center gap-3 rounded-2xl bg-elevated p-3">
                    <span
                      className={`grid size-9 place-items-center rounded-full ${index ? 'bg-orange/20 text-orange' : 'bg-brand/20 text-brand'}`}
                    >
                      {index ? 'LM' : 'LD'}
                    </span>
                    <div>
                      <strong className="text-xs">{name}</strong>
                      <p className="text-[9px] text-muted">Online · On-call specialist</p>
                    </div>
                    <Button onClick={() => window.alert('Moderator ping sent (mock).')} variant="secondary" className="ml-auto min-h-8 px-2 py-1 text-[9px]">
                      Ping
                    </Button>
                  </div>
                ))}
              </div>
              <button onClick={() => window.alert('Emergency queue freeze requested (mock).')} className="mt-4 w-full rounded-2xl border border-dashed border-line p-3 text-xs text-muted">
                Trigger Emergency Queue Freeze
              </button>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(selected)}
          title={selected ? `${selected.kind} #${selected.id}` : ''}
          onClose={() => setSelected(null)}
        >
          <h3 className="font-semibold">{selected?.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{selected?.detail}</p>
          <textarea
            value={decision}
            onChange={event => setDecision(event.target.value)}
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Add internal decision note..."
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Defer
            </Button>
            <Button
              onClick={() => {
                setSelected(null)
                setDecision('')
              }}
            >
              <CheckCircle2 size={15} />
              Record Decision
            </Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}
function UrgentItem({ item, onOpen }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-4 sm:flex-row sm:items-center ${item.tone === 'red' ? 'border-rose/40' : item.tone === 'purple' ? 'border-purple/40' : 'border-line'}`}
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-2xl ${item.tone === 'red' ? 'bg-rose/15 text-rose' : item.tone === 'orange' ? 'bg-orange/15 text-orange' : item.tone === 'purple' ? 'bg-purple/15 text-purple' : 'bg-brand/15 text-brand'}`}
      >
        {item.kind === 'Report' ? (
          <FileWarning />
        ) : item.kind === 'Similarity Flag' ? (
          <ShieldCheck />
        ) : (
          <BookOpenCheck />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <Badge tone={item.tone}>
          {item.kind} #{item.id}
        </Badge>
        <p className="mt-1 text-[10px] text-muted">{item.meta}</p>
        <h3 className="mt-2 font-semibold">{item.title}</h3>
        <p className="mt-1 text-[10px] text-muted">{item.detail}</p>
      </div>
      <Button
        onClick={onOpen}
        className={`${item.tone === 'red' ? 'border-rose bg-rose' : item.tone === 'purple' ? 'border-purple bg-purple' : ''} shrink-0`}
      >
        {item.action}
      </Button>
    </div>
  )
}
function Sla({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <strong className="text-brand">{value}% Compliant</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-elevated">
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
