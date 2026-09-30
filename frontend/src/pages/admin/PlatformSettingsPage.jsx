import { useMemo, useState } from 'react'
import {
  Bot,
  Cloud,
  Database,
  Download,
  Headphones,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Select, Tabs } from '../../components/ui'

const services = [
  [
    'TTS Neural Engine',
    'ElevenLabs & Custom WaveNet v3.4',
    '99.98%',
    '180ms',
    Headphones,
    'Configure Voices',
  ],
  ['AI Writing Co-Pilot', 'NovelCraft Engine 4.2 Pro', '99.92%', '820 RPM', Bot, 'Adjust Quota'],
  [
    'Storage & CDN Mesh',
    'AWS S3 + Cloudflare Enterprise',
    '100%',
    '14.8 TB',
    Cloud,
    'Purge Edge Cache',
  ],
  [
    'PostgreSQL Cluster',
    'Aurora Multi-AZ · Read Replicas',
    '99.99%',
    '28ms',
    Database,
    'Manage Backups',
  ],
]
const logs = [
  [
    '2026-10-24 16:12:04',
    'Marcus Vance',
    'service.update',
    'TTS Engine endpoint',
    'Medium',
    'ElevenLabs Voice Cluster',
  ],
  [
    '2026-10-24 15:40:22',
    'System Worker #02',
    'backup.snapshot',
    'Full PostgreSQL db',
    'Low',
    'RDS Aurora Cluster',
  ],
  [
    '2026-10-24 14:15:10',
    'Sarah Jenkins',
    'story.publish_approval',
    'Editorial queue',
    'Low',
    'Story #MS-88402',
  ],
  [
    '2026-10-24 11:02:45',
    'SecOps Daemon',
    'security.ip_block',
    'Edge perimeter firewall',
    'High',
    'IP Range 185.22.0.101/24',
  ],
  [
    '2026-10-24 09:18:30',
    'Marcus Vance',
    'rbac.permission_grant',
    'Staff capability update',
    'Critical',
    'Role: Moderator',
  ],
]
const sections = [
  'Platform Settings',
  'External Services & APIs',
  'TTS & Audio Narration',
  'AI Models & Orchestrator',
  'Storage & Media Mesh',
  'Audit Logs',
]

export function PlatformSettingsPage() {
  const [section, setSection] = useState('External Services & APIs')
  const [maintenance, setMaintenance] = useState(false)
  const [query, setQuery] = useState('')
  const [actor, setActor] = useState('All')
  const [modal, setModal] = useState('')
  const [saved, setSaved] = useState(false)
  const filtered = useMemo(
    () =>
      logs.filter(
        row =>
          (actor === 'All' || row[1] === actor) &&
          row.join(' ').toLowerCase().includes(query.toLowerCase()),
      ),
    [query, actor],
  )
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">
              Admin Console / Platform Operations / Services &amp; System Settings
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Platform Settings, External Services &amp; Audit
            </h1>
            <Badge tone="green">Production · US-East Cluster · Keyring Active</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal('Audit stream exported (mock).')}>
              <Download size={15} />
              Export Audit Stream
            </Button>
            <button
              onClick={() => setMaintenance(!maintenance)}
              className={`rounded-2xl border px-4 py-2 text-xs ${maintenance ? 'border-orange bg-orange/15 text-orange' : 'border-line bg-surface'}`}
            >
              Maintenance Mode {maintenance ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto border-b border-line pb-3">
          <Tabs
            value={section}
            onChange={setSection}
            items={sections.map(value => ({ value, label: value }))}
          />
        </div>
        <section className="mt-6">
          <h2 className="text-xl font-semibold">External Services &amp; Infrastructure Gateway</h2>
          <p className="text-xs text-muted">
            Operational runtime state, service mesh telemetry, and gateway credentials.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {services.map(service => (
              <ServiceCard
                key={service[0]}
                service={service}
                onAction={() => setModal(service[5])}
              />
            ))}
          </div>
        </section>
        <Card className="mt-6">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="text-brand" />
            <div>
              <h2 className="text-xl font-semibold">Platform Global Configuration Parameters</h2>
              <p className="text-xs text-muted">
                Core platform identities, reader defaults, monetization splits, and asset
                constraints.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field label="Site Name" defaultValue="NovelHub" />
            <Field label="Platform Motto" defaultValue="Stories for a brighter tomorrow." />
            <label className="text-xs font-semibold">
              Default Reader Theme
              <Select className="mt-2 w-full" defaultValue="light">
                <option value="light">Light Theme (Parchment)</option>
                <option value="dark">Dark Theme (Midnight)</option>
                <option value="system">Follow System</option>
              </Select>
            </label>
            <Field label="Coin-to-USD Conversion Rate" defaultValue="100 Coins = $0.99 USD" />
            <Field
              label="Author Revenue Share Split"
              defaultValue="70% Author / 20% Audio / 10% Platform"
            />
            <Field label="PDF Max Upload Size" defaultValue="50 MB" />
          </div>
          <div className="mt-6">
            <p className="text-xs font-semibold">Default Chapter Lock Threshold</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {['Chapter 3+', 'Chapter 4+ requires coin unlock', 'Chapter 6+'].map(
                (item, index) => (
                  <label
                    key={item}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-xs ${index === 1 ? 'border-brand bg-brand/5' : 'border-line'}`}
                  >
                    <input type="radio" name="threshold" defaultChecked={index === 1} />
                    {item}
                  </label>
                ),
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSaved(false)}>
              Discard Changes
            </Button>
            <Button onClick={() => setSaved(true)}>
              {saved ? 'Configuration Saved' : 'Save Configuration'}
            </Button>
          </div>
        </Card>
        <Card className="mt-6">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <ShieldCheck className="text-brand" />
                Immutable System Audit Logs Stream
              </h2>
              <p className="text-xs text-muted">
                Write-once, cryptographically verified record of operations and authorization
                changes.
              </p>
            </div>
            <Badge tone="green">WORM Storage Verified</Badge>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search log event ID, actor hash, or IP..."
            />
            <Select value={actor} onChange={event => setActor(event.target.value)}>
              <option value="All">All Actors</option>
              {[...new Set(logs.map(row => row[1]))].map(name => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-elevated text-[9px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-4 py-4">Timestamp UTC</th>
                  <th>Actor &amp; ID</th>
                  <th>Action &amp; Resource</th>
                  <th>Impact</th>
                  <th>Target / Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(row => (
                  <tr key={row[0]}>
                    <td className="px-4 py-4 font-mono text-[10px]">{row[0]}</td>
                    <td className="font-semibold">{row[1]}</td>
                    <td>
                      <code className="rounded-lg bg-brand/10 px-2 py-1 text-brand">{row[2]}</code>
                      <small className="mt-1 block text-muted">{row[3]}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          row[4] === 'Critical'
                            ? 'red'
                            : row[4] === 'High' || row[4] === 'Medium'
                              ? 'orange'
                              : 'blue'
                        }
                      >
                        {row[4]}
                      </Badge>
                    </td>
                    <td>{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-3 text-[10px] text-muted">
            <span>Cryptographically signed and replicated across write-once storage buckets.</span>
            <button
              onClick={() => setModal('Audit stream refreshed.')}
              className="flex items-center gap-1 text-brand"
            >
              <RefreshCw size={13} />
              Refresh stream
            </button>
          </div>
        </Card>
        <Modal open={Boolean(modal)} title="Platform operation" onClose={() => setModal('')}>
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <KeyRound className="shrink-0 text-brand" />
            <p className="text-sm">{modal} This protected operation is simulated locally.</p>
          </div>
          <Button onClick={() => setModal('')} className="mt-5 w-full">
            Confirm Mock Action
          </Button>
        </Modal>
      </main>
    </AdminLayout>
  )
}
function ServiceCard({ service, onAction }) {
  const [name, provider, uptime, metric, Icon, action] = service
  return (
    <Card>
      <div className="flex justify-between">
        <span className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon size={19} />
        </span>
        <Badge tone="green">● {uptime} uptime</Badge>
      </div>
      <h3 className="mt-5 font-semibold">{name}</h3>
      <p className="text-[10px] text-muted">{provider}</p>
      <div className="mt-4 rounded-2xl bg-elevated p-3">
        <div className="flex justify-between text-[10px]">
          <span>Runtime metric</span>
          <strong>{metric}</strong>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-line">
          <div className="h-full w-3/4 rounded-full bg-brand" />
        </div>
      </div>
      <Button variant="secondary" onClick={onAction} className="mt-4 w-full">
        {action}
      </Button>
    </Card>
  )
}
function Field({ label, defaultValue }) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <Input className="mt-2" defaultValue={defaultValue} />
    </label>
  )
}
