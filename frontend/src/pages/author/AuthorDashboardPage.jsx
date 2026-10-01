import { useState } from 'react'
import {
  Bot,
  BookOpen,
  Coins,
  Edit3,
  Flame,
  Headphones,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { authorStats, authorStories } from '../../data/mock/author'
import { Badge, Button, Card, Tabs } from '../../components/ui'

const icons = [BookOpen, Headphones, UsersRound, Coins]
const statusLabels = { Published: 'Đã xuất bản', 'In Review': 'Đang xét duyệt', Draft: 'Bản nháp' }
const metricLabels = { Unpublished: 'Chưa xuất bản' }
export function AuthorDashboardPage() {
  const [filter, setFilter] = useState('all')
  const [reply, setReply] = useState('')
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {authorStats.map(([label, value, delta], index) => {
            const Icon = icons[index]
            return (
              <Card key={label} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">{label}</p>
                  <Icon
                    size={18}
                    className={
                      index === 3 ? 'text-purple' : index === 1 ? 'text-orange' : 'text-brand'
                    }
                  />
                </div>
                <p className="mt-4 text-2xl font-bold">
                  {value} <span className="text-[10px] font-medium text-brand">{delta}</span>
                </p>
                <div className="mt-4 h-1.5 rounded-full bg-elevated">
                  <div
                    className={`h-full rounded-full ${index === 3 ? 'w-4/5 bg-purple' : index === 1 ? 'w-2/3 bg-orange' : 'w-3/4 bg-brand'}`}
                  />
                </div>
              </Card>
            )
          })}
        </section>
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Tiếp tục sáng tác <Badge className="ml-2">2 tác phẩm đang viết</Badge>
            </h2>
            <button onClick={() => window.location.assign('/author/drafts')} className="text-xs text-brand">Xem tất cả bản nháp →</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DraftCard
              title="The Silent Forest"
              chapter="Chương 16: Heart of the Ironwood"
              progress={72}
              words="2.840 / 3.500 từ"
              primary
            />
            <DraftCard
              title="Echoes of Eldoria"
              chapter="Chương 3: The Crystal Archivist"
              progress={38}
              words="1.420 / 4.000 từ"
            />
          </div>
        </section>
        <div className="mt-7 grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-semibold">
                    Hiệu suất truyện và trạng thái bản nháp gần đây
                  </h2>
                  <p className="text-xs text-muted">
                    Quản lý truyện đang đăng và quy trình xét duyệt
                  </p>
                </div>
                <Tabs
                  value={filter}
                  onChange={setFilter}
                  items={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'published', label: 'Đã xuất bản' },
                    { value: 'review', label: 'Đang xét duyệt' },
                    { value: 'draft', label: 'Bản nháp' },
                  ]}
                />
              </div>
              <div className="mt-5 divide-y divide-line">
                {authorStories
                  .filter(
                    story =>
                      filter === 'all' || story.status.toLowerCase().replace('in ', '') === filter,
                  )
                  .map(story => (
                    <div key={story.title} className="flex items-center gap-3 py-4">
                      <div
                        className="grid h-16 w-11 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: story.color }}
                      >
                        NH
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">{story.title}</h3>
                          <Badge
                            tone={
                              story.status === 'Published'
                                ? 'green'
                                : story.status === 'In Review'
                                  ? 'orange'
                                  : 'neutral'
                            }
                          >
                            {statusLabels[story.status] ?? story.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {story.chapters} chương · ★ {metricLabels[story.rating] ?? story.rating} ·{' '}
                          {story.reads.replace(' words', ' từ')} {story.reads.includes('words') ? '' : 'lượt đọc'}
                        </p>
                      </div>
                      <Button onClick={() => window.location.assign('/author/stories/demo')}
                        variant="secondary"
                        className="hidden min-h-9 px-3 py-1 text-xs sm:flex"
                      >
                        {story.status === 'Published' ? <Plus size={14} /> : <Send size={14} />}{' '}
                        {story.status === 'Published'
                          ? 'Thêm chương'
                          : story.status === 'In Review'
                            ? 'Xem bản gửi duyệt'
                            : 'Gửi xét duyệt'}
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>
            <Card className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-brand">
                  Tiến độ sáng tác tuần
                </p>
                <h2 className="mt-2 text-xl font-semibold">Đã viết 18.450 từ trong tuần này</h2>
                <p className="mt-1 text-sm text-muted">
                  Bạn đã vượt mục tiêu viết nhanh thường kỳ 24%.
                </p>
              </div>
              <div className="text-center">
                <strong className="text-3xl text-brand">6 ngày</strong>
                <p className="text-xs text-muted">Chuỗi sáng tác hằng ngày 🔥</p>
              </div>
              <Button onClick={() => window.alert('Đã mở cài đặt mục tiêu viết nhanh (bản mẫu).')} variant="secondary">Cài đặt mục tiêu</Button>
            </Card>
          </div>
          <aside className="min-w-0 space-y-5">
            <Card className="border-purple/40">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Bot className="text-purple" />
                  Trợ lý sáng tác AI
                </h2>
                <Badge tone="purple">Đang hoạt động 4.5</Badge>
              </div>
              <p className="mt-3 text-xs text-muted">
                Đang phân tích: <strong className="text-ink">The Silent Forest (Chương 16)</strong>
              </p>
              <div className="mt-4 space-y-3">
                <Insight title="Cảnh báo nhịp độ chương">
                  Chuyển cảnh 3 còn đột ngột. Hãy cân nhắc tăng thêm không khí hồi hộp.
                </Insight>
                <Insight title="Kiểm tra tính nhất quán thế giới truyện">
                  Mặt dây chuyền Ironwood được nhắc đến lần gần nhất ở Chương 4.
                </Insight>
              </div>
              <Button onClick={() => window.location.assign('/author/ai')} className="mt-4 w-full border-purple bg-purple">
                <Sparkles size={15} />
                Kiểm tra toàn bộ bản thảo
              </Button>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Phản hồi của độc giả</h2>
                <Badge>9+ mới</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  'Màn hé lộ về linh hồn hộ vệ khiến tôi thật sự bất ngờ!',
                  'Người kể sách nói đã thể hiện rất hay đoạn chiến ca.',
                ].map((text, index) => (
                  <div key={text} className="rounded-2xl bg-elevated p-3">
                    <div className="flex items-center">
                      <strong className="text-xs">{index ? 'Elena Rivera' : 'Liam Vance'}</strong>
                      <MessageCircle size={13} className="ml-auto text-rose" />
                    </div>
                    <p className="mt-2 text-xs italic leading-5 text-muted">“{text}”</p>
                  </div>
                ))}
              </div>
              <input
                value={reply}
                onChange={e => setReply(e.target.value)}
                className="mt-4 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs outline-none focus:border-brand"
                placeholder="Gửi phản hồi tới độc giả..."
              />
            </Card>
            <Card className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-orange/15 text-orange">
                <Flame />
              </span>
              <div>
                <strong className="text-sm">Hạng Hội NovelHub: Cấp 4</strong>
                <p className="text-xs text-muted">Top 5% bảng xếp hạng tác giả · còn 850 XP để lên Cấp 5</p>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </AuthorLayout>
  )
}
function DraftCard({ title, chapter, progress, words, primary = false }) {
  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <div className="grid h-24 w-16 shrink-0 place-items-center rounded-2xl bg-brand text-white">
          NH
        </div>
        <div className="min-w-0">
          <Badge tone={primary ? 'green' : 'orange'}>
            {primary ? 'Dự án chính' : 'Truyện dài phụ'}
          </Badge>
          <h3 className="mt-2 text-lg font-semibold">{title}</h3>
          <p className="text-xs text-muted">{chapter}</p>
        </div>
      </div>
      <div className="mt-4 flex items-end gap-4 border-t border-line pt-4">
        <div className="flex-1">
          <div className="flex justify-between text-[10px]">
            <span>
              <strong>Đã viết {progress}%</strong>
            </span>
            <span className="text-brand">{words}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-elevated">
            <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <Button onClick={() => window.location.assign('/author/stories/demo/chapters/chapter-1/edit')} className="min-h-9 px-4 py-1 text-xs">
          <Edit3 size={14} />
          {primary ? 'Viết tiếp' : 'Mở bản nháp'}
        </Button>
      </div>
    </Card>
  )
}
function Insight({ title, children }) {
  return (
    <div className="rounded-2xl border border-purple/30 bg-purple/10 p-4">
      <strong className="text-sm">{title}</strong>
      <p className="mt-2 text-xs leading-5 text-muted">{children}</p>
    </div>
  )
}
