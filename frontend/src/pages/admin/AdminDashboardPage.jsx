import { useState } from 'react'
import {
  Activity,
  BookOpen,
  Download,
  Ellipsis,
  Gauge,
  ShieldAlert,
  UserRoundCheck,
} from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { adminAudit, adminStats, serviceHealth } from '../../data/mock/admin'
import { Badge, Button, Card, Modal, Tabs } from '../../components/ui'

const icons = [Activity, BookOpen, UserRoundCheck, BookOpen, ShieldAlert, Gauge]
const bars = [
  [55, 35],
  [69, 46],
  [91, 66],
  [78, 52],
]

export function AdminDashboardPage() {
  const [metric, setMetric] = useState('signups')
  const [range, setRange] = useState('30d')
  const [exported, setExported] = useState(false)
  const [maintenance, setMaintenance] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [safeguard, setSafeguard] = useState(null)
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs text-muted">Admin Console / Operations &amp; System Health</p>
            <h1 className="mt-2 text-2xl font-bold">Platform Operations Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.alert('Live telemetry is updating in real time (mock).')} className="flex items-center gap-2 rounded-2xl border border-line px-4 py-2 text-xs">
              <span className="size-2 rounded-full bg-brand" />
              Live Stream <span className="rounded-full bg-brand px-2 py-1 text-white">ON</span>
            </button>
            <Button variant="secondary" onClick={() => setExported(true)}>
              <Download size={15} />
              {exported ? 'KPI Export Ready' : 'Export Weekly KPI'}
            </Button>
          </div>
        </div>
        <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-6">
          {adminStats.map(([label, value, note], index) => {
            const Icon = icons[index]
            return (
              <Card key={label} className="p-4">
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted">{label}</span>
                  <Icon
                    size={16}
                    className={
                      index === 1 ? 'text-orange' : index === 3 ? 'text-purple' : 'text-brand'
                    }
                  />
                </div>
                <strong className="mt-4 block text-2xl">{value}</strong>
                <span
                  className={`mt-2 block text-[10px] ${index === 1 ? 'text-orange' : 'text-brand'}`}
                >
                  {note}
                </span>
                <div className="mt-3 h-1 rounded-full bg-elevated">
                  <div className="h-full w-3/4 rounded-full bg-brand" />
                </div>
              </Card>
            )
          })}
        </section>
        <div className="mt-6 grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-xl font-semibold">Platform Growth &amp; Activity Trends</h2>
                  <p className="text-xs text-muted">
                    Comparative telemetry across ingestion rates and platform participants
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tabs
                    value={metric}
                    onChange={setMetric}
                    items={[
                      { value: 'signups', label: 'User Signups' },
                      { value: 'stories', label: 'Story Ingestion' },
                      { value: 'royalty', label: 'Coin Royalty' },
                    ]}
                  />
                  <select
                    value={range}
                    onChange={event => setRange(event.target.value)}
                    className="rounded-xl border border-line bg-surface px-3 text-xs"
                  >
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex h-64 items-end justify-around gap-5 border-b border-line px-4">
                {bars.map(([readers, authors], index) => {
                  const first = metric === 'stories' ? authors : metric === 'royalty' ? Math.round((readers + authors) / 2) : readers
                  const second = metric === 'stories' ? readers : metric === 'royalty' ? Math.max(18, authors - 8) : authors
                  const scale = range === '90d' ? 0.88 : 1
                  return (
                  <div key={index} className="flex h-full flex-1 items-end justify-center gap-2">
                    <div
                      className="w-1/3 max-w-12 rounded-t-xl bg-brand"
                      style={{ height: `${Math.round(first * scale)}%` }}
                    />
                    <div
                      className="w-1/3 max-w-12 rounded-t-xl bg-orange"
                      style={{ height: `${Math.round(second * scale)}%` }}
                    />
                  </div>
                  )
                })}
              </div>
              <div className="mt-3 grid grid-cols-4 text-center text-[9px] text-muted">
                <span>W1</span>
                <span>W2</span>
                <strong className="text-ink">W3 ★</strong>
                <span>W4</span>
              </div>
              <div className="mt-6 grid gap-3 rounded-3xl bg-elevated p-5 sm:grid-cols-3">
                <Metric label="Daily Active Users" value="245,600" note="↑ 4.1% weekly" />
                <Metric
                  label="Avg Reading Session"
                  value="38.5 min"
                  note="Across 6.2 chapters/day"
                />
                <Metric
                  label="Coin Circulation Flow"
                  value="$184,200 USD"
                  note="99.4% settlement clearance"
                />
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Recent Critical Administrative Actions</h2>
                  <p className="text-xs text-muted">
                    Chronological immutable audit stream for platform compliance
                  </p>
                </div>
                <button onClick={() => window.location.assign('/admin/audit-logs')} className="text-xs text-brand">View Full Audit Log →</button>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-line text-[9px] uppercase tracking-[.12em] text-muted">
                    <tr>
                      <th className="pb-3">Timestamp</th>
                      <th className="pb-3">Operator / Principal</th>
                      <th className="pb-3">System Event &amp; Scope</th>
                      <th className="pb-3">Outcome</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {adminAudit.map(([time, operator, event, status]) => (
                      <tr key={time}>
                        <td className="py-4 font-mono text-muted">{time}</td>
                        <td className="py-4 font-semibold">{operator}</td>
                        <td className="py-4">{event}</td>
                        <td className="py-4">
                          <Badge
                            tone={
                              status === 'Success'
                                ? 'green'
                                : status.includes('High')
                                  ? 'red'
                                  : 'orange'
                            }
                          >
                            {status}
                          </Badge>
                        </td>
                        <td>
                          <Ellipsis size={15} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            <Card>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Service Health</h2>
                  <p className="text-xs text-muted">Real-time microservice ping &amp; latency</p>
                </div>
                <Badge tone="green">100% OK</Badge>
              </div>
              <div className="mt-5 space-y-3">
                {serviceHealth.map(([name, stack, latency, uptime]) => (
                  <div key={name} className="rounded-2xl bg-elevated p-4">
                    <div className="flex justify-between">
                      <strong className="text-xs">{name}</strong>
                      <span className="text-[10px] text-brand">● {latency}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-muted">
                      <span>{stack}</span>
                      <span>{uptime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="text-xl font-semibold">Storage &amp; Capacity</h2>
              <Capacity label="PostgreSQL Primary Cluster" value="6.4 TB / 12 TB" percent={53} />
              <Capacity
                label="Media & Audio Object Vault"
                value="84.2 TB / 150 TB"
                percent={56}
                tone="orange"
              />
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-rose">
                <ShieldAlert />
                Platform Safeguards
              </h2>
              <p className="mt-2 text-xs text-muted">
                Emergency incident response mechanisms and fail-safe triggers
              </p>
              <Toggle
                label="Maintenance Mode"
                note="Show maintenance splash to readers"
                value={maintenance}
                setValue={setMaintenance}
              />
              <Toggle
                label="Read-Only Lock"
                note="Freeze new author submissions"
                value={readOnly}
                setValue={setReadOnly}
              />
              <Button
                variant="secondary"
                onClick={() => setSafeguard('Purge Global Edge CDN Cache')}
                className="mt-4 w-full"
              >
                Purge Global Edge CDN Cache
              </Button>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(safeguard)}
          title="Confirm Platform Safeguard"
          onClose={() => setSafeguard(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-rose/10 p-4">
            <ShieldAlert className="shrink-0 text-rose" />
            <p className="text-sm">
              {safeguard} will be simulated locally. No platform service will be changed.
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSafeguard(null)}>
              Cancel
            </Button>
            <Button onClick={() => setSafeguard(null)}>Confirm Mock Action</Button>
          </div>
        </Modal>
      </main>
    </AdminLayout>
  )
}
function Metric({ label, value, note }) {
  return (
    <div>
      <span className="text-[10px] text-muted">{label}</span>
      <strong className="mt-1 block text-xl">{value}</strong>
      <span className="text-[9px] text-brand">{note}</span>
    </div>
  )
}
function Capacity({ label, value, percent, tone = 'brand' }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-elevated">
        <div
          className={`h-full rounded-full ${tone === 'orange' ? 'bg-orange' : 'bg-brand'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[9px] text-muted">{percent}% utilized · replicas balanced</p>
    </div>
  )
}
function Toggle({ label, note, value, setValue }) {
  return (
    <button
      onClick={() => setValue(!value)}
      className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-elevated p-3 text-left"
    >
      <div className="flex-1">
        <strong className="block text-xs">{label}</strong>
        <span className="text-[10px] text-muted">{note}</span>
      </div>
      <span
        className={`flex h-6 w-11 items-center rounded-full p-1 ${value ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
      >
        <span className="size-4 rounded-full bg-white" />
      </span>
    </button>
  )
}
