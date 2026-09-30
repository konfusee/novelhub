import { Activity, CheckCircle2, Clock3, Search } from 'lucide-react'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts'
import { Badge, Card, Input } from '../../components/ui'

const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
}

export function RoleUtilityPage({ role, eyebrow, title, description }) {
  const Layout = layouts[role]
  const rows = [
    ['NH-1042', 'The Silent Forest', 'Updated 12 minutes ago', 'Active'],
    ['NH-1038', 'Whispers of You', 'Updated 46 minutes ago', 'Review'],
    ['NH-1027', 'Neon Hearts', 'Updated yesterday', 'Resolved'],
  ]
  return (
    <Layout>
      <div className="page-shell space-y-6 py-7">
        <header className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
        </header>
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ['Open items', '24', Activity],
            ['Due today', '8', Clock3],
            ['Completed', '96%', CheckCircle2],
          ].map(([label, value, Icon]) => (
            <Card key={label} className="flex items-center gap-4 p-5">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon size={20} /></span>
              <div><strong className="block text-2xl">{value}</strong><span className="text-xs text-muted">{label}</span></div>
            </Card>
          ))}
        </section>
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center">
            <div><h2 className="font-semibold">Recent activity</h2><p className="text-xs text-muted">Workspace records and latest changes</p></div>
            <Input icon={Search} placeholder="Search records..." className="sm:ml-auto sm:max-w-xs" />
          </div>
          <div className="divide-y divide-line">
            {rows.map(([id, name, time, status]) => (
              <div key={id} className="grid gap-2 p-5 text-sm sm:grid-cols-[100px_1fr_180px_90px] sm:items-center">
                <span className="font-mono text-xs text-muted">{id}</span><strong>{name}</strong><span className="text-xs text-muted">{time}</span><Badge tone={status === 'Active' ? 'green' : status === 'Review' ? 'orange' : 'purple'}>{status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  )
}
