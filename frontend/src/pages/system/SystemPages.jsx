import { ArrowLeft, Home, ShieldX } from '../../components/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/ui'
import { PublicHeader } from '../../components/public/PublicHeader'
function StatePage({ code, title, text }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-5">
        <Card className="w-full text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand/10 text-brand">
            <ShieldX size={30} />
          </span>
          <p className="mt-5 text-sm font-semibold text-brand">{code}</p>
          <h1 className="mt-2 text-3xl font-bold">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{text}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} />
              Quay lại
            </Button>
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
              to="/"
            >
              <Home size={16} />
              Trang chủ
            </Link>
          </div>
        </Card>
      </main>
    </div>
  )
}
export const ForbiddenPage = () => {
  const location = useLocation()
  return (
    <StatePage
      code="403"
      title="Khu vực này bị giới hạn"
      text={`Tài khoản của bạn không thể mở ${location.state?.from || 'trang này'}. Hãy chuyển sang tài khoản có quyền phù hợp.`}
    />
  )
}
export const NotFoundPage = () => (
  <StatePage
    code="404"
    title="Không tìm thấy chương này"
    text="Liên kết có thể đã cũ hoặc trang đã được chuyển. Hãy về trang chủ và tiếp tục khám phá NovelHub."
  />
)
