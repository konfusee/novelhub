import { useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Coins,
  Edit3,
  Eye,
  GripVertical,
  Headphones,
  Info,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { managedChapters } from '../../data/mock/author'
import { Badge, Button, Card, Input, Tabs } from '../../components/ui'

const tabItems = [
  { value: 'chapters', label: 'Chapters · 16' },
  { value: 'details', label: 'Story Details & Synopsis' },
  { value: 'media', label: 'Media & Audio Tracks · 8' },
  { value: 'reviews', label: 'Submission & Reviews' },
  { value: 'analytics', label: 'Story Analytics' },
]
const filters = ['All', 'Published', 'Scheduled', 'In Review', 'Draft']

export function StoryManagerPage() {
  const [tab, setTab] = useState('chapters')
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const chapters = useMemo(
    () =>
      managedChapters.filter(
        chapter =>
          (filter === 'All' || chapter.status === filter) &&
          chapter.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  )
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <p className="mb-4 text-xs text-muted">
          Author Studio&nbsp; / &nbsp;Stories&nbsp; / &nbsp;
          <strong className="text-ink">The Silent Forest</strong>
        </p>
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="grid h-32 w-24 shrink-0 place-items-center rounded-2xl bg-[#31584c] text-center text-white shadow-sm">
              <BookOpen />
              <strong className="text-xs">
                THE
                <br />
                SILENT
                <br />
                FOREST
              </strong>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">The Silent Forest</h1>
                <Badge tone="green">Serialized Novel</Badge>
              </div>
              <Badge tone="orange" className="mt-2">
                Fantasy &amp; Mystery
              </Badge>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                The wind moved gently through the ancient trees, carrying whispers of forgotten
                stories. Mira Lane&apos;s bestselling slow-burn mystery epic.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <span>
                  ▤ <strong>184,200</strong> words
                </span>
                <span>
                  ▥ <strong>15</strong> chapters published
                </span>
                <span>
                  ◉ <strong>1.2M</strong> reads
                </span>
                <span>
                  ★ <strong>4.8</strong> (3.4k reviews)
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              <Button onClick={() => window.location.assign('/author/stories/demo/chapters/chapter-1/edit')}>
                <Plus size={15} />
                Add New Chapter
              </Button>
              <Button onClick={() => window.alert('Story metadata editor opened (mock).')} variant="secondary">
                <Edit3 size={15} />
                Edit Metadata
              </Button>
              <Button onClick={() => window.location.assign('/stories/demo')} variant="secondary">
                <Eye size={15} />
                Preview as Reader
              </Button>
              <Button onClick={() => window.alert('More story actions opened (mock).')} variant="secondary" className="min-h-11 px-4">
                <MoreHorizontal size={17} />
              </Button>
            </div>
          </div>
        </Card>
        <div className="mt-5 overflow-x-auto border-b border-line">
          <Tabs value={tab} onChange={setTab} items={tabItems} />
        </div>
        {tab !== 'chapters' ? (
          <Card className="mt-5 min-h-80 text-center">
            <div className="grid min-h-64 place-items-center">
              <div>
                <Sparkles className="mx-auto text-purple" />
                <h2 className="mt-3 text-xl font-semibold">
                  {tabItems.find(item => item.value === tab)?.label}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  This management panel is ready for author workflow mock data.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="mt-5 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
            <section className="min-w-0">
              <Card className="rounded-b-none p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    icon={Search}
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search chapter title..."
                    className="sm:max-w-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    {filters.map(item => (
                      <button
                        key={item}
                        onClick={() => setFilter(item)}
                        className={`rounded-full border px-3 py-1.5 text-[11px] ${filter === item ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
              <div className="overflow-x-auto border-x border-line bg-surface">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-elevated text-[10px] uppercase tracking-[.15em] text-muted">
                    <tr>
                      <th className="px-4 py-3">Chapter &amp; Title</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Metrics</th>
                      <th className="px-3 py-3">Pricing</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {chapters.map(chapter => (
                      <ChapterRow key={chapter.number} chapter={chapter} />
                    ))}
                  </tbody>
                </table>
                {!chapters.length && (
                  <p className="p-10 text-center text-sm text-muted">
                    No chapters match this filter.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-b-3xl border border-line bg-surface p-4 text-xs text-muted">
                <span>Showing {chapters.length} of 16 chapters</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(value => Math.max(1, value - 1))}
                    className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>Page {page} of 3</span>
                  <button
                    onClick={() => setPage(value => Math.min(3, value + 1))}
                    className="rounded-lg border border-line px-3 py-1.5"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
            <StoryHealth />
          </div>
        )}
      </main>
    </AuthorLayout>
  )
}

function ChapterRow({ chapter }) {
  const tone =
    chapter.status === 'Published' ? 'green' : chapter.status === 'Scheduled' ? 'orange' : 'purple'
  return (
    <tr className="hover:bg-elevated/50">
      <td className="px-4 py-4">
        <div className="flex gap-3">
          <GripVertical size={15} className="mt-1 shrink-0 text-muted" />
          <div>
            <strong className="text-xs">
              Ch. {chapter.number}: {chapter.title}
            </strong>
            <p className="mt-1 text-[10px] leading-4 text-muted">{chapter.note}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        <Badge tone={tone}>● {chapter.status}</Badge>
      </td>
      <td className="px-3 py-4 text-xs">
        <strong>{chapter.words} words</strong>
        <p className="text-[10px] text-orange">{chapter.reads}</p>
      </td>
      <td className="px-3 py-4 text-xs">
        <span className="flex items-center gap-1">
          <Coins size={13} className="text-orange" />
          {chapter.price}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <Button
            variant={chapter.status === 'Draft' ? 'primary' : 'secondary'}
            onClick={() => window.location.assign('/author/stories/demo/chapters/chapter-1/edit')}
            className="min-h-8 px-3 py-1 text-[10px]"
          >
            {chapter.status === 'Draft'
              ? 'Continue Editing'
              : chapter.status === 'Scheduled'
                ? 'Reschedule'
                : 'Edit'}
          </Button>
          <button
            onClick={() => window.location.assign('/author/analytics')}
            className="rounded-lg border border-line p-2"
            aria-label={`Analytics for ${chapter.title}`}
          >
            <BarChart3 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function StoryHealth() {
  return (
    <aside className="space-y-5 xl:sticky xl:top-24">
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="text-brand" />
            Story Health &amp; Milestones
          </h2>
          <Info size={16} />
        </div>
        <Metric label="Weekly update consistency" value="100%" width="100%" />
        <Metric label="Reader retention rate" value="68%" width="68%" />
        <div className="mt-5 rounded-2xl border border-line bg-elevated p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs">
              <Headphones size={16} className="text-orange" />
              Audio narration status
            </span>
            <Badge tone="orange">6/15 chapters</Badge>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-surface">
            <div className="h-full w-2/5 rounded-full bg-orange" />
          </div>
          <button onClick={() => window.location.assign('/author/media')} className="mt-2 text-[10px] text-orange">Manage Tracks</button>
        </div>
        <p className="mt-5 text-xs font-semibold">Publishing Milestones</p>
        <div className="mt-3 space-y-3">
          {[
            ['Pass 100,000 words benchmark', true],
            ['Achieve 1,000,000 total reads', true],
            ['Record all 15 audio chapter tracks', false],
            ['Unlock Premium Hardcover Edition', false],
          ].map(([label, done]) => (
            <div key={label} className="flex gap-2 text-[11px]">
              <CheckCircle2 size={15} className={done ? 'text-brand' : 'text-muted'} />
              <span className={done ? 'line-through text-muted' : ''}>{label}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => window.location.assign('/author/analytics')} variant="secondary" className="mt-5 w-full">
          <BarChart3 size={15} />
          View Story Analytics
        </Button>
      </Card>
      <Card>
        <p className="flex items-center gap-2 text-xs font-semibold text-orange">
          <Sparkles size={15} />
          Editor&apos;s Advice for Act II
        </p>
        <p className="mt-3 text-xs leading-5 text-muted">
          Readers demonstrated a 74% retention spike around Chapter 14. Keep the pace crisp in
          Chapter 16 to maintain subscription unlock momentum.
        </p>
      </Card>
    </aside>
  )
}
function Metric({ label, value, width }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <strong className="text-brand">{value}</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-elevated">
        <div className="h-full rounded-full bg-brand" style={{ width }} />
      </div>
    </div>
  )
}
