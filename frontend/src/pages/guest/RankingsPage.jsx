import { useState } from 'react'
import { BookOpenCheck, Info, ShieldCheck, Star } from 'lucide-react'
import { PublicHeader } from '../../components/public/PublicHeader'
import { PodiumCard } from '../../components/public/PodiumCard'
import { RankingRow } from '../../components/public/RankingRow'
import { Badge, Button, Card } from '../../components/ui'
import { podium, rankingCategories, rankingPeriods, rankings } from '../../data/mock/rankings'

export function RankingsPage({ embedded = false }) {
  const [category, setCategory] = useState('Thịnh hành')
  const [period, setPeriod] = useState('Tuần này')
  const [following, setFollowing] = useState(false)
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <main className="page-public space-y-9 py-8">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
                Những câu chuyện độc giả yêu thích
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Bảng xếp hạng biên tập
              </h1>
              <p className="mt-2 text-sm text-muted">
                Tiểu thuyết mạng nguyên tác và truyện âm thanh nổi bật được cập nhật theo thời gian thực.
              </p>
            </div>
            <Badge tone="green">● Dữ liệu trực tiếp · Cập nhật 12 phút trước</Badge>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-b border-line pb-4 xl:flex-row xl:items-center xl:justify-between">
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {rankingCategories.map(item => (
                <button
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium ${category === item ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </nav>
            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
              {rankingPeriods.map(item => (
                <button
                  onClick={() => setPeriod(item)}
                  className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-[10px] ${period === item ? 'bg-orange text-white' : 'text-muted'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
        </header>
        <section>
          <p className="mb-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-muted">
            <Star size={13} className="fill-orange text-orange" />
            Dẫn đầu tuần này
          </p>
          <div className="grid gap-4 lg:grid-cols-3 lg:items-end">
            <div className="lg:order-1">
              <PodiumCard story={podium[1]} />
            </div>
            <div className="lg:order-2">
              <PodiumCard story={podium[0]} />
            </div>
            <div className="lg:order-3">
              <PodiumCard story={podium[2]} />
            </div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Hạng #04 — #15</h2>
              <span className="text-[10px] text-muted">Hiển thị 12 ứng viên</span>
            </div>
            <div className="overflow-hidden rounded-3xl border border-line bg-surface">
              {rankings.map(item => (
                <RankingRow item={item} key={item.rank} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>Hiển thị 15 / 250 mục xếp hạng</span>
              <Button onClick={() => window.alert('Đã tải 15 mục xếp hạng tiếp theo (mô phỏng).')} variant="secondary" className="min-h-9 py-2 text-xs">
                15 truyện tiếp theo →
              </Button>
            </div>
          </section>
          <aside className="space-y-5">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={19} className="text-brand" />
                Công thức xếp hạng công bằng
              </h3>
              <p className="mt-3 text-xs leading-5 text-muted">
                NovelHub kết hợp thời gian đọc, tỷ lệ hoàn thành chương và đánh giá độc giả đã xác minh.
              </p>
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[10px] text-muted">
                <li>• 45% thời gian đọc đã xác minh</li><li>• 30% tỷ lệ lưu trong thư viện</li><li>• 25% đánh giá cộng đồng thực</li>
              </ul>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-orange">
                  Tác giả nổi bật
                </p>
                <Badge>Tuần 38</Badge>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full border border-orange text-sm font-semibold text-brand">
                  ML
                </span>
                <div>
                  <h3 className="font-semibold">Mira Lane</h3>
                  <p className="text-[10px] text-muted">Kỳ ảo & giả tưởng suy đoán</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">
                Author of #1 hit The Silent Forest. Former mythologist exploring human resilience
                and untamed wilderness.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-line py-3 text-center text-xs">
                <span>
                  <strong className="block">48.2K</strong>
                  <small className="text-muted">Người theo dõi</small>
                </span>
                <span>
                  <strong className="block">6 tiểu thuyết ngắn</strong>
                  <small className="text-muted">Đã xuất bản</small>
                </span>
              </div>
              <Button onClick={() => setFollowing(!following)} className="mt-4 w-full">
                {following ? 'Đang theo dõi' : 'Theo dõi tác giả'}
              </Button>
            </Card>
            <Card className="bg-elevated p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                Nhân viên tuyển chọn
              </p>
              <h3 className="mt-3 flex items-center gap-2 font-semibold">
                <BookOpenCheck size={18} />
                Tìm kiếm những tiếng nói mới?
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Khám phá tiểu thuyết tiềm năng được đội ngũ cộng đồng tuyển chọn mỗi thứ Sáu.
              </p>
              <button onClick={() => window.location.assign('/search')} className="mt-3 text-xs font-semibold text-brand">
                Khám phá bộ sưu tập tuyển chọn →
              </button>
            </Card>
            <Card className="flex gap-3 p-4">
              <Info size={18} className="shrink-0 text-muted" />
              <p className="text-[10px] leading-4 text-muted">
                Bảng xếp hạng làm mới mỗi giờ. Hoạt động đáng ngờ sẽ tự động bị loại bỏ.
              </p>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
