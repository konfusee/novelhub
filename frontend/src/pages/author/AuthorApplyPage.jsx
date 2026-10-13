import { useState } from 'react';
import { ArrowRight, Check, Feather, ShieldCheck } from '../../components/icons';
import { AuthShowcase } from '../../components/auth/AuthShowcase';
import { PublicHeader } from '../../components/public/PublicHeader';
import { Button, ButtonLink, Card, ProgressBar } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMockData } from '../../context/MockDataContext';

const labels = [
  'Tôi đồng ý với Hướng dẫn dành cho tác giả.',
  'Tôi đồng ý với Quy định xuất bản của NovelHub.',
  'Tôi xác nhận mình sở hữu hoặc có quyền xuất bản nội dung.',
  'Tôi chấp nhận thỏa thuận chia sẻ doanh thu hiện tại.',
];

export function AuthorApplyPage() {
  const [checks, setChecks] = useState(() => labels.map(() => false));
  const { applyForAuthor, currentUser } = useAuth();
  const [submission, setSubmission] = useState({ status: 'idle', message: '' });
  const { data } = useMockData();
  const agreement = data.agreements['user-author'] || { authorShare: 80, platformShare: 20 };
  const confirmed = checks.filter(Boolean).length;
  const ready = confirmed === labels.length;
  const alreadyAuthor = currentUser?.roles?.includes('author');

  const finish = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setSubmission({ status: 'submitting', message: '' });
    try {
      await applyForAuthor();
      setSubmission({
        status: 'submitted',
        message: 'Đơn đăng ký đã được gửi. Quyền Tác giả chỉ được kích hoạt sau khi Admin phê duyệt.',
      });
    } catch (error) {
      setSubmission({ status: 'error', message: error.message });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <PublicHeader />
      {/*
        Same 12-column split as /login: lg 6/6 so the 2×2 agreement grid keeps readable cells,
        xl+ visual 7 / form 5. At lg+ the grid fills the viewport below the 76px header island.
      */}
      <main className="w-full flex-1 px-3 pb-8 pt-3 sm:px-4 md:px-6 lg:px-10 lg:pb-3">
        <div className="mx-auto grid max-w-[1360px] grid-cols-12 gap-4 md:gap-6 lg:h-[calc(100dvh-6.25rem)] lg:min-h-[34rem] xl:gap-8">
          <Card
            bezel
            aria-labelledby="author-apply-title"
            className="col-span-12 min-w-0 lg:col-span-6 lg:min-h-0 xl:col-span-5"
            innerClassName="flex flex-col p-5 sm:p-7 lg:overflow-y-auto lg:px-8 lg:py-4"
          >
            <div className="mx-auto my-auto w-full max-w-[30rem]">
              <header className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand lg:[@media(max-height:820px)]:hidden shadow-[0_10px_24px_-14px_var(--primary)]">
                  <Feather size={22} />
                </span>
                <div className="min-w-0">
                  <h1 id="author-apply-title" className="text-h2">
                    Trở thành tác giả NovelHub
                  </h1>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Tài khoản{' '}
                    <span className="font-semibold text-ink [overflow-wrap:anywhere]">
                      {currentUser?.email}
                    </span>{' '}
                    hiện tại vẫn giữ mọi tính năng Độc giả và được bổ sung công cụ xuất bản.
                  </p>
                </div>
              </header>

              {alreadyAuthor ? (
                <div className="mt-6 rounded-3xl border border-hairline bg-brand-soft p-6 text-center sm:p-8">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface text-brand-strong shadow-whisper">
                    <ShieldCheck size={22} />
                  </span>
                  <h2 className="mt-4 text-h3">Quyền Tác giả đã được kích hoạt</h2>
                  <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-6 text-ink/70">
                    Bạn có thể quản lý truyện, chương và bản nháp trong Studio tác giả.
                  </p>
                  <ButtonLink to="/author" trailingIcon={ArrowRight} className="mt-6">
                    Mở Studio tác giả
                  </ButtonLink>
                </div>
              ) : (
                <form
                  onSubmit={finish}
                  className="mt-5 border-t border-hairline pt-5 lg:[@media(max-height:820px)]:mt-4 lg:[@media(max-height:820px)]:pt-4"
                >
                  <h2 className="text-h3">Thỏa thuận tác giả</h2>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Truyện phải được gửi cho Kiểm duyệt viên xét duyệt trước khi xuất bản. Việc phê
                    duyệt không bao giờ diễn ra tự động.
                  </p>

                  <div className="mt-4 rounded-3xl border border-hairline bg-elevated px-4 py-3 lg:[@media(max-height:820px)]:mt-3 lg:[@media(max-height:820px)]:py-2">
                    <div className="flex items-baseline justify-between gap-4 text-xs font-medium text-ink/70">
                      <span>
                        Tác giả nhận{' '}
                        <strong className="ml-1 text-2xl font-bold tracking-[-0.03em] text-brand-strong tabular-nums">
                          {agreement.authorShare}%
                        </strong>
                      </span>
                      <span>
                        NovelHub nhận{' '}
                        <strong className="ml-1 text-2xl font-bold tracking-[-0.03em] text-ink tabular-nums">
                          {agreement.platformShare}%
                        </strong>
                      </span>
                    </div>
                    <ProgressBar
                      value={agreement.authorShare}
                      size="md"
                      className="mt-2.5"
                      label={`Tác giả nhận ${agreement.authorShare}%, NovelHub nhận ${agreement.platformShare}%`}
                    />
                  </div>

                  <fieldset className="mt-4 lg:[@media(max-height:820px)]:mt-3">
                    <legend className="flex w-full items-center justify-between gap-3 text-sm font-semibold">
                      Xác nhận điều khoản
                      <span
                        className="text-xs font-medium text-muted tabular-nums"
                        aria-live="polite"
                      >
                        {confirmed}/{labels.length} đã xác nhận
                      </span>
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {labels.map((label, index) => (
                        <label
                          key={label}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-sm leading-5 lg:[@media(max-height:820px)]:py-2 transition-[background-color,border-color] duration-200 ${
                            checks[index]
                              ? 'border-brand/50 bg-brand-soft'
                              : 'border-line bg-surface hover:border-brand/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                            checked={checks[index]}
                            onChange={(event) =>
                              setChecks((values) =>
                                values.map((value, i) =>
                                  i === index ? event.target.checked : value,
                                ),
                              )
                            }
                          />
                          <span className="min-w-0 flex-1">{label}</span>
                          {checks[index] && (
                            <Check
                              size={15}
                              aria-hidden="true"
                              className="mt-0.5 shrink-0 text-brand-strong"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!ready || submission.status === 'submitting' || submission.status === 'submitted'}
                    trailingIcon={ArrowRight}
                    className="mt-4 w-full lg:[@media(max-height:820px)]:mt-3"
                  >
                    {submission.status === 'submitting'
                      ? 'Đang gửi đơn...'
                      : submission.status === 'submitted'
                        ? 'Đã gửi đơn đăng ký'
                        : 'Gửi đơn đăng ký Tác giả'}
                  </Button>
                  <p className="mt-2 min-h-4 text-center text-xs leading-4 text-muted">
                    {submission.message ||
                      (ready
                        ? 'Đã sẵn sàng gửi đơn để Admin xét duyệt.'
                        : `Xác nhận đủ ${labels.length} mục để gửi đơn.`)}
                  </p>
                </form>
              )}
            </div>
          </Card>

          <AuthShowcase
            variant="author"
            authorShare={agreement.authorShare}
            authorName={currentUser?.name}
            className="col-span-12 lg:order-first lg:col-span-6 xl:col-span-7"
          />
        </div>
      </main>
    </div>
  );
}
