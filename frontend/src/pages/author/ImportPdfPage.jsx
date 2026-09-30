import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  GitMerge,
  Import,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card } from '../../components/ui'

const initialChapters = [
  ['Chapter 1: The Harbor Gate', 'pp. 4–18 · 3,400 words'],
  ["Chapter 2: The Alchemist's Lantern", 'pp. 19–35 · 4,120 words'],
  ['Chapter 3: Beneath the Obsidian Arch', 'pp. 36–51 · 3,890 words'],
  ['Chapter 4: The Whispering Keel', 'pp. 52–68 · 4,450 words'],
  ['Chapter 5: Songs of the Low Tide', 'pp. 69–84 · 4,030 words'],
]
const steps = [
  'Upload PDF',
  'Structure & Chapter Detection',
  'Review Chapter Splits',
  'Import as Drafts',
]

export function ImportPdfPage() {
  const fileRef = useRef(null)
  const [step, setStep] = useState(2)
  const [fileName, setFileName] = useState('Chronicles of the Sunken Spire.pdf')
  const [chapters, setChapters] = useState(
    initialChapters.map(([title, meta], index) => ({ id: index + 1, title, meta, selected: true })),
  )
  const [active, setActive] = useState(1)
  const [destination, setDestination] = useState('new')
  const [splitView, setSplitView] = useState(true)
  const [imported, setImported] = useState(false)
  const selected = chapters.filter(chapter => chapter.selected).length
  const chooseFile = event => {
    const file = event.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setStep(2)
      setImported(false)
    }
  }
  const addSplit = () =>
    setChapters(current => [
      ...current,
      {
        id: Date.now(),
        title: `Chapter ${current.length + 1}: Untitled Section`,
        meta: 'Manual split · Pending analysis',
        selected: true,
      },
    ])
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <Card className="rounded-2xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold">
                <ArrowLeft size={20} />
                Import Manuscript from PDF
              </h1>
              <p className="mt-2 text-sm text-muted">
                Transform formatted PDFs into structured, editable digital chapters ready for
                serialization.
              </p>
            </div>
            <Badge className="gap-2 px-4 py-2">
              <ShieldCheck size={15} className="text-brand" />
              Your manuscript stays local in this UI preview
            </Badge>
          </div>
          <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((label, index) => {
              const number = index + 1
              return (
                <button
                  key={label}
                  onClick={() => setStep(number)}
                  className="flex items-center gap-3 text-left"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full border ${number < step ? 'border-brand bg-brand/15 text-brand' : number === step ? 'border-brand bg-brand text-white' : 'border-line text-muted'}`}
                  >
                    {number < step ? <Check size={16} /> : number}
                  </span>
                  <span>
                    <small className="block text-[10px] text-muted">
                      Step {number}
                      {number === step ? ' (Active)' : ''}
                    </small>
                    <strong className={`text-xs ${number === step ? 'text-brand' : ''}`}>
                      {label}
                    </strong>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${step * 25}%` }}
            />
          </div>
        </Card>
        {step === 1 ? (
          <UploadStage fileRef={fileRef} chooseFile={chooseFile} />
        ) : (
          <>
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <section>
                <Card>
                  <div className="flex flex-col gap-3 bg-elevated p-4 sm:flex-row sm:items-center">
                    <span className="grid size-12 place-items-center rounded-xl bg-brand/15 text-brand">
                      <FileText />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{fileName}</strong>
                      <p className="text-[11px] text-muted">
                        184 pages · 62,400 words · OCR Quality: 99.4%
                      </p>
                    </div>
                    <input
                      ref={fileRef}
                      onChange={chooseFile}
                      className="hidden"
                      type="file"
                      accept="application/pdf"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => fileRef.current?.click()}
                      className="min-h-9 px-3 py-1 text-xs"
                    >
                      <RefreshCw size={14} />
                      Reparse File
                    </Button>
                  </div>
                  <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Detected Chapters &amp; Hierarchy</h2>
                      <p className="text-xs text-muted">
                        12 chapters identified using heading heuristic &amp; roman numeral parser.
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() =>
                          setChapters(current => current.map(item => ({ ...item, selected: true })))
                        }
                        className="text-brand"
                      >
                        Select All (12)
                      </button>
                      <span className="text-line">|</span>
                      <button
                        onClick={() =>
                          setChapters(current =>
                            current.map(item => ({ ...item, selected: false })),
                          )
                        }
                      >
                        Deselect
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 max-h-[690px] space-y-3 overflow-y-auto pr-1">
                    {chapters.map(chapter => (
                      <ChapterDetection
                        key={chapter.id}
                        chapter={chapter}
                        active={active === chapter.id}
                        onActive={() => setActive(chapter.id)}
                        onToggle={() =>
                          setChapters(current =>
                            current.map(item =>
                              item.id === chapter.id ? { ...item, selected: !item.selected } : item,
                            ),
                          )
                        }
                        onTitle={title =>
                          setChapters(current =>
                            current.map(item =>
                              item.id === chapter.id ? { ...item, title } : item,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                  <button
                    onClick={addSplit}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand p-4 text-xs font-semibold text-brand"
                  >
                    <Plus size={15} />
                    Add Manual Chapter Split Marker
                  </button>
                </Card>
              </section>
              <ExtractionInspector
                splitView={splitView}
                setSplitView={setSplitView}
                title={chapters.find(item => item.id === active)?.title || 'No chapter selected'}
              />
            </div>
            <Card className="mt-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-xl font-semibold">Target Destination</h2>
                  <p className="mt-1 text-xs text-muted">
                    Choose how parsed chapters should be placed into your NovelHub catalog.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:w-3/5">
                  {[
                    ['new', 'Create New Story', 'Chronicles of the Sunken Spire (New Book)'],
                    ['existing', 'Append to Existing Story', 'The Silent Forest (Serial)'],
                  ].map(([value, label, note]) => (
                    <button
                      key={value}
                      onClick={() => setDestination(value)}
                      className={`rounded-2xl border p-4 text-left ${destination === value ? 'border-brand bg-brand/10' : 'border-line'}`}
                    >
                      <strong className="text-xs">{label}</strong>
                      <p className="mt-1 text-[11px] text-muted">
                        {destination === value ? '●' : '○'} {note}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={14} />
                Back to Upload
              </Button>
              <Button variant="secondary" onClick={() => setStep(2)}>
                <RefreshCw size={14} />
                Reparse Document
              </Button>
              <span className="ml-auto text-xs text-muted">
                {selected} chapters selected (62,400 words)
              </span>
              <Button
                disabled={!selected}
                onClick={() => {
                  setImported(true)
                  setStep(4)
                }}
              >
                <Import size={15} />
                {imported ? 'Imported to Drafts' : `Import ${selected} Chapters to Drafts`}
              </Button>
            </div>
          </>
        )}
      </main>
    </AuthorLayout>
  )
}

function UploadStage({ fileRef, chooseFile }) {
  return (
    <Card className="mt-6 grid min-h-[430px] place-items-center border-dashed text-center">
      <div>
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-brand/15 text-brand">
          <Upload size={34} />
        </span>
        <h2 className="mt-5 text-2xl font-semibold">Drop your manuscript PDF here</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Upload a PDF up to 50 MB. NovelHub will detect headings, scene breaks, paragraph
          formatting and chapter boundaries.
        </p>
        <input
          ref={fileRef}
          onChange={chooseFile}
          className="hidden"
          type="file"
          accept="application/pdf"
        />
        <Button onClick={() => fileRef.current?.click()} className="mt-5">
          <Upload size={16} />
          Choose PDF File
        </Button>
        <p className="mt-4 text-[10px] text-muted">
          UI-only local preview · no file is transmitted
        </p>
      </div>
    </Card>
  )
}
function ChapterDetection({ chapter, active, onActive, onToggle, onTitle }) {
  return (
    <div
      onClick={onActive}
      className={`rounded-2xl border p-4 ${active ? 'border-brand bg-brand/5' : 'border-line'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={event => {
            event.stopPropagation()
            onToggle()
          }}
          className={`grid size-5 place-items-center rounded-full border ${chapter.selected ? 'border-brand bg-brand text-white' : 'border-line'}`}
        >
          {chapter.selected && <Check size={12} />}
        </button>
        <strong className="text-[10px] uppercase tracking-[.14em] text-brand">
          Chapter {String(chapter.id).padStart(2, '0')} · Head 1
        </strong>
        <Badge className="ml-auto">{chapter.meta}</Badge>
      </div>
      <input
        value={chapter.title}
        onChange={event => onTitle(event.target.value)}
        className="mt-3 w-full rounded-xl border border-line bg-elevated px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <div className="mt-3 flex justify-end gap-4 text-[10px]">
        <button onClick={() => window.alert('Split point added (mock).')} className="flex items-center gap-1">
          <Scissors size={12} />
          Split at Page
        </button>
        <button onClick={() => window.alert('Chapter merged with the next section (mock).')} className="flex items-center gap-1">
          <GitMerge size={12} />
          Merge Below
        </button>
      </div>
    </div>
  )
}
function ExtractionInspector({ splitView, setSplitView, title }) {
  return (
    <Card className="xl:sticky xl:top-24">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h2 className="text-xl font-semibold">Extraction Inspector</h2>
          <p className="text-xs text-muted">Source PDF vs extracted clean Markdown</p>
        </div>
        <div className="rounded-xl border border-line p-1">
          <button
            onClick={() => setSplitView(true)}
            className={`rounded-lg px-3 py-2 text-[10px] ${splitView ? 'bg-elevated text-brand' : ''}`}
          >
            Split View
          </button>
          <button
            onClick={() => setSplitView(false)}
            className={`rounded-lg px-3 py-2 text-[10px] ${!splitView ? 'bg-elevated text-brand' : ''}`}
          >
            Markdown Only
          </button>
        </div>
      </div>
      <div className={`mt-4 grid gap-3 ${splitView ? 'sm:grid-cols-2' : ''}`}>
        {splitView && (
          <div className="min-h-[520px] rounded-2xl border border-line bg-[#fffdf9] p-5 text-[#172033]">
            <p className="text-center text-[9px] uppercase tracking-[.18em] text-[#9ca3af]">
              Chronicles of the Sunken Spire
            </p>
            <h3 className="mt-12 border-y border-dashed border-brand py-4 text-center text-lg font-bold">
              CHAPTER I<br />
              THE HARBOR GATE
            </h3>
            <p className="mt-5 text-sm leading-7">
              The mist rolled across the brackish quay before sunrise, clinging to the
              salt-encrusted timbers of the northern breakwater. By the time Kael arrived with his
              copper lantern, the tide had already begun its retreat.
            </p>
          </div>
        )}
        <div className="min-h-[520px] rounded-2xl border border-line bg-elevated p-5">
          <div className="flex items-center justify-between text-[10px] text-brand">
            <span>Extracted Poppins Markdown</span>
            <span>Auto-formatted</span>
          </div>
          <Badge tone="green" className="mt-5">
            H1 TAG DETECTED
          </Badge>
          <h3 className="mt-3 text-xl font-semibold text-brand">{title}</h3>
          <Badge className="mt-5">PARAGRAPH 01</Badge>
          <p className="mt-3 text-sm leading-7">
            The mist rolled across the brackish quay before sunrise, clinging to the salt-encrusted
            timbers of the northern breakwater. By the time Kael arrived with his copper lantern,
            the tide had already begun its retreat, exposing the green slick of drowned masonry.
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-brand/10 p-4 text-xs">
        <p className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-brand" />
          Strip running headers &amp; page numbers
        </p>
        <p className="mt-2 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-brand" />
          Preserve author scene breaks (* * *)
        </p>
      </div>
    </Card>
  )
}
