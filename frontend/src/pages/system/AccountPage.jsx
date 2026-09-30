import { useState } from 'react'
import { Laptop, LockKeyhole, Mail, Save, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts'
import { Avatar, Button, Card, Input } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
}

export function AccountPage({ workspace = 'reader' }) {
  const Layout = layouts[workspace] || ReaderLayout
  const { currentUser } = useAuth()
  const { t } = useLocale()
  const [email, setEmail] = useState(currentUser?.email || '')
  const [saved, setSaved] = useState(true)

  return (
    <Layout>
      <main className={`page-${workspace} py-7`}>
        <header className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{t('account.sharedAccount')}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{t('account.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{t('account.description')}</p>
        </header>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <SectionTitle icon={UserRound} title={t('account.credentials')} />
              <div className="mt-5 flex items-center gap-4">
                <Avatar name={currentUser?.name || 'NovelHub user'} className="size-16 text-lg" />
                <div>
                  <strong>{currentUser?.name}</strong>
                  <p className="mt-1 text-xs text-muted">{t('account.userId', { id: currentUser?.id || '—' })}</p>
                </div>
              </div>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-semibold">{t('auth.email')}</span>
                <Input icon={Mail} type="email" value={email} onChange={event => { setEmail(event.target.value); setSaved(false) }} />
              </label>
            </Card>

            <Card>
              <SectionTitle icon={LockKeyhole} title={t('account.security')} />
              <AccountRow title={t('account.password')} description={t('account.passwordDescription')}>
                <Button variant="secondary">{t('account.changePassword')}</Button>
              </AccountRow>
              <AccountRow title={t('account.twoFactor')} description={t('account.twoFactorDescription')}>
                <Button variant="secondary">{t('account.configure')}</Button>
              </AccountRow>
            </Card>

            <Card>
              <SectionTitle icon={Laptop} title={t('account.sessions')} />
              <Session icon={Laptop} title="Windows · Chrome" detail={t('account.currentSession')} />
              <Session icon={Smartphone} title="iPhone · Safari" detail={t('account.lastActive')} />
              <Button variant="secondary" className="mt-4">{t('account.signOutOthers')}</Button>
            </Card>
          </div>

          <Card className="xl:sticky xl:top-24">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-4 font-semibold">{t('account.oneAccount')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{t('account.oneAccountDescription')}</p>
            <div className="mt-5 rounded-2xl bg-elevated p-4 text-xs text-muted">
              {t('account.currentWorkspace', { workspace: t(`navigation.${workspace === 'author' ? 'authorStudio' : workspace}`) })}
            </div>
          </Card>
        </div>

        <section className="mt-7 flex flex-col items-stretch justify-between gap-3 rounded-3xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
          <p className="text-xs text-muted">{saved ? t('account.saved') : t('account.unsaved')}</p>
          <Button onClick={() => setSaved(true)} disabled={saved}>
            <Save size={15} /> {t('common.save')}
          </Button>
        </section>
      </main>
    </Layout>
  )
}

function SectionTitle({ icon: Icon, title }) {
  return <div className="flex items-center gap-2 border-b border-line pb-3"><Icon size={17} className="text-brand" /><h2 className="font-semibold">{title}</h2></div>
}

function AccountRow({ title, description, children }) {
  return <div className="flex flex-col justify-between gap-3 border-b border-line py-4 last:border-0 last:pb-0 sm:flex-row sm:items-center"><div><strong className="text-sm">{title}</strong><p className="mt-1 text-xs text-muted">{description}</p></div>{children}</div>
}

function Session({ icon: Icon, title, detail }) {
  return <div className="flex items-center gap-3 border-b border-line py-4 last:border-0"><span className="grid size-10 place-items-center rounded-xl bg-elevated text-brand"><Icon size={17} /></span><div><strong className="text-sm">{title}</strong><p className="mt-1 text-xs text-muted">{detail}</p></div></div>
}
