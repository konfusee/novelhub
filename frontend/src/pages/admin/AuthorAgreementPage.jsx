import { useId, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, FileText, RotateCcw, Save } from '../../components/icons';
import { AdminLayout } from '../../layouts';
import { adminUsers } from '../../data/mock/admin';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  Skeleton,
} from '../../components/ui';
import { useMockData, useMockResource } from '../../context/MockDataContext';

const DEFAULT_SHARE = 80;

export function AuthorAgreementPage() {
  const { userId } = useParams();
  const { data, saveAgreement } = useMockData();
  const fieldId = useId();
  const author =
    adminUsers.find((user) => user.id === userId) ??
    adminUsers.find((user) => user.role === 'Author');
  const agreement = useMockResource(`user:${userId}`, data.agreements['user-author'], {
    isEmpty: (value) => !value,
  });
  const current = agreement.status === 'ready' ? agreement.data : null;
  const savedShare = current?.authorShare ?? DEFAULT_SHARE;
  /* Unsaved edit on top of the loaded agreement; null = showing the saved value. */
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState('');
  const share = draft ?? String(savedShare);
  const value = Number(share);
  const valid = share.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 100;
  const platform = valid ? 100 - value : null;
  const dirty = share.trim() !== String(savedShare);
  const save = () => {
    if (!valid) return;
    saveAgreement('user-author', value);
    setDraft(null);
    setMessage('Đã lưu thỏa thuận vào kho dữ liệu mẫu. Khu vực tác giả hiện dùng tỷ lệ này.');
  };
  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <ButtonLink to="/admin/users" variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft size={16} />
          Người dùng và tài khoản
        </ButtonLink>
        <p className="mt-4 text-caption text-ink/70">Tài chính / Cài đặt thỏa thuận</p>
        <h1 className="mt-1 text-h2 sm:text-h1">{author.name} · Thỏa thuận doanh thu</h1>
        {agreement.status === 'loading' ? (
          <p
            aria-hidden="true"
            className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1"
          >
            <Skeleton className="h-6 w-28" />
            <span className="flex h-5 w-full items-center sm:w-96">
              <Skeleton className="h-3 w-full" />
            </span>
          </p>
        ) : (
          <p className="nh-fade-enter mt-2 flex flex-wrap items-center gap-2 text-caption text-ink/70">
            <Badge tone={current?.status === 'active' ? 'green' : 'neutral'}>
              {current?.status === 'active' ? 'Đang hiệu lực' : 'Chưa kích hoạt'}
            </Badge>
            <span>
              {author.handle} · #{author.id}
              {current?.effectiveFrom &&
                ` · Hiệu lực từ ${current.effectiveFrom} · Cập nhật bởi ${current.updatedBy}`}
            </span>
          </p>
        )}

        {agreement.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được thỏa thuận doanh thu"
              description="Dịch vụ tài chính chưa phản hồi. Tỷ lệ hiện hành vẫn được giữ nguyên."
              action={
                <Button variant="secondary" size="sm" onClick={agreement.retry}>
                  <RotateCcw size={15} />
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : agreement.status === 'empty' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={FileText}
              title="Chưa có thỏa thuận doanh thu"
              description={`${author.name} chưa có tỷ lệ chia doanh thu. Tạo thỏa thuận với tỷ lệ mặc định ${DEFAULT_SHARE}% cho tác giả, sau đó điều chỉnh nếu cần.`}
              action={
                <Button size="sm" onClick={() => saveAgreement('user-author', DEFAULT_SHARE)}>
                  <Save size={15} />
                  Tạo thỏa thuận mặc định
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="mt-6" aria-busy={agreement.status === 'loading'}>
            <h2 className="text-h3">Tỷ lệ chia doanh thu</h2>
            <p className="mt-1 text-caption text-muted">
              Nhập phần trăm dành cho tác giả. Phần còn lại thuộc về NovelHub.
            </p>
            {agreement.status === 'loading' ? (
              <AgreementFormSkeleton />
            ) : (
              <div className="nh-fade-enter">
                <div className="nh-grid-12 mt-5 grid gap-5 nh-sm-cols-2">
                  <div>
                    <label htmlFor={`${fieldId}-author`} className="text-sm font-semibold">
                      Tỷ lệ của tác giả (%)
                    </label>
                    <Input
                      id={`${fieldId}-author`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      step="1"
                      value={share}
                      aria-invalid={!valid}
                      aria-describedby={`${fieldId}-hint`}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        setMessage('');
                      }}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${fieldId}-platform`} className="text-sm font-semibold">
                      Tỷ lệ của NovelHub (%)
                    </label>
                    <output
                      id={`${fieldId}-platform`}
                      htmlFor={`${fieldId}-author`}
                      className="mt-2 flex min-h-11 items-center rounded-full border border-hairline bg-elevated px-4 text-sm text-ink/80"
                    >
                      {platform ?? '—'}
                    </output>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-caption text-ink/70">
                    <span>Tác giả {valid ? value : '—'}%</span>
                    <span>NovelHub {platform ?? '—'}%</span>
                  </div>
                  <ProgressBar
                    value={valid ? value : 0}
                    size="lg"
                    label="Tỷ lệ doanh thu của tác giả"
                    className="mt-2"
                  />
                </div>
                <p
                  id={`${fieldId}-hint`}
                  className={`mt-4 text-caption ${valid ? 'text-ink/70' : 'font-semibold text-rose-strong'}`}
                >
                  {valid
                    ? 'Tổng: 100% · cả hai giá trị phải nằm trong khoảng 0 đến 100.'
                    : 'Tỷ lệ của tác giả phải là số nguyên trong khoảng 0 đến 100.'}
                </p>
                {message && (
                  <p
                    role="status"
                    className="mt-4 rounded-2xl bg-brand/10 p-3 text-sm text-brand-strong"
                  >
                    {message}
                  </p>
                )}
                {dirty && (
                  <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-hairline pt-5">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setDraft(null);
                        setMessage('');
                      }}
                    >
                      <RotateCcw size={16} />
                      Hoàn tác
                    </Button>
                    <Button disabled={!valid} onClick={save}>
                      <Save size={16} />
                      Lưu thỏa thuận
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

/* Field geometry of the agreement form: two labelled 44px fields, split bar, hint line. */
function AgreementFormSkeleton() {
  return (
    <div>
      <span className="sr-only">Đang tải thỏa thuận doanh thu…</span>
      <div className="nh-grid-12 mt-5 grid gap-5 nh-sm-cols-2">
        {['w-36', 'w-40'].map((width) => (
          <div key={width}>
            <span className="flex h-[1.625rem] items-center">
              <Skeleton className={`h-3.5 ${width}`} />
            </span>
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex h-5 items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="mt-2 h-3 w-full" />
      </div>
      <span className="mt-4 flex h-5 items-center">
        <Skeleton className="h-3 w-80 max-w-full" />
      </span>
    </div>
  );
}
