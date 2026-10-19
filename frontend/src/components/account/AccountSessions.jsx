import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { Laptop, LogOut, Smartphone } from '../icons';
import { Button, Card, Modal, SkeletonText } from '../ui';

export function AccountSessions() {
  const { t } = useLocale();
  const [refresh, setRefresh] = useState(0);
  const [feed, setFeed] = useState({ status: 'loading', items: [] });
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/auth/sessions', { signal: controller.signal })
      .then(({ items }) => {
        if (!controller.signal.aborted) setFeed({ status: 'ready', items });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted)
          setFeed({ status: 'error', items: [] });
      });
    return () => controller.abort();
  }, [refresh]);
  const others = feed.items.filter((session) => !session.current);
  const reload = () => {
    setFeed({ status: 'loading', items: [] });
    setRefresh((value) => value + 1);
  };
  const revoke = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { revokedCount } = await apiRequest('/auth/sessions/revoke-others', {
        method: 'POST',
        body: {},
      });
      setConfirm(false);
      setNotice(t('account.sessionsRevoked', { count: revokedCount }));
      reload();
    } catch {
      setError(t('account.revokeFailed'));
    } finally {
      setSaving(false);
    }
  };
  const title = (session) =>
    [session.client?.os, session.client?.browser].filter(Boolean).join(' · ') ||
    t('account.unknownDevice');
  const lastSeen = (value) =>
    new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(value),
    );
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-h3">
          <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
            <Laptop size={18} />
          </span>
          {t('account.sessions')}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          disabled={saving || feed.status === 'loading'}
          onClick={reload}
        >
          {t('account.refreshSessions')}
        </Button>
      </div>
      {feed.status === 'loading' ? (
        <div role="status" className="mt-4">
          <span className="sr-only">{t('account.sessionsLoading')}</span>
          <SkeletonText lines={3} />
        </div>
      ) : feed.status === 'error' ? (
        <div className="mt-4">
          <p role="alert" className="text-sm text-rose-strong">
            {t('account.sessionsLoadFailed')}
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={reload}>
            {t('account.retrySessions')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-hairline">
            {feed.items.map((session) => {
              const Icon =
                session.client?.deviceType === 'mobile' || session.client?.deviceType === 'tablet'
                  ? Smartphone
                  : Laptop;
              return (
                <li key={session.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-elevated text-brand-strong">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block break-words text-sm">{title(session)}</strong>
                    <p className="mt-0.5 text-sm text-muted">
                      {session.current
                        ? t('account.currentSession')
                        : t('account.sessionLastSeen', { time: lastSeen(session.lastSeenAt) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {others.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              className="mt-4"
              onClick={() => {
                setConfirm(true);
                setError('');
              }}
            >
              <LogOut size={15} />
              {t('account.signOutOthers')}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-muted">{t('account.noOtherSessions')}</p>
          )}
          <p className="mt-3 text-caption text-muted">{t('account.deviceHint')}</p>
        </>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-brand-strong">
          {notice}
        </p>
      )}
      <Modal
        open={confirm}
        title={t('account.signOutOthers')}
        onClose={() => {
          if (!saving) setConfirm(false);
        }}
      >
        <p className="text-sm text-muted">{t('account.revokeConfirm')}</p>
        <ul className="mt-3 list-inside list-disc text-sm">
          {others.map((session) => (
            <li key={session.id}>{title(session)}</li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={saving} onClick={() => setConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" disabled={saving} aria-busy={saving} onClick={revoke}>
            {t(saving ? 'account.revoking' : 'account.confirmRevoke')}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
