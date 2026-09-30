import { useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Coins,
  Download,
  Lightbulb,
  Search,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Select } from '../../components/ui'

const daily = [
  32, 39, 44, 78, 63, 48, 46, 52, 49, 62, 58, 85, 69, 55, 50, 53, 48, 65, 88, 72, 61, 58, 62, 67,
  93, 80, 68, 64, 73, 82,
]
const retention = [100, 92, 89, 87.5, 86, 85.4, 85, 84.8, 84.2, 84, 83.7, 83.5, 83.1, 82.9, 82.6]
const channels = [
  ['Rankings Podium', '#1 Fantasy Serial Weekly', '42%', '524,370', '+24.1%', Trophy],
  ['Category Browse', 'Fantasy & Adventure taxonomy', '28%', '349,580', '+11.5%', BarChart3],
  [
    'Followed Author Alerts',
    'Subscriber push notifications',
    '20%',
    '249,700',
    '+5.4%',
    UsersRound,
  ],
  ['Direct Search', 'Keyword & author queries', '10%', '124,850', '+3.2%', Search],
]

export function AuthorAnalyticsPage() {
  const [story, setStory] = useState('The Silent Forest')
  const [range, setRange] = useState('Last 30 Days')
  const [exported, setExported] = useState(false)
  const multiplier = range === 'Last 7 Days' ? 0.42 : range === 'Last 90 Days' ? 2.35 : 1
  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] text-muted">Author Studio / Performance Telemetry</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Author Analytics &amp; Reader Insights
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={story} onChange={event => setStory(event.target.value)}>
              <option>The Silent Forest</option>
              <option>Echoes of Eldoria</option>
              <option>All Stories</option>
            </Select>
            <Select value={range} onChange={event => setRange(event.target.value)}>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
            </Select>
            <Button onClick={() => setExported(true)}>
              <Download size={15} />
              {exported ? 'Report Ready' : 'Export Report'}
            </Button>
          </div>
        </div>
        <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi
            icon={BookOpen}
            label="Total Story Reads"
            value={Math.round(1248500 * multiplier).toLocaleString()}
            delta="↗ +18.4%"
          />
          <Kpi
            icon={UsersRound}
            label="Unique Engaged Readers"
            value={Math.round(84200 * multiplier).toLocaleString()}
            delta="↗ +6.2%"
            tone="orange"
          />
          <Kpi
            icon={Sparkles}
            label="Avg. Chapter Completion"
            value="82.6%"
            delta="Top 5%"
            tone="purple"
          />
          <Kpi
            icon={Coins}
            label="Coin Royalties & Tips"
            value={`$${(1420.5 * multiplier).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            delta="98,400 Coins"
            tone="orange"
          />
        </section>
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Readership Growth &amp; Daily Reads</h2>
                <p className="text-xs text-muted">
                  Daily active reading sessions over {range.toLowerCase()}. Spikes reflect weekend
                  serial releases.
                </p>
              </div>
              <div className="flex gap-4 text-[10px]">
                <span className="text-brand">■ Daily Volume</span>
                <span className="text-orange">■ Release Peaks</span>
              </div>
            </div>
            <div className="mt-8 flex h-56 items-end gap-1 border-b border-line px-1 sm:gap-2">
              {daily.map((height, index) => (
                <div
                  key={index}
                  title={`Day ${index + 1}: ${height}K reads`}
                  className={`min-w-0 flex-1 rounded-t-sm ${[3, 11, 18, 24].includes(index) ? 'bg-orange' : 'bg-brand'} ${index % 3 === 0 ? 'opacity-55' : 'opacity-90'}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[9px] text-muted">
              <span>Day 1</span>
              <span>Day 7</span>
              <span>Day 14</span>
              <span>Day 21</span>
              <span>Day 30</span>
            </div>
            <p className="mt-8 border-t border-line pt-4 text-xs">
              <strong className="text-brand">
                ⚡ Average weekend reader spike: +46.2% engagement
              </strong>
              <br />
              <span className="text-muted">Calculated across 4 scheduled Saturday releases</span>
            </p>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Format Distribution</h2>
            <p className="text-xs text-muted">Text Reading vs Audio Lounge listens</p>
            <div
              className="mx-auto mt-7 grid size-40 place-items-center rounded-full border-[26px] border-brand"
              style={{ borderRightColor: '#F4A261' }}
            >
              <div className="text-center">
                <span className="text-[10px] text-muted">PRIMARY</span>
                <strong className="block text-2xl">65%</strong>
                <span className="text-[10px]">Text</span>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <FormatRow
                color="bg-brand"
                label="Text Reading"
                value="811,525 reads"
                percent="65%"
              />
              <FormatRow
                color="bg-orange"
                label="Audio Lounge"
                value="436,975 plays"
                percent="35%"
              />
            </div>
          </Card>
        </div>
        <Card className="mt-6">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Chapter-by-Chapter Retention &amp; Reader Drop-off Curve
              </h2>
              <p className="mt-1 text-xs text-muted">
                Tracks drop-off from Chapter 1 through 15 for <em>{story}</em>. Benchmark exceeds
                platform average by 14.2%.
              </p>
            </div>
            <div className="flex gap-4 text-[10px]">
              <span className="text-brand">■ Actual Story Retention</span>
              <span className="text-muted">— Platform Baseline (68%)</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {retention.map((value, index) => (
              <button
                key={index}
                onClick={() => window.alert(`Chapter ${index + 1} retention: ${value}%`)}
                className={`rounded-xl border p-3 text-center ${index === 14 ? 'border-brand bg-brand/10' : 'border-line bg-elevated'}`}
              >
                <span className="text-[9px] text-muted">Ch. {index + 1}</span>
                <span
                  className="mx-auto mt-3 block h-16 max-w-24 rounded-full bg-brand"
                  style={{ width: `${Math.max(55, value)}%`, opacity: 0.4 + (value / 100) * 0.6 }}
                />
                <strong className="mt-2 block text-[10px]">{value}%</strong>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-elevated p-4 sm:flex-row sm:items-center">
            <Lightbulb className="text-brand" />
            <div>
              <strong className="text-xs">Insight: Negligible Drop-off after Chapter 2</strong>
              <p className="text-[10px] text-muted">
                92% of readers who complete the opening premise continue through the latest chapter
                release.
              </p>
            </div>
            <Button onClick={() => window.alert('Chapter detail analytics opened (mock).')} variant="secondary" className="sm:ml-auto min-h-9 text-xs">
              View Chapter Details
            </Button>
          </div>
        </Card>
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
          <Card>
            <h2 className="text-lg font-semibold">Reader Demographics &amp; Discovery Channels</h2>
            <p className="text-xs text-muted">
              Inbound source traffic routing readers into {story}
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="border-b border-line text-[10px] text-muted">
                  <tr>
                    <th className="pb-3">Channel Source</th>
                    <th className="pb-3 text-right">Share</th>
                    <th className="pb-3 text-right">Reads Converted</th>
                    <th className="pb-3 text-right">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {channels.map(([name, note, share, reads, growth, Icon]) => (
                    <tr key={name}>
                      <td className="py-4">
                        <div className="flex gap-3">
                          <span className="grid size-8 place-items-center rounded-full bg-elevated text-brand">
                            <Icon size={14} />
                          </span>
                          <div>
                            <strong>{name}</strong>
                            <p className="text-[9px] text-muted">{note}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right font-semibold">{share}</td>
                      <td className="py-4 text-right">{reads}</td>
                      <td className="py-4 text-right text-brand">{growth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div className="flex justify-between">
              <div>
                <h2 className="text-lg font-semibold">Reader Profile &amp; Devices</h2>
                <p className="text-xs text-muted">Device, theme and subscription behavior</p>
              </div>
              <Badge tone="green">Verified</Badge>
            </div>
            <div className="mt-5 space-y-5">
              <Progress label="Mobile App (eReader)" value={74} />
              <Progress label="Web Desktop / Tablet" value={26} color="orange" />
              <Progress label="Night / Dark Theme" value={58} color="purple" />
              <Progress label="Premium Pass Holders" value={68.4} />
            </div>
            <div className="mt-6 rounded-2xl bg-elevated p-4 text-xs italic leading-5">
              “{story}&apos;s serialized world-building consistently ranks in NovelHub&apos;s 99th
              percentile for multi-chapter binge retention.”
              <p className="mt-2 text-[9px] not-italic text-muted">
                — NovelHub Editorial Review Board
              </p>
            </div>
          </Card>
        </div>
      </main>
    </AuthorLayout>
  )
}

function Kpi({ icon: Icon, label, value, delta, tone = 'brand' }) {
  const color = tone === 'orange' ? 'text-orange' : tone === 'purple' ? 'text-purple' : 'text-brand'
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon size={17} className={color} />
      </div>
      <strong className="mt-6 block text-2xl">{value}</strong>
      <Badge tone={tone === 'brand' ? 'green' : tone} className="mt-3">
        {delta}
      </Badge>
    </Card>
  )
}
function FormatRow({ color, label, value, percent }) {
  return (
    <div className="rounded-xl bg-elevated p-3">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${color}`} />
        <strong className="text-xs">{label}</strong>
        <strong className="ml-auto text-xs">{percent}</strong>
      </div>
      <p className="mt-1 text-right text-[10px] text-muted">{value}</p>
    </div>
  )
}
function Progress({ label, value, color = 'brand' }) {
  const bar = color === 'orange' ? 'bg-orange' : color === 'purple' ? 'bg-purple' : 'bg-brand'
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-elevated">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
