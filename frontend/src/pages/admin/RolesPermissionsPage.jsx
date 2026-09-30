import { useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Download,
  KeyRound,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Tabs } from '../../components/ui'

const roles = [
  {
    name: 'Reader',
    users: '141,562',
    icon: BookOpen,
    description:
      'Standard public account. Read chapters, purchase coins, leave comments, and follow creators.',
    tags: ['Default Role', 'Unrestricted Signup'],
  },
  {
    name: 'Author',
    users: '1,240',
    icon: UserRound,
    description:
      'Creator account with Author Studio, Chapter Editor, PDF import, royalty wallet, and AI Co-Pilot.',
    tags: ['Verified Identity', 'Monetization Enabled'],
  },
  {
    name: 'Moderator',
    users: '38',
    icon: ShieldCheck,
    description:
      'Trust & Safety console access, submission inspection, similarity analysis, and report resolution.',
    tags: ['Staff Only', 'NDA Signed'],
  },
  {
    name: 'Administrator',
    users: '10',
    icon: Shield,
    description:
      'Full platform governance, user management, service configuration, taxonomy control, and audit logs.',
    tags: ['Protected Role', 'Hardware 2FA'],
  },
]
const capabilities = [
  [
    'Content Publishing & Authoring',
    'story.create',
    'Create manuscripts and upload metadata',
    [0, 1, 1, 1],
  ],
  [
    'Content Publishing & Authoring',
    'chapter.edit',
    'Edit long-form text and autosave to cloud',
    [0, 1, 0, 1],
  ],
  [
    'Content Publishing & Authoring',
    'pdf.import',
    'OCR and auto-structure manuscript PDFs',
    [0, 1, 0, 1],
  ],
  [
    'Content Publishing & Authoring',
    'ai_copilot.access',
    'Invoke NovelCraft writing assistance',
    [0, 1, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'queue.review',
    'Claim submissions and execute approval decisions',
    [0, 0, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'plagiarism.inspect',
    'Inspect canonical similarity comparisons',
    [0, 0, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'report.resolve',
    'Triage community and content reports',
    [0, 0, 1, 1],
  ],
  ['Editorial & Moderation', 'user.strike', 'Issue warnings or shadowban accounts', [0, 0, 1, 1]],
  ['Monetization & Ledger', 'wallet.spend', 'Purchase coins and unlock chapters', [1, 1, 1, 1]],
  [
    'Monetization & Ledger',
    'royalty.withdraw',
    'Request payout for accrued royalties',
    [0, 1, 0, 1],
  ],
  [
    'Monetization & Ledger',
    'coin.override',
    'Manually credit or debit user balances',
    [0, 0, 0, 1],
  ],
  [
    'Platform Infrastructure',
    'system.configure',
    'Modify TTS endpoints, AI keys, and storage',
    [0, 0, 0, 1],
  ],
  [
    'Platform Infrastructure',
    'audit.view',
    'Inspect complete administrative event stream',
    [0, 0, 1, 1],
  ],
]
const modules = [
  'All Modules',
  'Content & Stories',
  'Reader & Social',
  'Moderation',
  'Billing & Coins',
  'Platform Config',
]

export function RolesPermissionsPage() {
  const [module, setModule] = useState('All Modules')
  const [query, setQuery] = useState('')
  const [matrix, setMatrix] = useState(() => capabilities.map(row => [...row[3]]))
  const [drafts, setDrafts] = useState(0)
  const [modal, setModal] = useState('')
  const visible = useMemo(
    () =>
      capabilities
        .map((row, index) => ({ ...row, index }))
        .filter(row => `${row[1]} ${row[2]}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  )
  const toggle = (row, col) => {
    setMatrix(value =>
      value.map((cells, index) =>
        index === row
          ? cells.map((enabled, cell) => (cell === col ? (enabled ? 0 : 1) : enabled))
          : cells,
      ),
    )
    setDrafts(value => value + 1)
  }
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">
              Admin Console / Access Management / Roles &amp; RBAC Matrix
            </p>
            <h1 className="mt-1 text-2xl font-bold">Roles &amp; Permissions Governance</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal('Permission policy JSON exported')}>
              <Download size={15} />
              Export Policy JSON
            </Button>
            <Button onClick={() => setModal('Create custom role')}>
              <Plus size={15} />
              Create Custom Role
            </Button>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-orange/30 bg-orange/10 p-4 text-sm">
          <Shield className="shrink-0 text-orange" />
          <p className="flex-1">
            <strong>Security Policy Notice:</strong> High-impact changes require 2FA
            re-authentication and are logged to immutable audit records.
          </p>
          <Badge tone="orange">POLICY_V4.2</Badge>
        </div>
        <section className="mt-7">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Core System Roles</h2>
            <Badge tone="green">4 Active Types</Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roles.map(role => (
              <RoleCard
                key={role.name}
                role={role}
                onAction={() => setModal(`${role.name} policy editor`)}
              />
            ))}
          </div>
        </section>
        <Card className="mt-7 overflow-hidden p-0">
          <div className="flex flex-col justify-between gap-4 border-b border-line p-5 xl:flex-row xl:items-center">
            <div className="overflow-x-auto">
              <Tabs
                value={module}
                onChange={setModule}
                items={modules.map(value => ({ value, label: value }))}
              />
            </div>
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search permission slug..."
              className="w-full xl:w-80"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-elevated text-[9px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-5 py-4">Permission capability / slug</th>
                  <th>Description</th>
                  {roles.map(role => (
                    <th key={role.name} className="text-center">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, position) => {
                  const group = row[0],
                    slug = row[1],
                    description = row[2],
                    previous = visible[position - 1]?.[0]
                  return (
                    <FragmentRow key={slug} showGroup={group !== previous} group={group}>
                      <td className="px-5 py-4 font-mono text-brand">{slug}</td>
                      <td className="max-w-xs pr-5 text-muted">{description}</td>
                      {matrix[row.index].map((enabled, col) => (
                        <td key={col} className="text-center">
                          <button
                            aria-label={`Toggle ${slug} for ${roles[col].name}`}
                            onClick={() => toggle(row.index, col)}
                            className={`mx-auto grid size-8 place-items-center rounded-full ${enabled ? 'bg-brand/15 text-brand' : 'bg-elevated text-muted'}`}
                          >
                            {enabled ? <Check size={16} /> : <X size={16} />}
                          </button>
                        </td>
                      ))}
                    </FragmentRow>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-line p-4 text-[10px] text-muted">
            <span>● Enabled scope &nbsp; ○ Explicitly denied</span>
            <span>Showing {visible.length} active capability scopes across 4 roles</span>
          </div>
        </Card>
        <Card className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange/15 text-orange">
            <KeyRound />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {drafts} Pending Policy Modifications in Draft
            </h3>
            <p className="text-xs text-muted">
              Changes apply across active sessions on save. Revocations invalidate bearer refresh
              tokens globally.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setMatrix(capabilities.map(row => [...row[3]]))
              setDrafts(0)
            }}
            disabled={!drafts}
          >
            Discard Draft
          </Button>
          <Button onClick={() => setModal('Apply permission matrix')} disabled={!drafts}>
            <ShieldCheck size={15} />
            Apply Matrix · 2FA
          </Button>
        </Card>
        <Modal open={Boolean(modal)} title={modal} onClose={() => setModal('')}>
          {modal === 'Create custom role' ? (
            <div className="space-y-3">
              <Input placeholder="Role name" />
              <Input placeholder="Role description" />
              <Button onClick={() => setModal('')} className="w-full">
                Create Mock Role
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                This protected action is simulated locally for the UI preview.
              </p>
              <Button
                onClick={() => {
                  if (modal.includes('Apply')) setDrafts(0)
                  setModal('')
                }}
                className="mt-5 w-full"
              >
                Confirm Mock Action
              </Button>
            </>
          )}
        </Modal>
      </main>
    </AdminLayout>
  )
}

function RoleCard({ role, onAction }) {
  const Icon = role.icon
  return (
    <Card className={role.name === 'Administrator' ? 'border-brand' : ''}>
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon size={20} />
        </span>
        <strong className="text-sm">
          {role.users}
          <small className="block font-normal text-muted">users assigned</small>
        </strong>
      </div>
      <h3 className="mt-5 text-xl font-semibold">{role.name}</h3>
      <p className="mt-3 min-h-24 text-sm leading-6 text-muted">{role.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {role.tags.map((tag, index) => (
          <Badge key={tag} tone={index ? 'blue' : role.name === 'Administrator' ? 'red' : 'green'}>
            {tag}
          </Badge>
        ))}
      </div>
      <Button
        variant={role.name === 'Administrator' ? 'primary' : 'secondary'}
        onClick={onAction}
        className="mt-5 w-full"
      >
        {role.name === 'Administrator'
          ? 'Manage Keys'
          : role.name === 'Reader'
            ? 'View Scope'
            : 'Edit Policy'}
      </Button>
    </Card>
  )
}
function FragmentRow({ showGroup, group, children }) {
  return (
    <>
      {showGroup && (
        <tr className="border-y border-line bg-brand/5">
          <td colSpan="6" className="px-5 py-3 font-semibold text-brand">
            {group}
          </td>
        </tr>
      )}
      <tr className="border-b border-line hover:bg-elevated/40">{children}</tr>
    </>
  )
}
