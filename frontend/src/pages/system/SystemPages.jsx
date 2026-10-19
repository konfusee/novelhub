import { ArrowLeft, FileSearch, Home, ShieldX } from '../../components/icons';
import { useLocation, useNavigate } from 'react-router';
import { Button, ButtonLink, Card } from '../../components/ui';
import { PublicHeader } from '../../components/public/PublicHeader';

function StatePage({ code, icon: Icon, title, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  // A directly opened URL has no in-app history entry to return to.
  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1));
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-xl flex-1 place-items-center px-4 pb-20 pt-8 sm:px-6">
        <Card bezel className="w-full" innerClassName="px-6 py-10 text-center sm:px-12 sm:py-14">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
            <Icon size={28} />
          </span>
          <p className="mt-6 text-[3.5rem] font-bold leading-none tracking-[-0.04em] text-brand-strong tabular-nums sm:text-[4.5rem]">
            {code}
          </p>
          <h1 className="mt-4 text-h2 sm:text-h1">{title}</h1>
          <p className="mx-auto mt-3 max-w-[42ch] text-base leading-7 text-muted">{children}</p>
          <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <Button variant="secondary" onClick={goBack}>
              <ArrowLeft size={16} />
              Quay lại
            </Button>
            <ButtonLink to="/">
              <Home size={16} />
              Trang chủ
            </ButtonLink>
          </div>
        </Card>
      </main>
    </div>
  );
}

export const ForbiddenPage = () => {
  const location = useLocation();
  const from = location.state?.from;
  return (
    <StatePage code="403" icon={ShieldX} title="Khu vực này bị giới hạn">
      Tài khoản của bạn không thể mở{' '}
      {from ? (
        <code className="rounded-full bg-elevated px-2 py-0.5 text-sm text-ink">{from}</code>
      ) : (
        'trang này'
      )}
      . Hãy chuyển sang tài khoản có quyền phù hợp.
    </StatePage>
  );
};

export const NotFoundPage = () => (
  <StatePage code="404" icon={FileSearch} title="Không tìm thấy chương này">
    Liên kết có thể đã cũ hoặc trang đã được chuyển. Hãy về trang chủ và tiếp tục khám phá NovelHub.
  </StatePage>
);
