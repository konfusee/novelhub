import { useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Hash,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Tabs } from '../../components/ui'

const seed = [
  ['Fantasy & Mythic', 'fantasy-mythic', 'Soft Teal', '14,200', '2.4M'],
  ['Romance & Drama', 'romance-drama', 'Soft Rose', '21,800', '3.8M'],
  ['Mystery & Thriller', 'mystery-thriller', 'Soft Orange', '9,400', '1.1M'],
  ['Sci-Fi & Cyberpunk', 'scifi-cyberpunk', 'Soft Purple', '11,600', '1.9M'],
  ['Adventure & Exploration', 'adventure-exploration', 'Neutral Teal', '16,100', '1.5M'],
  ['Slice of Life & Cozy', 'slice-of-life-cozy', 'Soft Amber', '8,300', '920K'],
  ['Historical & Period', 'historical-period', 'Neutral Slate', '6,700', '640K'],
  ['Horror & Supernatural', 'horror-supernatural', 'Dark Slate', '5,200', '480K'],
  ['Comedy & Satire', 'comedy-satire', 'Soft Orange', '4,100', '380K'],
]
const tabs = [
  { value: 'categories', label: 'Categories · 9 Active' },
  { value: 'tags', label: 'Sub-genres & Tags · 148' },
  { value: 'ratings', label: 'Content Ratings · 3 Tiers' },
  { value: 'lifecycle', label: 'Story Lifecycle · 6 States' },
]

export function CategoriesConfigurationPage() {
  const [active, setActive] = useState('categories')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState(seed)
  const [modal, setModal] = useState('')
  const [ai, setAi] = useState(true)
  const [notice, setNotice] = useState('')
  const filtered = useMemo(
    () => categories.filter(item => item.join(' ').toLowerCase().includes(query.toLowerCase())),
    [categories, query],
  )
  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= categories.length) return
    setCategories(items => {
      const copy = [...items]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    })
    setNotice('Taxonomy order updated locally')
  }
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">
              Admin Console / Content Architecture / Taxonomy &amp; Ratings
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Categories, Tags &amp; Content Configuration
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setNotice('Search taxonomy re-index queued (mock).')}
            >
              <RefreshCw size={15} />
              Re-index Taxonomy
            </Button>
            <Button variant="secondary" onClick={() => setModal('Create tag entity')}>
              <Hash size={15} />
              Create Tag
            </Button>
            <Button onClick={() => setModal('Add new category')}>
              <Plus size={15} />
              Add Category
            </Button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto border-b border-line pb-3">
          <Tabs value={active} onChange={setActive} items={tabs} />
        </div>
        <Card className="mt-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Core Publishing Categories <Badge tone="blue">L1 Taxonomy</Badge>
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-muted">
                Core genres appear across discovery, reader navigation, and public filtering.
              </p>
            </div>
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Filter category records..."
              className="w-full lg:w-72"
            />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-elevated text-[9px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-4 py-4">Order</th>
                  <th>Category &amp; token</th>
                  <th>Tint identity</th>
                  <th>Active stories</th>
                  <th>Monthly reads</th>
                  <th>Placement</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item, index) => (
                  <tr key={item[1]} className="hover:bg-elevated/50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(index, -1)}>
                          <ChevronUp size={14} />
                        </button>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <button onClick={() => move(index, 1)}>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong className="block text-sm">{item[0]}</strong>
                      <span className="font-mono text-[10px] text-muted">/genre/{item[1]}</span>
                    </td>
                    <td>
                      <Badge tone={index % 3 === 1 ? 'red' : index % 3 === 2 ? 'orange' : 'green'}>
                        {item[2]}
                      </Badge>
                    </td>
                    <td className="font-semibold">{item[3]}</td>
                    <td className="font-semibold text-brand">{item[4]}</td>
                    <td>
                      <Badge tone="blue">{index < 4 ? 'Featured Row' : 'Discovery Grid'}</Badge>
                    </td>
                    <td>
                      <Badge tone="green">Active</Badge>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          aria-label={`Edit ${item[0]}`}
                          onClick={() => setModal(`Edit ${item[0]}`)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          aria-label={`Archive ${item[0]}`}
                          onClick={() => setNotice(`${item[0]} archived (mock).`)}
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3 text-[10px] text-muted">
            <span>
              Showing {filtered.length} of {categories.length} published categories
            </span>
            <button
              onClick={() => setNotice('Taxonomy schema downloaded (mock).')}
              className="flex items-center gap-1 text-brand"
            >
              <Download size={13} />
              Download Taxonomy Schema
            </button>
          </div>
        </Card>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">Tag Vocabulary &amp; AI Ingestion</h2>
                <p className="text-xs text-muted">
                  Control micro-genres, reader tropes, and auto-tagging rules.
                </p>
              </div>
              <Badge tone="blue">148 Tags</Badge>
            </div>
            <Input icon={Hash} placeholder="Search tags e.g. #SlowBurn" className="mt-5" />
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                '#SlowBurn',
                '#AncientMagic',
                '#MythologicalCreatures',
                '#SeaVoyage',
                '#DarkFantasy',
              ].map((tag, index) => (
                <Badge key={tag} tone={index === 4 ? 'orange' : 'green'}>
                  {tag} · {1240 - index * 190}
                </Badge>
              ))}
            </div>
            <button
              onClick={() => setAi(!ai)}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-elevated p-4 text-left"
            >
              <Sparkles className="text-brand" />
              <span className="flex-1">
                <strong className="block text-sm">Automated Tag Recommendation Engine</strong>
                <small className="text-muted">NovelCraft AI tagger on story ingest</small>
              </span>
              <span
                className={`flex h-6 w-11 items-center rounded-full p-1 ${ai ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
              >
                <span className="size-4 rounded-full bg-white" />
              </span>
            </button>
          </Card>
          <Card>
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">Content Ratings &amp; Age Gate</h2>
                <p className="text-xs text-muted">
                  Mandatory criteria for reader age tiers and compliance.
                </p>
              </div>
              <Badge tone="blue">3 Tiers</Badge>
            </div>
            <div className="mt-5 space-y-3">
              <Rating
                badge="G"
                title="All Audiences (G / PG)"
                note="General safe reading, no graphic violence, family friendly."
                tone="green"
              />
              <Rating
                badge="13+"
                title="Young Adult (PG-13)"
                note="Moderate stylized combat and thematic tension."
                tone="orange"
              />
              <Rating
                badge="18+"
                title="Mature (18+)"
                note="Explicit horror or mature romance requires verified age gate."
                tone="red"
              />
            </div>
          </Card>
        </div>
        <Card className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <strong>All Local Staging Changes Stored</strong>
            <p className="text-xs text-muted">
              Last published version: 4.12.0 · Auto-saved locally
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setNotice('ElasticSearch category index rebuilt (mock).')}
          >
            Rebuild Search Index
          </Button>
          <Button onClick={() => setNotice('Taxonomy configuration saved locally.')}>
            Save Taxonomy Configuration
          </Button>
        </Card>
        <Modal open={Boolean(modal)} title={modal} onClose={() => setModal('')}>
          <div className="space-y-3">
            <Input placeholder="Display name" />
            <Input placeholder="URL slug" />
            <Input placeholder="Description" />
            <Button
              onClick={() => {
                setModal('')
                setNotice('Configuration saved (mock).')
              }}
              className="w-full"
            >
              Save Configuration
            </Button>
          </div>
        </Modal>
        <Modal open={Boolean(notice)} title="Configuration update" onClose={() => setNotice('')}>
          <p className="text-sm">{notice}</p>
          <Button onClick={() => setNotice('')} className="mt-5 w-full">
            Done
          </Button>
        </Modal>
      </main>
    </AdminLayout>
  )
}
function Rating({ badge, title, note, tone }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line p-4">
      <Badge tone={tone}>{badge}</Badge>
      <div>
        <strong className="text-sm">{title}</strong>
        <p className="mt-1 text-xs text-muted">{note}</p>
      </div>
    </div>
  )
}
