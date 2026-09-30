import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { PublicHeader } from '../../components/public/PublicHeader'
import { CategoryCard } from '../../components/public/CategoryCard'
import { StoryShelf } from '../../components/public/StoryShelf'
import { Badge, Button, Card, Input } from '../../components/ui'
import { categories, popularTags } from '../../data/mock/categories'
import { extendedStories, hiddenGems } from '../../data/mock/stories'

const filters = [['All', 'Tất cả'], ['Popular', 'Phổ biến'], ['New', 'Mới'], ['Trending', 'Thịnh hành'], ['Completed', 'Đã hoàn thành']]

export function CategoriesPage({ embedded = false }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedGenre, setSelectedGenre] = useState('')
  const visibleCategories = useMemo(
    () =>
      categories.filter(category =>
        `${category.name} ${category.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  )
  const fantasy = extendedStories.filter(story => story.genre === 'Fantasy').slice(0, 4)
  const romance = extendedStories
    .filter(story => story.genre === 'Romance' || story.genre === 'Drama')
    .slice(0, 4)
  const scifi = extendedStories.filter(story => story.genre === 'Sci-Fi').slice(0, 4)
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <main className="page-public space-y-10 py-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
            Khám phá thế giới tiếp theo
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Khám phá thể loại</h1>
          <p className="mt-2 text-sm text-muted">
            Khám phá những thế giới tưởng tượng theo thể loại, cảm xúc và lựa chọn của độc giả.
          </p>
        </header>
        <section className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            icon={Search}
            placeholder="Lọc theo từ khóa hoặc thể loại phụ..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="md:max-w-sm"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium ${filter === value ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:border-brand'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold">Tất cả thể loại</h2>
              {selectedGenre && (
                <p className="mt-1 text-xs text-brand">Đã chọn: {selectedGenre}</p>
              )}
            </div>
            <span className="text-xs text-muted">{visibleCategories.length} thể loại chính</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCategories.map(category => (
              <CategoryCard key={category.name} category={category} onSelect={setSelectedGenre} />
            ))}
          </div>
          {!visibleCategories.length && (
            <Card className="text-center text-sm text-muted">Không có thể loại phù hợp “{query}”.</Card>
          )}
        </section>
        <Card className="p-5 md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-orange">
                Bộ sưu tập tuyển chọn
              </p>
              <h2 className="mt-1 text-xl font-bold">Phổ biến tuần này</h2>
            </div>
            <button onClick={() => window.location.assign('/search')} className="flex items-center gap-1 text-xs font-semibold text-brand">
              Khám phá tất cả <ArrowRight size={14} />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {popularTags.map((tag, index) => (
              <button
                onClick={() => setQuery(tag.replace('#', ''))}
                className="rounded-xl border border-line bg-page px-3 py-3 text-center hover:border-brand"
                key={tag}
              >
                <strong className="block text-xs">{tag}</strong>
                <span className="mt-1 block text-[9px] text-muted">
                  {420 + index * 175} truyện
                </span>
              </button>
            ))}
          </div>
        </Card>
        <StoryShelf title="Kỳ ảo — Thế giới sử thi & phép thuật" stories={fantasy} />
        <StoryShelf title="Lãng mạn — Hành trình cảm xúc" stories={romance} />
        <StoryShelf title="Khoa học viễn tưởng & Cyberpunk — Chân trời tương lai" stories={scifi} />
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
            Ban biên tập tuyển chọn
          </p>
          <h2 className="mt-1 text-2xl font-bold">Viên ngọc ẩn</h2>
          <p className="mt-1 text-xs text-muted">
            Những tác phẩm có văn phong đặc sắc đã được tuyển chọn kỹ và đang chờ bạn khám phá.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {hiddenGems.map(item => (
              <Card key={item.title} className="flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <Badge
                    tone={
                      item.genre === 'Adventure'
                        ? 'orange'
                        : item.genre === 'Mystery'
                          ? 'purple'
                          : 'green'
                    }
                  >
                    {item.genre}
                  </Badge>
                  <span className="text-[10px] text-muted">{item.chapters} chương</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted">{item.description}</p>
                <div className="mt-auto flex items-center justify-between pt-5 text-[10px]">
                  <span>Tác giả {item.author}</span>
                  <button onClick={() => window.location.assign('/stories/demo')} className="font-semibold text-brand">Đọc thử →</button>
                </div>
              </Card>
            ))}
          </div>
        </section>
        <section className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-line bg-surface p-7 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-2xl font-bold">Tham gia NovelHub hôm nay</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Mở khóa đề xuất cá nhân, đồng bộ tiến độ đọc và xây dựng thư viện số trên mọi thiết bị.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button onClick={() => window.location.assign('/register')}>Tạo tài khoản</Button>
            <Button onClick={() => window.location.assign('/')} variant="secondary">Tìm hiểu thêm</Button>
          </div>
        </section>
      </main>
    </div>
  )
}
