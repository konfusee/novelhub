import { Fragment } from 'react';
import { SecurityPanel } from '../../components/account/SecurityPanel';
import { AccountSessions } from '../../components/account/AccountSessions';
import { Mail, ShieldCheck, UserRound } from '../../components/icons';
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts';
import { Avatar, Card, Input, SectionHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
};

export function AccountPage({ workspace = 'reader', embedded = false }) {
  const Layout = embedded ? Fragment : layouts[workspace] || ReaderLayout;
  const { currentUser } = useAuth();
  const { t } = useLocale();
  return (
    <Layout>
      <div className={embedded ? '' : `page-${workspace} pt-6 sm:pt-8`}>
        {!embedded && (
          <Card as="header" className="p-6 sm:p-8">
            <p className="nh-eyebrow">{t('account.sharedAccount')}</p>
            <h1 className="mt-3 text-h2 sm:text-h1">{t('account.title')}</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">
              {t('account.description')}
            </p>
          </Card>
        )}
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <Card>
              <SectionHeader
                title={
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                      <UserRound size={18} />
                    </span>
                    {t('account.credentials')}
                  </span>
                }
              />
              <div className="mt-6 flex items-center gap-4">
                <Avatar
                  name={currentUser?.name || 'Người dùng NovelHub'}
                  className="size-16 text-lg"
                />
                <div className="min-w-0">
                  <strong className="block truncate text-base">{currentUser?.name}</strong>
                  <p className="mt-1 text-sm text-muted">
                    {t('account.userId', { id: currentUser?.id || '—' })}
                  </p>
                </div>
              </div>
              <div className="mt-6 border-t border-hairline pt-5">
                <label htmlFor="account-email" className="mb-2 block text-sm font-semibold">
                  {t('auth.email')}
                </label>
                <Input
                  id="account-email"
                  icon={Mail}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={currentUser?.email || ''}
                  readOnly
                />
              </div>
            </Card>
            <SecurityPanel />
            <AccountSessions />
          </div>
          <Card className="xl:sticky xl:top-24">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
              <ShieldCheck size={20} />
            </span>
            <h2 className="mt-4 text-h3">{t('account.oneAccount')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t('account.oneAccountDescription')}
            </p>
            <p className="mt-5 rounded-2xl border border-hairline bg-elevated px-4 py-3 text-sm text-ink/80">
              {t('account.currentWorkspace', {
                workspace: t(`navigation.${workspace === 'author' ? 'authorStudio' : workspace}`),
              })}
            </p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
