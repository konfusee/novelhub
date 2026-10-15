import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Info,
  RefreshCw,
  ShieldCheck,
  Star,
  Trophy,
} from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { PodiumCard, PodiumCardSkeleton } from '../../components/public/PodiumCard'
import { RankingRow, RankingRowSkeleton } from '../../components/public/RankingRow'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Reveal,
  Tabs,
} from '../../components/ui'
import { useMockResource } from '../../context/MockDataContext'
import { podium, rankingCategories, rankingPeriods, rankings } from '../../data/mock/rankings'
import { extendedStories } from '../../data/mock/stories'

/* Rankings mock rows carry no cover data; reuse the catalogue entry with the same title. */
const withCatalogue = item => {
  const match = extendedStories.find(story => story.title === item.title)
  return match ? { ...item, id: match.id, color: match.color } : item
}
const board = { podium: podium.map(withCatalogue), rows: rankings.map(withCatalogue) }
const isBoardEmpty = value => !value.podium.length && !value.rows.length

const formula = [
  [45, 'thời gian đọc đã xác minh', 'brand'],
  [30, 'tỷ lệ lưu trong thư viện', 'orange'],
  [25, 'đánh giá cộng đồng thực', 'purple'],
]

export function RankingsPage({ embedded = false }) {
  const [category, setCategory] = useState('Thịnh hành')
  const [period, setPeriod] = useState('Tuần này')
  const [following, setFollowing] = useState(false)
  const [notice, setNotice] = useState('')
  const ranking = useMockResource(`rankings:${category}:${period}`, board, {
    isEmpty: isBoardEmpty,
  })
  const loading = ranking.status === 'loading'
  const { podium: podiumStories, rows: rankingRows } = ranking.data
  const Root = embedded ? 'div' : 'main'
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-12 pb-20 pt-6 lg:pt-10">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="nh-eyebrow">Những câu chuyện độc giả yêu thích</p>
              <h1 className="mt-4 text-h1 md:text-4xl">Bảng xếp hạng biên tập</h1>
              <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted">
                Tiểu thuyết mạng nguyên tác và truyện âm thanh nổi bật được cập nhật theo thời gian
                thực.
              </p>
            </div>
            <Badge tone="green">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
              Dữ liệu trực tiếp · Cập nhật 12 phút trước
            </Badge>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-b border-hairline pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <Tabs
                label="Danh mục xếp hạng"
                singleRow
                value={category}
                onChange={setCategory}
                items={rankingCategories.map(item => ({ value: item, label: item }))}
              />
            </div>
            <div
              role="group"
              aria-label="Khoảng thời gian"
              className="nh-tab-rail flex max-w-full gap-1 overflow-x-auto rounded-full border border-hairline bg-elevated p-1"
            >
              {rankingPeriods.map(item => (
                <button
                  type="button"
                  aria-pressed={period === item}
                  onClick={() => setPeriod(item)}
                  className={`min-h-9 flex-1 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-spring pointer-coarse:min-h-11 ${period === item ? 'bg-orange text-on-orange shadow-[0_6px_16px_-10px_var(--accent-orange)]' : 'text-ink/70 hover:bg-surface/80 hover:text-ink'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </header>
        {ranking.status !== 'error' && ranking.status !== 'empty' && (
          <section aria-labelledby="podium-title">
            <h2
              id="podium-title"
              className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-ink/70"
            >
              <Star size={13} className="fill-orange text-orange" aria-hidden="true" />
              {category} · Dẫn đầu {period.toLowerCase()}
            </h2>
            {loading ? (
              <div
                aria-busy="true"
                aria-label="Đang tải nhóm dẫn đầu"
                className="nh-grid-12 grid gap-4 nh-lg-cols-3 lg:items-end"
              >
                {[2, 1, 3].map(rank => (
                  <div key={rank} className={rank === 1 ? 'order-first lg:order-none' : ''}>
                    <PodiumCardSkeleton champion={rank === 1} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="nh-grid-12 grid gap-4 nh-lg-cols-3 lg:items-end">
                {[podiumStories[1], podiumStories[0], podiumStories[2]]
                  .filter(Boolean)
                  .map((story, index) => (
                    <Reveal
                      key={story.rank}
                      delay={index * 80}
                      className={story.rank === 1 ? 'order-first lg:order-none' : ''}
                    >
                      <PodiumCard story={story} />
                    </Reveal>
                  ))}
              </div>
            )}
          </section>
        )}
        <div className="nh-grid-12 grid gap-y-8 nh-layout-lg-8-4">
          {ranking.status === 'error' || ranking.status === 'empty' ? (
            <Card className="self-start p-0">
              {ranking.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được bảng xếp hạng"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                  action={
                    <Button variant="secondary" size="sm" onClick={ranking.retry}>
                      <RefreshCw size={14} aria-hidden="true" />
                      Thử lại
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Trophy}
                  title="Chưa có dữ liệu xếp hạng cho bộ lọc này"
                  description="Bảng xếp hạng cần thêm lượt đọc đã xác minh. Hãy chọn khoảng thời gian khác hoặc khám phá truyện mới."
                  action={
                    <ButtonLink to="/search" size="sm" trailingIcon={ArrowRight}>
                      Khám phá truyện
                    </ButtonLink>
                  }
                />
              )}
            </Card>
          ) : (
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-h3 md:text-h2">Hạng #04 — #15</h2>
                <span className="text-sm text-muted">Hiển thị 12 ứng viên</span>
              </div>
              {loading ? (
                <Card
                  aria-busy="true"
                  aria-label="Đang tải danh sách xếp hạng"
                  className="divide-y divide-hairline overflow-hidden p-0"
                >
                  {rankings.map(item => (
                    <RankingRowSkeleton key={item.rank} />
                  ))}
                </Card>
              ) : (
                <Reveal>
                  <Card className="divide-y divide-hairline overflow-hidden p-0">
                    {rankingRows.map(item => (
                      <RankingRow item={item} key={item.rank} />
                    ))}
                  </Card>
                </Reveal>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>Hiển thị 15 / 250 mục xếp hạng</span>
                <Button
                  type="button"
                  onClick={() => setNotice('Đã tải 15 mục xếp hạng tiếp theo (mô phỏng).')}
                  variant="secondary"
                  size="sm"
                  trailingIcon={ArrowRight}
                  disabled={loading}
                >
                  15 truyện tiếp theo
                </Button>
              </div>
              {notice && (
                <p role="status" className="mt-3 text-right text-sm text-brand-strong">
                  {notice}
                </p>
              )}
            </section>
          )}
          <aside className="space-y-5">
            <Reveal>
              <Card className="p-6">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck size={19} className="text-brand" aria-hidden="true" />
                  Công thức xếp hạng công bằng
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  NovelHub kết hợp thời gian đọc, tỷ lệ hoàn thành chương và đánh giá độc giả đã xác
                  minh.
                </p>
                <ul className="mt-4 space-y-3 border-t border-hairline pt-4 text-xs text-muted">
                  {formula.map(([value, label, tone]) => (
                    <li key={label}>
                      <span className="flex justify-between gap-3">
                        <span>{label}</span>
                        <strong className="tabular-nums text-ink">{value}%</strong>
                      </span>
                      <ProgressBar
                        value={value}
                        tone={tone}
                        size="sm"
                        label={label}
                        className="mt-1.5"
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
            <Reveal delay={80}>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-orange-strong">
                    Tác giả nổi bật
                  </p>
                  <Badge>Tuần 38</Badge>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-orange/16 text-sm font-semibold text-orange-strong ring-1 ring-orange/40">
                    ML
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">Mira Lane</h3>
                    <p className="text-xs text-muted">Kỳ ảo & giả tưởng suy đoán</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">
                  Author of #1 hit The Silent Forest. Former mythologist exploring human resilience
                  and untamed wilderness.
                </p>
                <div className="nh-grid-12 mt-4 grid nh-cols-2 gap-3 border-y border-hairline py-3 text-center text-sm">
                  <span>
                    <strong className="block font-semibold tabular-nums">48.2K</strong>
                    <small className="text-xs text-muted">Người theo dõi</small>
                  </span>
                  <span>
                    <strong className="block font-semibold">6 tiểu thuyết ngắn</strong>
                    <small className="text-xs text-muted">Đã xuất bản</small>
                  </span>
                </div>
                <Button
                  type="button"
                  aria-pressed={following}
                  variant={following ? 'secondary' : 'primary'}
                  onClick={() => setFollowing(!following)}
                  className="mt-4 w-full"
                >
                  {following ? 'Đang theo dõi' : 'Theo dõi tác giả'}
                </Button>
              </Card>
            </Reveal>
            <Reveal delay={160}>
              <Card className="bg-elevated p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-brand-strong">
                  Nhân viên tuyển chọn
                </p>
                <h3 className="mt-3 flex items-center gap-2 text-base font-semibold">
                  <BookOpenCheck size={18} aria-hidden="true" />
                  Tìm kiếm những tiếng nói mới?
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Khám phá tiểu thuyết tiềm năng được đội ngũ cộng đồng tuyển chọn mỗi thứ Sáu.
                </p>
                <Link
                  to="/search"
                  className="group mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-strong"
                >
                  Xem bộ sưu tập
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                  />
                </Link>
              </Card>
            </Reveal>
            <Card className="flex gap-3 p-4">
              <Info size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-xs leading-5 text-muted">
                Bảng xếp hạng làm mới mỗi giờ. Hoạt động đáng ngờ sẽ tự động bị loại bỏ.
              </p>
            </Card>
          </aside>
        </div>
      </Root>
    </div>
  )
}
