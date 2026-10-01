import { useState } from 'react'
import { Save } from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { Button, Card } from '../../components/ui'
import { useMockData } from '../../context/MockDataContext'
export function AuthorAgreementPage() {
  const { data, saveAgreement } = useMockData()
  const current = data.agreements['user-author']
  const [share, setShare] = useState(current?.authorShare ?? 80)
  const [message, setMessage] = useState('')
  const platform = 100 - Number(share)
  const valid = Number(share) >= 0 && Number(share) <= 100 && platform >= 0 && platform <= 100
  const save = () => {
    if (!valid) return
    saveAgreement('user-author', share)
    setMessage('Đã lưu thỏa thuận vào kho dữ liệu mẫu. Khu vực tác giả hiện dùng tỷ lệ này.')
  }
  return (
    <AdminLayout>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-bold">Mira Lane · Thỏa thuận doanh thu</h1>
        <p className="mt-2 text-sm text-muted">Tài chính / Cài đặt thỏa thuận</p>
        <Card className="mt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Tỷ lệ của tác giả
              <input
                type="number"
                min="0"
                max="100"
                value={share}
                onChange={e => setShare(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Tỷ lệ của NovelHub
              <input
                readOnly
                value={Number.isFinite(platform) ? platform : ''}
                className="mt-2 w-full rounded-2xl border border-line bg-elevated px-4 py-3"
              />
            </label>
          </div>
          <p className={`mt-4 text-sm ${valid ? 'text-brand' : 'text-rose'}`}>
            Tổng: {valid ? 100 : Number(share) + platform}% · cả hai giá trị phải nằm trong khoảng 0 đến 100.
          </p>
          {message && (
            <p role="status" className="mt-4 rounded-2xl bg-brand/10 p-3 text-sm text-brand">
              {message}
            </p>
          )}
          <Button disabled={!valid} onClick={save} className="mt-6">
            <Save size={16} />
            Lưu thỏa thuận
          </Button>
        </Card>
      </main>
    </AdminLayout>
  )
}
