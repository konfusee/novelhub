import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gavel,
  Scale,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { ModeratorLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'

const chapters = [
  ['Ch. 13: Silver Passage', 'Clean'],
  ['Ch. 14: Echoes', 'Clean'],
  ['Ch. 15: The Threshold', 'Clean'],
  ['Ch. 16: Heart of Ironwood', '1 Flag'],
  ['Ch. 17: Afterlight', 'Pending'],
]
const policyChecks = [
  'Original author rights verified',
  'Cover artwork meets 1600×2400 specs',
  'Content rating PG-13 matches narrative violence',
  'No prohibited commercial spam or external links',
  'Chapter formatting & sans-serif Poppins compliant',
]
const prose = [
  'The canopy of the ancient Ironwood did not sway with the wind. It stood rigid, carved of petrified amber and obsidian vines that drank what little starlight escaped the northern haze. Kaelen tightened his wrist bindings, feeling the steady hum of the meridian sigil pulsing beneath his glove.',
  '“Three leagues north,” Sorsha murmured, not lifting her gaze from the cracked slate compass. Her breathing was measured, though the silver embroidery along her mantle had frayed during their descent through the weeping gorge. “If the crest holds, the inner ward will open before dawn. If it fails, we will be standing directly in their line of sight.”',
  'Neither of them spoke of the scouts they had left at the ford. The silence of the Great Weave was answer enough. Across serialized fantasy traditions, silence often preceded reckoning; Kaelen knew the lore better than any novice scribe from the outer ring.',
  'They crossed the frostline in silence. Beneath their soles, the crystalline foliage fractured with a tone like chiming porcelain. With every dozen paces, the ambient temperature dipped further, frosting the bronze edges of their scabbards until small sparks jumped between their cloaks.',
  '“Listen,” Sorsha halted, her gloved fingers resting on the pommel of her side-blade. “The ridge is vacant. The wardens shouldn’t have abandoned the southern overlook unless something broke the gate wards from inside.”',
  'A tremor shuddered through the peat. It was not the organic shudder of shifting earth, but the metallic crunch of iron roots shearing against subterranean rock.',
]

export function ContentReviewDetailPage() {
  const [activeChapter, setActiveChapter] = useState(3)
  const [reviewed, setReviewed] = useState(false)
  const [checks, setChecks] = useState(policyChecks.map(() => true))
  const [notes, setNotes] = useState(
    'Prose verified. Action scenes in Ch. 16 adhere to standard PG-13 fantasy guidelines. No explicit gore. Tags are accurate and appropriate for reader discovery.',
  )
  const [decision, setDecision] = useState(null)
  const [completed, setCompleted] = useState('')
  return (
    <ModeratorLayout>
      <main className="page-moderator py-5">
        <div className="flex flex-col gap-4 border-b border-line pb-4 lg:flex-row lg:items-center">
          <button className="flex items-center gap-2 text-xs text-brand">
            <ArrowLeft size={14} />
            Return to Submission Queue
          </button>
          <div className="lg:border-l lg:border-line lg:pl-5">
            <p className="text-xs">
              Reviewing Manuscript <strong>#MS-88402</strong>
            </p>
            <p className="text-[10px] text-muted">
              Elena Vance · Verified Author · Submitted 18h ago
            </p>
          </div>
          <Badge tone="orange" className="lg:ml-auto">
            SLA Timer: 5h 42m remaining
          </Badge>
          <Button onClick={() => setDecision('Approve')} className="min-h-9 text-xs">
            Approve
          </Button>
          <Button
            onClick={() => setDecision('Request Changes')}
            variant="secondary"
            className="min-h-9 text-xs"
          >
            Request Changes
          </Button>
        </div>
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[210px_minmax(0,1fr)_330px]">
          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex gap-3">
                <span className="grid h-24 w-16 place-items-center rounded-xl bg-brand text-center text-[10px] font-bold text-white">
                  THE
                  <br />
                  SILENT
                  <br />
                  FOREST
                </span>
                <div>
                  <Badge tone="orange">PG-13</Badge>
                  <h2 className="mt-2 text-xs font-semibold">The Silent Forest: Volume II</h2>
                  <p className="mt-1 text-[9px] text-muted">Fantasy · 14,200 words</p>
                </div>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-[10px] text-muted">
                Batch: 5 Chapters · Batch #4 of 6
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-xs font-semibold">Submission Chapters</h2>
              <div className="mt-4 space-y-2">
                {chapters.map(([title, status], index) => (
                  <button
                    key={title}
                    onClick={() => setActiveChapter(index)}
                    className={`w-full rounded-xl p-3 text-left ${activeChapter === index ? 'bg-brand/10 text-brand' : 'hover:bg-elevated'}`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} />
                      <span className="truncate text-[10px]">{title}</span>
                      <Badge
                        tone={status === '1 Flag' ? 'orange' : 'neutral'}
                        className="ml-auto px-2 py-0.5 text-[8px]"
                      >
                        {status}
                      </Badge>
                    </div>
                    {activeChapter === index && (
                      <p className="mt-1 pl-5 text-[8px] text-muted">Active in Reviewer Canvas</p>
                    )}
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h2 className="text-xs font-semibold">Submission Specs</h2>
              <div className="mt-3 space-y-2 text-[9px] text-muted">
                <p>Target Audience: Young Adult (14+)</p>
                <p>Cover Ratio: 1600 × 2400</p>
                <p>Copyright Match: 100%</p>
                <p>Monetization: Coin lock (Ch. 15+)</p>
              </div>
            </Card>
          </aside>
          <article className="min-w-0 rounded-3xl border border-line bg-reader p-5 sm:p-8">
            <p className="text-[9px] uppercase tracking-[.15em] text-muted">
              The Silent Forest · Volume II
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Chapter 16: Heart of the Ironwood
            </h1>
            <p className="mt-2 text-[10px] text-muted">
              Word Count: 2,150 words · Reading Time: ~9 min · Font: Poppins 17px/31px
            </p>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
              <strong className="flex items-center gap-2 text-xs">
                <FileText size={14} className="text-brand" />
                Author Submission Note (Elena Vance):
              </strong>
              <p className="mt-2 text-[10px] leading-5 text-muted">
                Volume II continues the lore from Vol I. Ch. 16 contains mythological combat
                adhering to standard PG-13 rules.
              </p>
            </div>
            <div className="mt-7 space-y-6">
              {prose.map((paragraph, index) =>
                index === 5 ? (
                  <FlaggedText
                    key={paragraph}
                    reviewed={reviewed}
                    onReview={() => setReviewed(true)}
                  >
                    {paragraph}
                  </FlaggedText>
                ) : (
                  <p key={paragraph} className="text-sm leading-8 sm:text-base sm:leading-9">
                    {paragraph}
                  </p>
                ),
              )}
            </div>
            <div className="mt-8 flex flex-col justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-[10px] text-brand">
                <CheckCircle2 size={14} />
                End of Chapter 16 Verification Mark · 2,150 words rendered
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" className="min-h-8 px-3 py-1 text-[10px]">
                  <ChevronLeft size={12} />
                  Previous
                </Button>
                <Button variant="secondary" className="min-h-8 px-3 py-1 text-[10px]">
                  Next
                  <ChevronRight size={12} />
                </Button>
              </div>
            </div>
          </article>
          <aside className="space-y-4 xl:sticky xl:top-24">
            <Card>
              <div className="flex justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Sparkles size={16} className="text-purple" />
                  AI Telemetry &amp; Signals
                </h2>
                <Badge tone="purple">Engine v4.2</Badge>
              </div>
              <p className="mt-2 text-[9px] text-muted">
                Signals are supporting telemetry only, not automated verdicts.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Signal label="Content Safety Score" value="98.2%" note="Clean Narrative" />
                <Signal
                  label="Violence/Gore Index"
                  value="14%"
                  note="PG-13 Safe Zone"
                  tone="orange"
                />
                <Signal label="Plagiarism Index" value="1.2%" note="100% Original Prose" />
                <Signal
                  label="Pacing Alignment"
                  value="94%"
                  note="Serialized Fantasy Arc"
                  tone="purple"
                />
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <h2 className="font-semibold">Editorial Policy Checklist</h2>
                <Badge tone="green">{checks.filter(Boolean).length} of 5</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {policyChecks.map((label, index) => (
                  <button
                    key={label}
                    onClick={() =>
                      setChecks(current =>
                        current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
                      )
                    }
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${checks[index] ? 'bg-brand text-white' : 'bg-rose/20 text-rose'}`}
                    >
                      {checks[index] ? <Check size={12} /> : <span>!</span>}
                    </span>
                    <span className="text-[10px] leading-4">{label}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Moderator Notes &amp; Justification</h2>
              <textarea
                value={notes}
                maxLength={500}
                onChange={event => setNotes(event.target.value)}
                className="mt-3 min-h-28 w-full rounded-2xl border border-line bg-elevated p-3 text-xs leading-5 outline-none"
              />
              <p className="mt-2 text-right text-[9px] text-muted">
                {notes.length} / 500 characters
              </p>
            </Card>
            <Card>
              <p className="text-[9px] uppercase tracking-[.15em] text-muted">Final Disposition</p>
              {completed && (
                <Badge tone="green" className="mt-3 w-full justify-center">
                  Decision recorded: {completed}
                </Badge>
              )}
              <Button onClick={() => setDecision('Approve & Publish')} className="mt-3 w-full">
                <CheckCircle2 size={15} />
                Approve &amp; Publish
              </Button>
              <Button
                onClick={() => setDecision('Request Author Changes')}
                variant="secondary"
                className="mt-2 w-full text-orange"
              >
                Request Author Changes
              </Button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setDecision('Escalate to Legal')}
                  variant="secondary"
                  className="px-2 text-[10px]"
                >
                  <Scale size={13} />
                  Escalate
                </Button>
                <Button
                  onClick={() => setDecision('Reject Submission')}
                  variant="secondary"
                  className="px-2 text-[10px] text-rose"
                >
                  <Gavel size={13} />
                  Reject
                </Button>
              </div>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(decision)}
          title="Record Moderator Decision"
          onClose={() => setDecision(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <ShieldAlert className="shrink-0 text-orange" />
            <div>
              <strong className="text-sm">{decision}</strong>
              <p className="mt-1 text-xs leading-5 text-muted">
                This mock action will append the decision to the local audit stream only.
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Decision justification..."
            defaultValue={notes}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setCompleted(decision)
                setDecision(null)
              }}
            >
              Confirm Decision
            </Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}

function FlaggedText({ children, reviewed, onReview }) {
  return (
    <div className="rounded-2xl border border-orange bg-orange/10 p-5">
      <div className="flex flex-wrap items-center gap-2 text-[9px] text-orange">
        <AlertTriangle size={13} />
        Trigger Tag Check: Mythological battle &amp; physical injury
        <Badge tone="orange">Matches PG-13 criteria</Badge>
      </div>
      <p className="mt-4 text-sm leading-8 sm:text-base sm:leading-9">{children}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-orange/30 pt-3 text-[9px] text-muted">
        <span>Reviewer Telemetry: 14% kinetic impact intensity · Defensive encounter</span>
        <button onClick={onReview} className="font-semibold text-brand">
          {reviewed ? 'Reviewed ✓' : 'Mark as Reviewed'}
        </button>
      </div>
    </div>
  )
}
function Signal({ label, value, note, tone = 'green' }) {
  return (
    <div className="rounded-xl bg-elevated p-3">
      <span className="text-[9px] text-muted">{label}</span>
      <strong
        className={`mt-2 block text-lg ${tone === 'orange' ? 'text-orange' : tone === 'purple' ? 'text-purple' : 'text-brand'}`}
      >
        {value}
      </strong>
      <span className="text-[8px] text-muted">{note}</span>
    </div>
  )
}
