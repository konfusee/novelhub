import { useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Copyright,
  Eye,
  ImagePlus,
  Save,
  Sparkles,
  Tags,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Input, Select } from '../../components/ui'

const genres = ['Fantasy', 'Romance', 'Mystery', 'Sci-Fi', 'Adventure', 'Slice of Life']
export function CreateStoryPage() {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('The Whisper of Sunken Stars')
  const [tagline, setTagline] = useState('An epic slow-burn fantasy across forgotten sea realms')
  const [synopsis, setSynopsis] = useState(
    'Beneath the twin moons of Eldoria, salvage diver Jennifer discovers a crystalline compass pulsating with celestial frequency. When the deep ocean trenches begin swallowing coastal sanctuaries, she must ally with an exiled tide-weaver to reawaken the sleeping Leviathans.',
  )
  const [genre, setGenre] = useState('Fantasy')
  const [tags, setTags] = useState([
    'SeaVoyage',
    'AncientMagic',
    'SlowBurn',
    'MythologicalCreatures',
  ])
  const [rating, setRating] = useState('PG-13')
  const [saved, setSaved] = useState(false)
  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-orange">
              Step {step} of 4 · Draft auto-saved
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Create New Story</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Configure your story identity, synopsis, and demographic taxonomy for the NovelHub
              reader community.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['Basic Info', 'Cover & Artwork', 'Classification', 'Publishing & Rights'].map(
              (label, index) => (
                <button
                  key={label}
                  onClick={() => setStep(index + 1)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${step === index + 1 ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}
                >
                  <span className="grid size-5 place-items-center rounded-full bg-black/10">
                    {index + 1}
                  </span>
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-5">
            <Card>
              <SectionTitle
                icon={BookOpen}
                title="Title & Manuscript Overview"
                note="All fields required unless marked"
              />
              <div className="mt-5 space-y-4">
                <Field label="Story Title *" count={`${title.length}/100`}>
                  <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                </Field>
                <Field label="Subtitle or Hook Tagline" count={`${tagline.length}/140`}>
                  <Input
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    maxLength={140}
                  />
                </Field>
                <Field label="Story Synopsis *" count={`${synopsis.length}/2000`}>
                  <div className="rounded-2xl border border-line bg-surface">
                    <div className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs">
                      <strong>B</strong>
                      <em>I</em>
                      <span>❞ Quote</span>
                      <button onClick={() => window.alert('AI polish suggestion generated (mock).')} className="ml-auto flex items-center gap-1 text-brand">
                        <Sparkles size={13} />
                        AI Polish Hint
                      </button>
                    </div>
                    <textarea
                      value={synopsis}
                      onChange={e => setSynopsis(e.target.value)}
                      className="min-h-40 w-full resize-y bg-transparent p-4 text-sm leading-6 outline-none"
                    />
                  </div>
                </Field>
              </div>
            </Card>
            <Card>
              <SectionTitle icon={Tags} title="Genre Classification & Discovery Tags" />
              <p className="mt-5 text-xs font-semibold">Primary Genre *</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {genres.map(item => (
                  <button
                    key={item}
                    onClick={() => setGenre(item)}
                    className={`rounded-full border px-4 py-2 text-xs ${genre === item ? 'border-brand bg-brand text-white' : 'border-line'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold">Sub-genres &amp; Reader Tags</p>
              <div className="mt-2 flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
                {tags.map(tag => (
                  <Badge key={tag} tone="green">
                    #{tag}
                    <button
                      onClick={() => setTags(current => current.filter(item => item !== tag))}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                <button
                  onClick={() => setTags(current => [...current, `Tag${current.length + 1}`])}
                  className="text-xs text-muted"
                >
                  + Add custom tag
                </button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold">Target Content Rating</p>
                  {['PG-13', '18+'].map(value => (
                    <button
                      onClick={() => setRating(value)}
                      key={value}
                      className={`mt-2 flex w-full items-start gap-2 rounded-2xl border p-3 text-left ${rating === value ? 'border-brand bg-brand/10' : 'border-line'}`}
                    >
                      <span
                        className={`mt-0.5 size-4 rounded-full border ${rating === value ? 'border-4 border-brand' : ''}`}
                      />
                      <div>
                        <strong className="text-xs">
                          {value === 'PG-13' ? 'All Audiences (PG-13)' : 'Mature (18+)'}
                        </strong>
                        <p className="mt-1 text-[10px] text-muted">
                          {value === 'PG-13'
                            ? 'Suitable for teen and broad general fiction readers.'
                            : 'Explicit romantic descriptions or dark themes.'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <Field label="Original Manuscript Language">
                  <Select className="w-full">
                    <option>English (US)</option>
                    <option>Vietnamese</option>
                    <option>Japanese</option>
                  </Select>
                  <p className="mt-3 rounded-xl bg-purple/10 p-3 text-xs text-purple">
                    Global Translation Lounge eligibility after chapter 5.
                  </p>
                </Field>
              </div>
            </Card>
            <Card className="flex gap-3">
              <Copyright className="shrink-0 text-brand" />
              <p className="text-xs leading-5">
                <strong>Original Work &amp; Copyright Declaration:</strong> I certify that “{title}”
                is an original manuscript created by me and adheres to the NovelHub Creator Rights
                Policy.
              </p>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setSaved(true)}>
                <Save size={15} />
                {saved ? 'Draft Saved' : 'Save as Draft'}
              </Button>
              <button onClick={() => window.location.assign('/author')} className="text-sm">Cancel</button>
              <Button onClick={() => setStep(Math.min(4, step + 1))}>
                Continue to Step {Math.min(4, step + 1)} <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Eye size={16} className="text-orange" />
                  Live Reader App Preview
                </h2>
                <Badge>Feed Card</Badge>
              </div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-line">
                <div className="relative grid aspect-[4/3] place-items-center bg-[#174c55] text-white">
                  <ImagePlus size={48} className="opacity-40" />
                  <Badge className="absolute left-3 top-3 bg-brand text-white">{genre}</Badge>
                  <div className="absolute inset-x-4 bottom-4">
                    <p className="text-[10px] text-orange">Serialized Original</p>
                    <h3 className="mt-1 text-xl font-bold leading-tight">
                      {title || 'Untitled Story'}
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold">Mira Lane · New Release</p>
                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted">{synopsis}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tags.slice(0, 3).map(tag => (
                      <Badge key={tag}>#{tag}</Badge>
                    ))}
                  </div>
                  <Button onClick={() => window.alert('Reader preview opened (mock).')} className="mt-4 w-full">
                    <BookOpen size={15} />
                    Read Preview
                  </Button>
                </div>
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Creator Guidelines Checklist</h2>
              <div className="mt-4 space-y-4">
                {[
                  ['Title Uniqueness', Boolean(title)],
                  ['Synopsis Depth', synopsis.length > 100],
                  ['HD Cover Specs (Next Step)', step > 1],
                  ['Opening Chapter Draft', false],
                ].map(([label, done]) => (
                  <div key={label} className="flex gap-2">
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${done ? 'border-brand bg-brand text-white' : 'border-line'}`}
                    >
                      {done && <Check size={12} />}
                    </span>
                    <div>
                      <strong className="text-xs">{label}</strong>
                      <p className="text-[10px] text-muted">
                        {done ? 'Requirement satisfied' : 'Complete this in the upcoming workflow.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-purple/10 p-4">
                <p className="text-xs font-semibold text-purple">PRO TIP</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Stories tagged with at least 3 high-intent tropes experience higher reader
                  retention.
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </AuthorLayout>
  )
}
function SectionTitle({ icon: Icon, title, note }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon size={18} className="text-brand" />
        {title}
      </h2>
      {note && <span className="text-[10px] text-muted">{note}</span>}
    </div>
  )
}
function Field({ label, count, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-xs font-semibold">
        <span>{label}</span>
        {count && <span className="font-normal text-muted">{count}</span>}
      </span>
      {children}
    </label>
  )
}
