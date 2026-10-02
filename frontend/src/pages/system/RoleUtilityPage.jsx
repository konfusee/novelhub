import { Activity, CheckCircle2, Clock3, Search } from '../../components/icons'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts'
import { Badge, Card, Input } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
}

export function RoleUtilityPage({ role, eyebrow, title, description }) {
  const Layout = layouts[role]
  const { t } = useLocale()
  const rows = [
    ['NH-1042', 'The Silent Forest', 'Cập nhật 12 phút trước', 'Active'],
    ['NH-1038', 'Whispers of You', 'Cập nhật 46 phút trước', 'Review'],
    ['NH-1027', 'Neon Hearts', 'Cập nhật hôm qua', 'Resolved'],
  ]
  return (
    <Layout>
      <div className="page-shell space-y-6 py-7">
        <header className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
        </header>
        <section className="nh-grid-12 grid gap-4 nh-sm-cols-3">
          {[
            [t('workspace.openItems'), '24', Activity],
            [t('workspace.dueToday'), '8', Clock3],
            [t('workspace.completed'), '96%', CheckCircle2],
          ].map(([label, value, Icon]) => (
            <Card key={label} className="flex items-center gap-4 p-5">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon size={20} /></span>
              <div><strong className="block text-2xl">{value}</strong><span className="text-xs text-muted">{label}</span></div>
            </Card>
          ))}
        </section>
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center">
            <div><h2 className="font-semibold">{t('workspace.recentActivity')}</h2><p className="text-xs text-muted">{t('workspace.latestChanges')}</p></div>
            <Input icon={Search} placeholder={t('workspace.searchRecords')} className="sm:ml-auto sm:max-w-xs" />
          </div>
          <div className="divide-y divide-line">
            {rows.map(([id, name, time, status]) => (
              <div key={id} className="grid gap-2 p-5 text-sm sm:grid-cols-[100px_1fr_180px_90px] sm:items-center">
                <span className="font-mono text-xs text-muted">{id}</span><strong>{name}</strong><span className="text-xs text-muted">{time}</span><Badge tone={status === 'Active' ? 'green' : status === 'Review' ? 'orange' : 'purple'}>{t(`workspace.status.${status.toLowerCase()}`)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  )
}
