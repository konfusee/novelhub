import { useState } from 'react'
import { CheckCircle2, Feather } from '../../components/icons'
import { useNavigate } from 'react-router-dom'
import { PublicHeader } from '../../components/public/PublicHeader'
import { Button, Card } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useMockData } from '../../context/MockDataContext'
export function AuthorApplyPage() {
  const [checks, setChecks] = useState([false, false, false, false])
  const { becomeAuthor, currentUser } = useAuth()
  const { data } = useMockData()
  const navigate = useNavigate()
  const agreement = data.agreements['user-author'] || { authorShare: 80, platformShare: 20 }
  const labels = [
    'Tôi đồng ý với Hướng dẫn dành cho tác giả.',
    'Tôi đồng ý với Quy định xuất bản của NovelHub.',
    'Tôi xác nhận mình sở hữu hoặc có quyền xuất bản nội dung.',
    'Tôi chấp nhận thỏa thuận chia sẻ doanh thu hiện tại.',
  ]
  const ready = checks.every(Boolean)
  const finish = () => {
    becomeAuthor()
    navigate('/author', { replace: true })
  }
  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand text-white">
            <Feather />
          </span>
          <h1 className="mt-5 text-3xl font-bold">Trở thành tác giả NovelHub</h1>
          <p className="mt-2 text-sm text-muted">
            Tài khoản {currentUser?.email} hiện tại vẫn giữ mọi tính năng Độc giả và được bổ sung
            công cụ xuất bản.
          </p>
        </div>
        <Card className="mt-8">
          <h2 className="text-xl font-semibold">Thỏa thuận tác giả</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Truyện phải được gửi cho Kiểm duyệt viên xét duyệt trước khi xuất bản. Việc phê duyệt
            không bao giờ diễn ra tự động.
          </p>
          <div className="nh-grid-12 mt-5 grid gap-3 nh-sm-cols-2">
            <div className="rounded-2xl bg-brand/10 p-4">
              <span className="text-xs text-muted">Tác giả nhận</span>
              <strong className="block text-3xl text-brand">{agreement.authorShare}%</strong>
            </div>
            <div className="rounded-2xl bg-elevated p-4">
              <span className="text-xs text-muted">NovelHub nhận</span>
              <strong className="block text-3xl">{agreement.platformShare}%</strong>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {labels.map((label, index) => (
              <label
                key={label}
                className="flex items-start gap-3 rounded-2xl border border-line p-4 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                  checked={checks[index]}
                  onChange={e =>
                    setChecks(values =>
                      values.map((value, i) => (i === index ? e.target.checked : value)),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <Button disabled={!ready} onClick={finish} className="mt-6 w-full">
            <CheckCircle2 size={17} />
            Kích hoạt quyền Tác giả
          </Button>
        </Card>
      </main>
    </div>
  )
}
