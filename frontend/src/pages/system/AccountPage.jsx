import { SecurityPanel } from '../../components/account/SecurityPanel';
import { Fragment, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Laptop,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from '../../components/icons';
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  SectionHeader,
  Skeleton,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useMockResource } from '../../context/MockDataContext';

const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
};

const activeSessions = [
  { id: 'current', icon: Laptop, title: 'Windows · Chrome', current: true },
  { id: 'iphone', icon: Smartphone, title: 'iPhone · Safari', current: false },
];

export function AccountPage({ workspace = 'reader', embedded = false }) {
  const Layout = embedded ? Fragment : layouts[workspace] || ReaderLayout;
  const { currentUser } = useAuth();
  const { t } = useLocale();
  const sessionFeed = useMockResource('account:sessions', activeSessions);
  const [signedOutOthers, setSignedOutOthers] = useState(false);
  const sessions = signedOutOthers
    ? sessionFeed.data.filter((session) => session.current)
    : sessionFeed.data;
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signedOutCount, setSignedOutCount] = useState(0);
  const otherSessions = sessions.filter((session) => !session.current);

  const signOutOthers = () => {
    setSignedOutCount(otherSessions.length);
    setSignedOutOthers(true);
    setConfirmSignOut(false);
  };

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
                title={<IconTitle icon={UserRound}>{t('account.credentials')}</IconTitle>}
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

            <Card>
              <SectionHeader title={<IconTitle icon={Laptop}>{t('account.sessions')}</IconTitle>} />
              {sessionFeed.status === 'loading' ? (
                <div aria-busy="true" aria-label="Đang tải phiên đăng nhập">
                  <ul aria-hidden="true" className="mt-4 divide-y divide-hairline">
                    {activeSessions.map((session) => (
                      <li
                        key={session.id}
                        aria-hidden="true"
                        className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
                      >
                        <Skeleton className="size-10 shrink-0 rounded-2xl" />
                        <span className="min-w-0 flex-1">
                          <span className="flex h-5 items-center">
                            <Skeleton className="h-3.5 w-36" />
                          </span>
                          <span className="mt-0.5 flex h-5 items-center">
                            <Skeleton className="h-3 w-24" />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Skeleton className="mt-4 h-9 w-52" />
                </div>
              ) : sessionFeed.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  headingAs="h3"
                  icon={AlertTriangle}
                  title="Không tải được phiên đăng nhập"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                  action={
                    <Button variant="secondary" size="sm" onClick={sessionFeed.retry}>
                      <RefreshCw size={14} aria-hidden="true" />
                      Thử lại
                    </Button>
                  }
                  className="pb-2"
                />
              ) : sessionFeed.status === 'empty' ? (
                <EmptyState
                  headingAs="h3"
                  icon={Laptop}
                  title="Không có thiết bị nào khác đang đăng nhập"
                  description="Chỉ phiên hiện tại của bạn đang hoạt động."
                  className="pb-2"
                />
              ) : (
                <>
                  <ul className="nh-fade-enter mt-4 divide-y divide-hairline">
                    {sessions.map((session) => (
                      <Session
                        key={session.id}
                        icon={session.icon}
                        title={session.title}
                        detail={t(
                          session.current ? 'account.currentSession' : 'account.lastActive',
                        )}
                      />
                    ))}
                  </ul>
                  {otherSessions.length > 0 ? (
                    <Button
                      variant="danger"
                      size="sm"
                      className="mt-4"
                      onClick={() => setConfirmSignOut(true)}
                    >
                      <LogOut size={15} />
                      {t('account.signOutOthers')}
                    </Button>
                  ) : (
                    signedOutCount > 0 && (
                      <p
                        role="status"
                        className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-strong"
                      >
                        <CheckCircle2 size={16} className="shrink-0" />
                        Đã đăng xuất {signedOutCount} thiết bị khác.
                      </p>
                    )
                  )}
                </>
              )}
            </Card>
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

      <Modal
        open={confirmSignOut}
        title={t('account.signOutOthers')}
        onClose={() => setConfirmSignOut(false)}
      >
        <p className="text-sm leading-6 text-muted">
          Các thiết bị sau sẽ cần đăng nhập lại:{' '}
          <strong className="text-ink">
            {otherSessions.map((session) => session.title).join(', ')}
          </strong>
          . Phiên hiện tại vẫn được giữ.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirmSignOut(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={signOutOthers}>
            <LogOut size={15} />
            {t('account.signOutOthers')}
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}

function IconTitle({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
        <Icon size={18} />
      </span>
      {children}
    </span>
  );
}

function Session({ icon: Icon, title, detail }) {
  return (
    <li className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-elevated text-brand-strong">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-sm">{title}</strong>
        <p className="mt-0.5 text-sm text-muted">{detail}</p>
      </div>
    </li>
  );
}
