import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, Check, Clock3, FileCheck2, RefreshCw, Send } from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  ProgressBar,
  Select,
  Skeleton,
} from '../../components/ui';

const emptyFeed = { items: [], stories: [], page: 1, pageCount: 1, total: 0 };
const emptyWorkspace = { chapters: [] };
const emptyPackage = { checks: [], ready: false };

export function SubmissionReviewPage() {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const storyId = params.get('storyId') || '';
  const chapterId = params.get('chapterId') || '';
  const feed = useBackendDocument(`/author/submissions?page=${page}`, emptyFeed);
  const choose = (story, chapter = '') => {
    setParams(story ? { storyId: story, ...(chapter ? { chapterId: chapter } : {}) } : {});
  };
  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">{t('submissionData.studio')}</p>
            <h1 className="mt-2 text-h1">{t('submissionData.title')}</h1>
          </div>
          <Button variant="secondary" onClick={feed.retry}>
            <RefreshCw size={16} />
            {t('submissionData.refresh')}
          </Button>
        </header>
        <Card className="mt-5">
          <label className="text-sm font-semibold" htmlFor="submission-story">
            {t('submissionData.chooseStory')}
          </label>
          <Select
            id="submission-story"
            className="mt-3 w-full"
            value={storyId}
            onChange={(event) => choose(event.target.value)}
            disabled={feed.status !== 'ready'}
          >
            <option value="">{t('submissionData.chooseStory')}</option>
            {storyId && !feed.data.stories.some((story) => story.id === storyId) && (
              <option value={storyId}>{storyId}</option>
            )}
            {feed.data.stories.map((story) => (
              <option key={story.id} value={story.id}>
                {story.title}
              </option>
            ))}
          </Select>
          {feed.status === 'error' && (
            <p role="alert" className="mt-3 text-sm text-rose-strong">
              {t('submissionData.loadError')}
            </p>
          )}
          {feed.status === 'ready' && !feed.data.stories.length && (
            <p className="mt-3 text-sm text-muted">{t('submissionData.noStories')}</p>
          )}
        </Card>
        {storyId ? (
          <StoryPackage
            key={storyId}
            storyId={storyId}
            chapterId={chapterId}
            choose={choose}
            onSubmitted={feed.retry}
          />
        ) : (
          <Card className="mt-5">
            <EmptyState
              icon={FileCheck2}
              title={t('submissionData.chooseStory')}
              description={t('submissionData.chooseHint')}
            />
          </Card>
        )}
        <Card className="mt-5">
          <h2 className="text-h3">{t('submissionData.history')}</h2>
          {feed.status === 'loading' ? (
            <StatusSkeleton />
          ) : feed.status === 'error' ? (
            <EmptyState
              tone="rose"
              title={t('submissionData.loadError')}
              action={<Button onClick={feed.retry}>{t('submissionData.retry')}</Button>}
            />
          ) : !feed.data.items.length ? (
            <EmptyState
              title={t('submissionData.noHistory')}
              description={t('submissionData.noHistoryHint')}
            />
          ) : (
            <div className="mt-4 space-y-3">
              {feed.data.items.map((item) => (
                <SubmissionEntry key={item.id} item={item} choose={choose} />
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {t('submissionData.previous')}
                </Button>
                <span className="text-sm tabular-nums">
                  {page} / {feed.data.pageCount}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= feed.data.pageCount}
                  onClick={() => setPage(page + 1)}
                >
                  {t('submissionData.next')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AuthorLayout>
  );
}

function StoryPackage({ storyId, chapterId, choose, onSubmitted }) {
  const { t } = useLocale();
  const workspace = useBackendDocument(`/author/stories/${storyId}/workspace`, emptyWorkspace);
  return (
    <>
      <Card className="mt-5">
        <label htmlFor="submission-chapter" className="text-sm font-semibold">
          {t('submissionData.chooseTarget')}
        </label>
        <Select
          id="submission-chapter"
          className="mt-3 w-full"
          value={chapterId}
          disabled={workspace.status !== 'ready'}
          onChange={(event) => choose(storyId, event.target.value)}
        >
          <option value="">{t('submissionData.storyTarget')}</option>
          {chapterId && !workspace.data.chapters.some((chapter) => chapter.id === chapterId) && (
            <option value={chapterId}>{chapterId}</option>
          )}
          {workspace.data.chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.title}
            </option>
          ))}
        </Select>
        {workspace.status === 'error' && (
          <Button className="mt-3" variant="secondary" onClick={workspace.retry}>
            {t('submissionData.retry')}
          </Button>
        )}
      </Card>
      <SubmissionPackage
        key={`${storyId}:${chapterId}`}
        storyId={storyId}
        chapterId={chapterId}
        onSubmitted={onSubmitted}
      />
    </>
  );
}

function SubmissionPackage({ storyId, chapterId, onSubmitted }) {
  const { t, formatNumber } = useLocale();
  const query = new URLSearchParams({ storyId, ...(chapterId ? { chapterId } : {}) });
  const resource = useBackendDocument(`/author/submissions/prepare?${query}`, emptyPackage);
  const [basis, setBasis] = useState('original');
  const [asserted, setAsserted] = useState(false);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const data = resource.data;
  const passed = data.checks.filter((check) => check.ok).length;
  const percent = data.checks.length ? Math.round((passed / data.checks.length) * 100) : 0;
  const ready =
    resource.status === 'ready' && data.ready && (!data.requiresRights || asserted) && !sent;
  const back = chapterId
    ? `/author/stories/${storyId}/chapters/${chapterId}/edit`
    : `/author/stories/${storyId}`;
  const fixes = {
    editable: { to: `/author/stories/${storyId}?tab=reviews`, label: 'status' },
    content: { to: chapterId ? back : `/author/stories/${storyId}?tab=details`, label: 'content' },
    categories: { to: `/author/stories/${storyId}?tab=details`, label: 'categories' },
    media: { to: `/author/stories/${storyId}?tab=media`, label: 'media' },
    parent: { to: `/author/submissions?storyId=${encodeURIComponent(storyId)}`, label: 'parent' },
  };
  const send = async () => {
    if (!ready || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/author/submissions', {
        method: 'POST',
        body: {
          storyId,
          ...(chapterId ? { chapterId } : {}),
          revisionId: data.target.revisionId,
          expectedVersion: data.target.version,
          ...(data.requiresRights ? { rights: { basis, asserted, sourceLicenceNote: note } } : {}),
        },
      });
      if (!result?.submission?.id) throw new Error(t('submissionData.sendError'));
      setSent(result.submission);
      setConfirm(false);
      onSubmitted();
      resource.retry();
    } catch (failure) {
      setError(failure.message || t('submissionData.sendError'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {resource.status === 'ready' && (
        <Card bezel className="mt-5" innerClassName="p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
              <StoryCover
                story={data.story}
                className="aspect-[2/3] w-20 shrink-0 rounded-xl shadow-soft sm:w-24"
              />
              <div className="min-w-0 self-center">
                <Badge>
                  {t(chapterId ? 'submissionData.chapterTarget' : 'submissionData.storyTarget')}
                </Badge>
                <h2 className="mt-3 text-h2">{data.target.title}</h2>
                <p className="mt-2 text-sm text-muted">{data.story.title}</p>
                <p className="mt-2 break-all text-xs text-muted">{data.target.revisionId}</p>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-2 divide-x divide-hairline rounded-2xl bg-elevated py-3 text-center">
              <div className="px-5">
                <dt className="text-xs text-muted">{t('submissionData.revision')}</dt>
                <dd className="mt-1 font-semibold">{data.target.revisionNumber}</dd>
              </div>
              <div className="px-5">
                <dt className="text-xs text-muted">{t('submissionData.words')}</dt>
                <dd className="mt-1 font-semibold text-brand-strong">{formatNumber(data.words)}</dd>
              </div>
            </dl>
          </div>
        </Card>
      )}
      {sent && (
        <Card className="mt-5" role="status">
          <strong>{t('submissionData.sent')}</strong>
          <p className="mt-2 text-sm text-muted">{t('submissionData.pendingHint')}</p>
          <p className="mt-2 break-all text-xs">{sent.id}</p>
        </Card>
      )}
      <div className="nh-grid-12 mt-5 grid items-start gap-5 nh-layout-xl-8-4">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h3">{t('submissionData.checklist')}</h2>
              <Badge>
                {passed} / {data.checks.length}
              </Badge>
              <Button size="sm" variant="secondary" disabled={busy} onClick={resource.retry}>
                {t('submissionData.checkAgain')}
              </Button>
            </div>
            {resource.status === 'loading' ? (
              <>
                <StatusSkeleton />
                <ol className="mt-5 space-y-3">
                  {checklistSkeletons.map((lines, index) => (
                    <ChecklistSkeleton key={index} {...lines} />
                  ))}
                </ol>
              </>
            ) : resource.status !== 'ready' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title={t('submissionData.loadError')}
                description={t('submissionData.notFound')}
                action={<Button onClick={resource.retry}>{t('submissionData.retry')}</Button>}
              />
            ) : (
              <>
                <ProgressBar value={percent} className="mt-5" />
                <ol className="mt-5 space-y-3">
                  {data.checks.map((check) => (
                    <li
                      key={check.code}
                      className={`flex gap-3 rounded-2xl border p-4 ${check.ok ? 'border-hairline' : 'border-rose/40 bg-rose/5'}`}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-full ${check.ok ? 'bg-brand/12 text-brand-strong' : 'bg-rose/14 text-rose-strong'}`}
                        aria-label={t(check.ok ? 'submissionData.pass' : 'submissionData.fail')}
                      >
                        {check.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">
                          {t(`submissionData.checks.${check.code}.title`)}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {t(`submissionData.checks.${check.code}.hint`)}
                        </p>
                        <p className="mt-2 text-xs font-semibold">
                          {t(check.ok ? 'submissionData.pass' : 'submissionData.fail')}
                        </p>
                        {!check.ok && fixes[check.code] && (
                          <div className="mt-3">
                            <ButtonLink variant="secondary" size="sm" to={fixes[check.code].to}>
                              {t(`submissionFixes.${fixes[check.code].label}`)}
                            </ButtonLink>
                            {['parent', 'media', 'editable'].includes(check.code) && (
                              <p className="mt-2 text-xs leading-5 text-muted">
                                {t(`submissionFixes.${check.code}Hint`)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Card>
          <Card>
            <h2 className="text-h3">{t('submissionData.rights')}</h2>
            {resource.status === 'ready' && data.requiresRights ? (
              <fieldset
                disabled={
                  busy ||
                  Boolean(sent) ||
                  !data.checks.find((check) => check.code === 'editable')?.ok
                }
                className="mt-4 space-y-4"
              >
                <label className="block text-sm font-semibold" htmlFor="rights-basis">
                  {t('submissionData.basis')}
                </label>
                <Select
                  id="rights-basis"
                  value={basis}
                  onChange={(event) => setBasis(event.target.value)}
                >
                  <option value="original">{t('submissionData.original')}</option>
                  <option value="licensed">{t('submissionData.licensed')}</option>
                </Select>
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input
                    type="checkbox"
                    checked={asserted}
                    onChange={(event) => setAsserted(event.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-brand"
                  />
                  {t('submissionData.assertion')}
                </label>
                <label htmlFor="rights-note" className="block text-sm font-semibold">
                  {t('submissionData.licenceNote')}
                </label>
                <textarea
                  id="rights-note"
                  value={note}
                  maxLength={2000}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-28 w-full resize-y rounded-2xl border border-line bg-elevated p-4 text-sm"
                />
                <p className="text-xs text-muted">{t('submissionData.rightsHint')}</p>
              </fieldset>
            ) : (
              <p className="mt-3 text-sm text-muted">{t('submissionData.parentRights')}</p>
            )}
          </Card>
          <Card>
            <h2 className="text-h3">{t('submissionData.notes')}</h2>
            <textarea
              disabled
              value=""
              readOnly
              aria-label={t('submissionData.notes')}
              className="mt-4 min-h-28 w-full rounded-2xl border border-line bg-elevated p-4 opacity-60"
            />
            <p className="mt-2 text-xs text-muted">{t('submissionData.notesUnavailable')}</p>
          </Card>
          <Card>
            {error && (
              <p role="alert" className="mb-4 text-sm text-rose-strong">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Clock3 className="shrink-0 text-orange-strong" size={22} />
                <p className="text-sm text-muted">{t('submissionData.freezeHint')}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <ButtonLink to={back} variant="secondary">
                  {t('submissionData.back')}
                </ButtonLink>
                <Button disabled={!ready || busy} onClick={() => setConfirm(true)}>
                  <Send size={16} />
                  {t(sent ? 'submissionData.sent' : 'submissionData.send')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
          <Card>
            <h2 className="text-h3">{t('submissionData.pipeline')}</h2>
            <ol className="mt-5 space-y-5">
              {['freeze', 'evidence', 'review', 'release'].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-brand text-xs text-brand-strong">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">
                      {t(`submissionData.pipelineSteps.${step}.title`)}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {t(`submissionData.pipelineSteps.${step}.hint`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="bg-brand-soft">
            <p className="text-sm leading-6">{t('submissionData.pendingHint')}</p>
          </Card>
        </aside>
      </div>
      <Modal
        open={confirm}
        title={t('submissionData.confirm')}
        onClose={() => !busy && setConfirm(false)}
      >
        <p className="text-sm leading-6 text-muted">{t('submissionData.freezeHint')}</p>
        <p className="mt-3 font-semibold">{data.target?.title}</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
            {t('submissionData.cancel')}
          </Button>
          <Button disabled={!ready || busy} onClick={send}>
            {t(busy ? 'submissionData.sending' : 'submissionData.send')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function SubmissionEntry({ item, choose }) {
  const { t, formatDate } = useLocale();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const revise = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const { revision } = await apiRequest(`/author/submissions/${item.id}/revise`, {
        method: 'POST',
        body: { expectedVersion: item.version },
      });
      if (!revision?.id || !revision.storyId) throw new Error(t('submissionData.reviseError'));
      navigate(
        revision.chapterId
          ? `/author/stories/${revision.storyId}/chapters/${revision.chapterId}/edit`
          : `/author/stories/${revision.storyId}`,
      );
    } catch (failure) {
      setError(failure.message || t('submissionData.reviseError'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const statusKey = `submissionData.status.${item.status}`;
  const known = [
    'validated',
    'pending-review',
    'decision-pending',
    'approved',
    'rejected',
    'revision-requested',
    'cancelled',
  ];
  const evidenceStatuses = [
    'pending',
    'embedding-complete',
    'discovery-complete',
    'llm-complete',
    'available-for-human-review',
    'failed',
  ];
  return (
    <article className="rounded-2xl border border-hairline p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{item.title || item.id}</h3>
        <Badge>{known.includes(item.status) ? t(statusKey) : item.status}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted">
        {item.submittedAt ? formatDate(item.submittedAt) : '—'} · {t('submissionData.revision')}{' '}
        {item.revisionNumber ?? '—'}
      </p>
      {item.processing && (
        <p className="mt-2 text-sm text-muted">
          {t('submissionData.processing')}:{' '}
          {evidenceStatuses.includes(item.processing.status)
            ? t(`submissionData.evidenceStatus.${item.processing.status}`)
            : item.processing.status}
          {item.processing.failedStage ? ` · ${item.processing.failedStage}` : ''}
        </p>
      )}
      {item.decisionSummary && (
        <p className="mt-3 whitespace-pre-wrap text-sm">{item.decisionSummary}</p>
      )}
      <ul className="mt-3 space-y-2">
        {item.history.map((row) => (
          <li key={row.id} className="rounded-xl bg-elevated p-3 text-xs">
            <p>
              {row.action} · {row.outcome} · {row.occurredAt ? formatDate(row.occurredAt) : '—'}
            </p>
            {row.feedback && <p className="mt-2 whitespace-pre-wrap text-sm">{row.feedback}</p>}
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="secondary"
        className="mt-3"
        onClick={() => choose(item.storyId, item.chapterId || '')}
      >
        {t('submissionData.open')}
      </Button>
      {['rejected', 'revision-requested'].includes(item.status) && (
        <Button size="sm" className="mt-3 sm:ml-2" onClick={() => setConfirm(true)}>
          {t('submissionData.revise')}
        </Button>
      )}
      <Modal
        open={confirm}
        title={t('submissionData.revise')}
        onClose={() => !busy && setConfirm(false)}
      >
        <p className="text-sm leading-6 text-muted">{t('submissionData.reviseHint')}</p>
        <p className="mt-3 font-semibold">{item.title}</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
            {t('submissionData.cancel')}
          </Button>
          <Button disabled={busy} onClick={revise}>
            {t(busy ? 'submissionData.sending' : 'submissionData.createRevision')}
          </Button>
        </div>
      </Modal>
    </article>
  );
}

function StatusSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải trạng thái kiểm tra"
      className="mt-5 flex flex-col gap-4 rounded-3xl border border-hairline bg-elevated p-5 sm:flex-row sm:items-center"
    >
      <Skeleton className="size-11 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <Skeleton className="my-[4.8px] h-4 w-48" />
        <span className="mt-0.5 flex flex-col">
          <Skeleton className="my-[3px] h-3.5 w-72 max-w-full" />
          <Skeleton className="my-[3px] h-3.5 w-24 lg:hidden" />
        </span>
      </div>
      <div className="flex flex-col sm:ml-auto sm:w-56">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="mb-0.5 ml-auto mt-2 h-3 w-8" />
      </div>
    </div>
  );
}

/* Wrapped line boxes of the five checklist rows below sm (one line each from sm up). */
const checklistSkeletons = [
  { wideTitle: false, badge: 'h-10' },
  { wideTitle: true, badge: 'h-10' },
  { wideTitle: true, badge: 'h-14' },
  { wideTitle: true, badge: 'h-10' },
  { wideTitle: true, badge: 'h-10' },
];

function ChecklistSkeleton({ wideTitle, badge }) {
  return (
    <li aria-hidden="true" className="flex gap-3 rounded-2xl border border-hairline p-4 sm:gap-4">
      <Skeleton className="size-8 shrink-0" />
      <div className="grid min-w-0 flex-1 items-start gap-x-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <span className="flex flex-col">
          <Skeleton className="my-1 h-4 w-3/5" />
          {wideTitle && <Skeleton className="my-1 h-4 w-2/5 sm:hidden" />}
        </span>
        <span className="order-last mt-2 flex h-6 items-center justify-self-start sm:order-none sm:mt-0">
          <Skeleton className="h-3 w-20" />
        </span>
        <span className="mt-1 flex flex-col sm:col-start-1">
          <Skeleton className="my-[3px] h-3.5 w-full sm:w-4/5" />
          <Skeleton className="my-[3px] h-3.5 w-3/5 sm:hidden" />
        </span>
        <div className="sm:col-start-1">
          <Skeleton className={`mt-2 w-64 max-w-full sm:h-6 ${badge}`} />
        </div>
      </div>
    </li>
  );
}
