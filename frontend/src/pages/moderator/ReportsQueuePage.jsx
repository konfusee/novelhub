import { useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  Gavel,
  MessageSquareWarning,
  Scale,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ModeratorLayout } from '../../layouts'
import { communityReports } from '../../data/mock/moderation'
import { Badge, Button, Card, Input, Modal, Select } from '../../components/ui'

const statusTabs = ['Open', 'In Review', 'Resolved', 'Escalated']

export function ReportsQueuePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Open')
  const [severity, setSeverity] = useState('All')
  const [reason, setReason] = useState('All Infraction Types')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(communityReports[0])
  const [resolution, setResolution] = useState(null)
  const [resolved, setResolved] = useState([])
  const rows = useMemo(
    () =>
      communityReports.filter(
        report =>
          !resolved.includes(report.id) &&
          (status === 'Open'
            ? ['Open', 'In Review'].includes(report.status)
            : report.status === status) &&
          (severity === 'All' || report.severity === severity) &&
          (reason === 'All Infraction Types' || report.title.includes(reason.split(' / ')[0])) &&
          `${report.id} ${report.title} ${report.target} ${report.lead}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [status, severity, reason, query, resolved],
  )
  const confirm = () => {
    if (resolution === 'Dismiss Unfounded') setResolved(current => [...current, selected.id])
    setResolution(null)
  }
  return (
    <ModeratorLayout>
      <main className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs text-muted">
              Moderator Console / <strong>Community Reports &amp; Safety Desk</strong>
            </p>
            <h1 className="mt-2 text-2xl font-bold">Reports Queue</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>15 Open Reports</Badge>
            <Badge tone="red">4 High Severity</Badge>
            <Badge tone="orange">8 In Review</Badge>
            <Badge tone="purple">3 Escalated</Badge>
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search report ID, user, excerpt..."
              className="w-full sm:w-72"
            />
          </div>
        </div>
        <Card className="mt-5 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex gap-2 overflow-x-auto">
              {statusTabs.map(item => (
                <button
                  key={item}
                  onClick={() => setStatus(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs ${status === item ? 'bg-surface font-semibold text-brand shadow-sm' : 'text-muted'}`}
                >
                  {item}{' '}
                  {item === 'Open'
                    ? '15'
                    : item === 'In Review'
                      ? '8'
                      : item === 'Resolved'
                        ? '142'
                        : '3'}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:ml-auto">
              <Select value={severity} onChange={event => setSeverity(event.target.value)}>
                <option>All</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </Select>
              <Select value={reason} onChange={event => setReason(event.target.value)}>
                <option>All Infraction Types</option>
                <option>Copyright / Plagiarism</option>
                <option>Harassment / Toxicity</option>
                <option>Unrated Mature Content</option>
              </Select>
            </div>
          </div>
        </Card>
        <div className="mt-5 grid min-h-[760px] gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
          <section>
            <div className="mb-3 flex justify-between text-xs text-muted">
              <span>Showing 1–{rows.length} of 15 pending incident reports</span>
              <span>
                Sorted by: <strong className="text-ink">Urgency &amp; Recency</strong>
              </span>
            </div>
            <div className="space-y-4">
              {rows.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  active={selected?.id === report.id}
                  onSelect={() => setSelected(report)}
                />
              ))}
            </div>
            {!rows.length && (
              <Card className="py-14 text-center">
                <CheckCircle2 className="mx-auto text-brand" />
                <p className="mt-3 text-sm">No reports in this queue.</p>
              </Card>
            )}
          </section>
          <IncidentInspector
            report={selected}
            onResolution={setResolution}
            onSimilarity={() => navigate('/moderator/similarity-review/demo')}
          />
        </div>
        <Modal
          open={Boolean(resolution)}
          title="Confirm Moderation Action"
          onClose={() => setResolution(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <Gavel className="shrink-0 text-orange" />
            <div>
              <strong>{resolution}</strong>
              <p className="mt-1 text-xs text-muted">
                Case #{selected?.id} · This action only updates the local UI preview.
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Resolution rationale..."
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResolution(null)}>
              Cancel
            </Button>
            <Button onClick={confirm}>Record Action</Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}

function ReportCard({ report, active, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-3xl border bg-surface p-5 text-left ${active ? 'border-brand ring-2 ring-brand/20' : report.tone === 'red' ? 'border-rose/30' : 'border-line'}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${report.tone === 'red' ? 'bg-rose/15 text-rose' : 'bg-orange/15 text-orange'}`}
        >
          {report.title.includes('Harassment') ? <MessageSquareWarning /> : <FileWarning />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-brand">#{report.id}</strong>
            <Badge tone={report.tone}>{report.severity} Severity</Badge>
            <Badge tone="orange">{report.status}</Badge>
            <span className="text-xs text-muted">· {report.age}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold">{report.title}</h2>
          <p className="mt-2 text-sm">
            <BookOpen size={14} className="mr-2 inline" />
            Target: <strong>{report.target}</strong>
          </p>
          <div className="mt-4 rounded-2xl bg-elevated p-3 text-sm italic text-muted">
            “{report.excerpt}”
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs text-muted">
            <span>{report.score}</span>
            <span>{report.reporters}</span>
            <span>
              Lead: <strong className="text-brand">{report.lead}</strong>
            </span>
            <Badge className="ml-auto">Assigned: {report.assigned}</Badge>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </button>
  )
}
function IncidentInspector({ report, onResolution, onSimilarity }) {
  if (!report)
    return (
      <Card className="hidden xl:block">
        <p className="text-muted">Select a report to inspect.</p>
      </Card>
    )
  return (
    <aside className="rounded-3xl border border-line bg-surface p-5 xl:sticky xl:top-24">
      <div className="flex justify-between border-b border-line pb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="text-brand" />
          Incident Inspector
        </h2>
        <span className="text-xs text-muted">P30 Verification Desk</span>
      </div>
      <div className="mt-5 flex justify-between">
        <strong className="text-brand">Case #{report.id}</strong>
        <Badge tone={report.tone}>{report.severity} Severity</Badge>
      </div>
      <h2 className="mt-4 text-2xl font-bold">
        {report.title === 'Copyright & Plagiarism Claim'
          ? 'Plagiarism Claim: Verified Passage Match'
          : report.title}
      </h2>
      <p className="mt-2 text-sm text-muted">
        Opened {report.age} · Assigned to <strong className="text-ink">{report.assigned}</strong>
      </p>
      <div className="mt-5 rounded-3xl bg-elevated p-5">
        <strong className="flex items-center gap-2">
          <UserRoundCheck size={16} className="text-brand" />
          Reporter Statement
        </strong>
        <p className="mt-3 text-sm leading-6">
          “The reported content appears to violate NovelHub safety and publishing guidelines. Please
          verify the cited excerpt and surrounding context.”
        </p>
      </div>
      <div className="mt-5 rounded-3xl border border-rose/50 bg-rose/5 p-5">
        <div className="flex justify-between text-xs">
          <strong>Flagged Excerpt in “{report.target}”</strong>
          <span className="text-rose">Exact Match (94%)</span>
        </div>
        <blockquote className="mt-4 border-l-2 border-rose pl-4 text-sm italic leading-7">
          “{report.excerpt} They harvest each vow broken upon the shore, waiting for salt to bleach
          the memory of kings.”
        </blockquote>
        <p className="mt-3 text-xs text-muted">Location: Paragraphs 24–26</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted">Reported Author</p>
          <strong className="mt-3 block">@erik_pen</strong>
          <p className="mt-2 text-xs text-muted">
            2 published works
            <br />0 prior copyright strikes
            <br />
            <span className="text-brand">Clean standing</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted">Reporter Trust</p>
          <strong className="mt-3 block text-2xl text-brand">94%</strong>
          <p className="mt-2 text-xs text-muted">
            Trusted Contributor
            <br />
            18 confirmed flags
          </p>
        </Card>
      </div>
      <Button onClick={onSimilarity} className="mt-5 w-full">
        <ShieldCheck size={15} />
        Open Similarity Comparison (P31)
      </Button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => onResolution('Dismiss Unfounded')} variant="secondary">
          <X size={14} />
          Dismiss
        </Button>
        <Button
          onClick={() => onResolution('Request Edit')}
          variant="secondary"
          className="text-orange"
        >
          Request Edit
        </Button>
      </div>
      <Button
        onClick={() => onResolution('Escalate to Legal IP Team')}
        className="mt-2 w-full border-rose bg-rose"
      >
        <Scale size={15} />
        Escalate to Legal IP Team
      </Button>
    </aside>
  )
}
