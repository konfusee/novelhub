import { useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  BookCheck,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Tags,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'

const checklist = [
  [
    'Mandatory Metadata',
    'Title, synopsis, and cover image complete.',
    'Cover: 1600×2400 Hi-Res · Synopsis: 180 words',
    FileCheck2,
  ],
  [
    'Chapter Count & Word Minimums',
    '5 chapters prepared, 14,200 total words.',
    'Chapters 13–17 · Avg. 2,840 words/chapter',
    BookCheck,
  ],
  [
    'Content Rating & Trigger Warnings',
    'Tagged PG-13 for mild fantasy peril.',
    'PG-13: Peril / Action · No explicit violence flagged',
    Tags,
  ],
  [
    'Author Original Work & Rights Agreement',
    'Confirmed original copyright ownership.',
    'E-signature verified on file',
    ShieldCheck,
  ],
  [
    'Formatting & Typography Check',
    'Poppins formatting validated, no broken media links.',
    'Paragraph indents: Valid · 0 Orphan Tags',
    Eye,
  ],
]

export function SubmissionReviewPage() {
  const [verified, setVerified] = useState(checklist.map(() => true))
  const [notes, setNotes] = useState(
    'Volume II continues the lore from Volume I. Chapter 16 includes brief mythological combat scenes adhering to PG-13 guidelines.',
  )
  const [detail, setDetail] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const passed = verified.filter(Boolean).length
  const percent = Math.round((passed / checklist.length) * 100)
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <p className="text-xs text-muted">
          Author Studio / Novels / The Silent Forest /{' '}
          <strong className="text-brand">Moderation &amp; Submission</strong>
        </p>
        <Card className="mt-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-28 w-20 shrink-0 place-items-center rounded-xl bg-[#31584c] text-center text-xs font-bold text-white">
              THE
              <br />
              SILENT
              <br />
              FOREST
            </div>
            <div className="min-w-0 flex-1">
              <Badge tone="green">Manuscript Volume · ID: #MS-88402</Badge>
              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                Submit Manuscript for Moderation &amp; Publishing
              </h1>
              <p className="mt-2 text-sm">
                Story: <strong>The Silent Forest — Volume II: Roots of Eldoria</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 rounded-2xl border border-line bg-elevated p-4 text-center text-xs">
              <div className="border-r border-line px-4">
                <span className="text-muted">Total Chapters</span>
                <strong className="block text-base">5 New Chapters</strong>
              </div>
              <div className="px-4">
                <span className="text-muted">Word Count</span>
                <strong className="block text-base text-brand">14,200 words</strong>
              </div>
            </div>
          </div>
        </Card>
        <div className="mt-5 flex flex-col gap-4 border border-line bg-elevated p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 place-items-center rounded-full bg-brand text-white">
            <CheckCircle2 />
          </span>
          <div>
            <strong>
              {submitted ? 'Submitted to Moderator Queue' : 'Draft Review in Progress'}
            </strong>
            <p className="text-xs text-muted">
              {submitted
                ? 'Editorial review is now queued with an estimated 12–24 hour SLA.'
                : `Ready to Submit (${percent}% Checklist Passed)`}
            </p>
          </div>
          <div className="sm:ml-auto sm:w-56">
            <div className="h-2 rounded-full bg-surface">
              <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-brand">{percent}%</p>
          </div>
        </div>
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between border-b border-line pb-5">
                <div>
                  <h2 className="text-xl font-semibold">Pre-flight Submission Checklist</h2>
                  <p className="mt-1 text-xs text-muted">
                    Mandatory validation criteria required by NovelHub Quality Standards
                  </p>
                </div>
                <Badge>{passed} / 5 Verified</Badge>
              </div>
              <div className="mt-5 space-y-3">
                {checklist.map(([title, description, meta, Icon], index) => (
                  <div
                    key={title}
                    className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-start"
                  >
                    <button
                      onClick={() =>
                        setVerified(current =>
                          current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
                        )
                      }
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${verified[index] ? 'bg-brand/15 text-brand' : 'bg-rose/15 text-rose'}`}
                    >
                      {verified[index] ? <Check size={15} /> : <span>!</span>}
                    </button>
                    <Icon size={18} className="mt-1 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">
                        {index + 1}. {title}
                      </h3>
                      <p className="mt-1 text-xs text-muted">{description}</p>
                      <Badge className="mt-2">{meta}</Badge>
                    </div>
                    <button
                      onClick={() => setDetail(index)}
                      className="text-xs font-medium text-brand"
                    >
                      Review Details
                    </button>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Author Notes to Moderator</h2>
                  <p className="mt-2 text-xs text-muted">
                    Add specific lore continuity, trigger nuances, or context to help your assigned
                    editor review swiftly.
                  </p>
                </div>
                <span className="text-[10px] text-muted">Optional briefing</span>
              </div>
              <textarea
                value={notes}
                maxLength={500}
                onChange={event => setNotes(event.target.value)}
                className="mt-5 min-h-36 w-full rounded-2xl border border-line bg-elevated p-4 text-sm leading-6 outline-none focus:border-brand"
              />
              <p className="mt-2 text-right text-[10px] text-muted">
                {notes.length} / 500 characters
              </p>
              <p className="mt-3 flex items-center gap-2 text-[10px] text-muted">
                <LockKeyhole size={13} className="text-brand" />
                This note is private between you and the editorial moderation desk.
              </p>
            </Card>
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="grid size-10 place-items-center rounded-full bg-orange/15 text-orange">
                <Clock3 />
              </span>
              <div>
                <strong className="text-sm">Immediate Dispatch Available</strong>
                <p className="text-xs text-muted">
                  Queue assignment occurs within 10 minutes of submission.
                </p>
              </div>
              <Button variant="secondary" className="sm:ml-auto">
                <ArrowLeft size={14} />
                Save &amp; Return to Editor
              </Button>
              <Button disabled={passed < 5 || submitted} onClick={() => setConfirmOpen(true)}>
                <Send size={15} />
                {submitted ? 'Submitted' : 'Submit for Review'}
              </Button>
            </Card>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                Publication Pipeline &amp; Review SLA <BarChart3 className="text-brand" size={18} />
              </h2>
              <div className="mt-5 space-y-0">
                <PipelineStep
                  number="✓"
                  title="Pre-flight Check"
                  note="System validation for syntax, chapter integrity and metadata."
                  active
                />
                <PipelineStep
                  number="2"
                  title="Moderator Queue"
                  note="Assigned to Senior Editorial Team for content compliance."
                />
                <PipelineStep
                  number="3"
                  title="Approval & Release"
                  note="Instant publication to reader catalog and subscriber alerts."
                  muted
                />
              </div>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Recent Review History</h2>
              <p className="text-xs text-muted">Past logs for this novel series</p>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between">
                  <strong className="text-xs">Volume I (Chapters 1–12)</strong>
                  <Badge tone="green">Approved</Badge>
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  Reviewed on Oct 14, 2026 by Moderator Desk #4
                </p>
                <p className="mt-3 rounded-xl bg-surface p-3 text-xs italic leading-5">
                  “Clean prose, captivating world-building. Tagging confirmed accurate. Ready for
                  premium distribution.”
                </p>
              </div>
            </Card>
            <Card className="text-center text-sm italic leading-6">
              “Great stories sound even better with thoughtful editing. Our review team strives to
              preserve your creative voice while keeping readers safe.”
              <p className="mt-3 text-xs not-italic text-brand">— NovelHub Editorial Standards</p>
            </Card>
          </aside>
        </div>
        <Modal
          open={detail !== null}
          title={detail !== null ? checklist[detail][0] : ''}
          onClose={() => setDetail(null)}
        >
          <p className="text-sm leading-6 text-muted">{detail !== null && checklist[detail][1]}</p>
          <div className="mt-4 rounded-2xl bg-elevated p-4 text-sm">
            {detail !== null && checklist[detail][2]}
          </div>
          <Button onClick={() => setDetail(null)} className="mt-5 w-full">
            Close Details
          </Button>
        </Modal>
        <Modal open={confirmOpen} title="Confirm Submission" onClose={() => setConfirmOpen(false)}>
          <p className="text-sm leading-6 text-muted">
            This frontend mock will move the manuscript into the moderator queue. No external
            request or real publication occurs.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSubmitted(true)
                setConfirmOpen(false)
              }}
            >
              <Send size={15} />
              Confirm Mock Submission
            </Button>
          </div>
        </Modal>
      </main>
    </AuthorLayout>
  )
}

function PipelineStep({ number, title, note, active, muted }) {
  return (
    <div className={`relative flex gap-3 pb-6 ${muted ? 'opacity-50' : ''}`}>
      <div className="absolute left-3 top-6 h-full w-px bg-line" />
      <span
        className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs ${active ? 'border-brand bg-brand text-white' : 'border-brand bg-surface text-brand'}`}
      >
        {number}
      </span>
      <div>
        <strong className="text-xs">{title}</strong>
        <p className="mt-1 text-[10px] leading-4 text-muted">{note}</p>
        {active && <p className="mt-2 text-[10px] text-brand">Status: Passed &amp; Verified</p>}
      </div>
    </div>
  )
}
