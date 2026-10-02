import { useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Copyright,
  Eye,
  ImagePlus,
  Save,
  Sparkles,
  Tags,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Input, Select } from '../../components/ui'

const genres = [
  { value: 'Fantasy', label: 'Kỳ ảo' },
  { value: 'Romance', label: 'Lãng mạn' },
  { value: 'Mystery', label: 'Bí ẩn' },
  { value: 'Sci-Fi', label: 'Khoa học viễn tưởng' },
  { value: 'Adventure', label: 'Phiêu lưu' },
  { value: 'Slice of Life', label: 'Đời thường' },
]
export function CreateStoryPage() {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('The Whisper of Sunken Stars')
  const [tagline, setTagline] = useState('An epic slow-burn fantasy across forgotten sea realms')
  const [synopsis, setSynopsis] = useState(
    'Beneath the twin moons of Eldoria, salvage diver Jennifer discovers a crystalline compass pulsating with celestial frequency. When the deep ocean trenches begin swallowing coastal sanctuaries, she must ally with an exiled tide-weaver to reawaken the sleeping Leviathans.',
  )
  const [genre, setGenre] = useState('Fantasy')
  const [tags, setTags] = useState([
    'SeaVoyage',
    'AncientMagic',
    'SlowBurn',
    'MythologicalCreatures',
  ])
  const [rating, setRating] = useState('PG-13')
  const [saved, setSaved] = useState(false)
  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-orange">
              Bước {step} / 4 · Bản nháp được tự động lưu
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Tạo truyện mới</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Thiết lập thông tin nhận diện, tóm tắt và phân loại độc giả cho cộng đồng NovelHub.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['Thông tin cơ bản', 'Bìa và hình ảnh', 'Phân loại', 'Xuất bản và bản quyền'].map(
              (label, index) => (
                <button
                  key={label}
                  onClick={() => setStep(index + 1)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${step === index + 1 ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}
                >
                  <span className="grid size-5 place-items-center rounded-full bg-black/10">
                    {index + 1}
                  </span>
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="space-y-5">
            <Card>
              <SectionTitle
                icon={BookOpen}
                title="Tiêu đề và tổng quan bản thảo"
                note="Tất cả trường đều bắt buộc nếu không có ghi chú"
              />
              <div className="mt-5 space-y-4">
                <Field label="Tên truyện *" count={`${title.length}/100`}>
                  <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                </Field>
                <Field label="Tiêu đề phụ hoặc câu giới thiệu" count={`${tagline.length}/140`}>
                  <Input
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    maxLength={140}
                  />
                </Field>
                <Field label="Tóm tắt truyện *" count={`${synopsis.length}/2000`}>
                  <div className="rounded-2xl border border-line bg-surface">
                    <div className="flex items-center gap-3 border-b border-line px-3 py-2 text-xs">
                      <strong>B</strong>
                      <em>I</em>
                      <span>❞ Trích dẫn</span>
                      <button onClick={() => window.alert('AI đã tạo gợi ý trau chuốt (bản mẫu).')} className="ml-auto flex items-center gap-1 text-brand">
                        <Sparkles size={13} />
                        Gợi ý trau chuốt bằng AI
                      </button>
                    </div>
                    <textarea
                      value={synopsis}
                      onChange={e => setSynopsis(e.target.value)}
                      className="min-h-40 w-full resize-y bg-transparent p-4 text-sm leading-6 outline-none"
                    />
                  </div>
                </Field>
              </div>
            </Card>
            <Card>
              <SectionTitle icon={Tags} title="Phân loại thể loại và thẻ khám phá" />
              <p className="mt-5 text-xs font-semibold">Thể loại chính *</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {genres.map(item => (
                  <button
                    key={item.value}
                    onClick={() => setGenre(item.value)}
                    className={`rounded-full border px-4 py-2 text-xs ${genre === item.value ? 'border-brand bg-brand text-white' : 'border-line'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold">Thể loại phụ và thẻ độc giả</p>
              <div className="mt-2 flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
                {tags.map(tag => (
                  <Badge key={tag} tone="green">
                    #{tag}
                    <button
                      onClick={() => setTags(current => current.filter(item => item !== tag))}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                <button
                  onClick={() => setTags(current => [...current, `Tag${current.length + 1}`])}
                  className="text-xs text-muted"
                >
                  + Thêm thẻ tùy chỉnh
                </button>
              </div>
              <div className="nh-grid-12 mt-6 grid gap-4 nh-sm-cols-2">
                <div>
                  <p className="text-xs font-semibold">Phân loại nội dung hướng đến</p>
                  {['PG-13', '18+'].map(value => (
                    <button
                      onClick={() => setRating(value)}
                      key={value}
                      className={`mt-2 flex w-full items-start gap-2 rounded-2xl border p-3 text-left ${rating === value ? 'border-brand bg-brand/10' : 'border-line'}`}
                    >
                      <span
                        className={`mt-0.5 size-4 rounded-full border ${rating === value ? 'border-4 border-brand' : ''}`}
                      />
                      <div>
                        <strong className="text-xs">
                          {value === 'PG-13' ? 'Độc giả phổ thông (PG-13)' : 'Trưởng thành (18+)'}
                        </strong>
                        <p className="mt-1 text-[10px] text-muted">
                          {value === 'PG-13'
                            ? 'Phù hợp với thanh thiếu niên và độc giả truyện phổ thông.'
                            : 'Có miêu tả tình cảm trực diện hoặc chủ đề u tối.'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <Field label="Ngôn ngữ bản thảo gốc">
                  <Select className="w-full">
                    <option>Tiếng Anh (Mỹ)</option>
                    <option>Tiếng Việt</option>
                    <option>Tiếng Nhật</option>
                  </Select>
                  <p className="mt-3 rounded-xl bg-purple/10 p-3 text-xs text-purple">
                    Đủ điều kiện tham gia khu vực dịch thuật toàn cầu sau chương 5.
                  </p>
                </Field>
              </div>
            </Card>
            <Card className="flex gap-3">
              <Copyright className="shrink-0 text-brand" />
              <p className="text-xs leading-5">
                <strong>Tuyên bố tác phẩm gốc và bản quyền:</strong> Tôi xác nhận “{title}” là bản
                thảo gốc do tôi sáng tác và tuân thủ Chính sách quyền tác giả của NovelHub.
              </p>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setSaved(true)}>
                <Save size={15} />
                {saved ? 'Đã lưu bản nháp' : 'Lưu làm bản nháp'}
              </Button>
              <button onClick={() => window.location.assign('/author')} className="text-sm">Hủy</button>
              <Button onClick={() => setStep(Math.min(4, step + 1))}>
                Tiếp tục đến bước {Math.min(4, step + 1)} <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Eye size={16} className="text-orange" />
                  Xem trước trên ứng dụng độc giả
                </h2>
                <Badge>Thẻ bảng tin</Badge>
              </div>
              <div className="mt-4 overflow-hidden rounded-3xl border border-line">
                <div className="relative grid aspect-[4/3] place-items-center bg-[#174c55] text-white">
                  <ImagePlus size={48} className="opacity-40" />
                  <Badge className="absolute left-3 top-3 bg-brand text-white">{genres.find(item => item.value === genre)?.label}</Badge>
                  <div className="absolute inset-x-4 bottom-4">
                    <p className="text-[10px] text-orange">Truyện gốc dài kỳ</p>
                    <h3 className="mt-1 text-xl font-bold leading-tight">
                      {title || 'Truyện chưa đặt tên'}
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold">Mira Lane · Mới phát hành</p>
                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted">{synopsis}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tags.slice(0, 3).map(tag => (
                      <Badge key={tag}>#{tag}</Badge>
                    ))}
                  </div>
                  <Button onClick={() => window.alert('Đã mở bản xem trước cho độc giả (bản mẫu).')} className="mt-4 w-full">
                    <BookOpen size={15} />
                    Đọc bản xem trước
                  </Button>
                </div>
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Danh sách kiểm tra dành cho tác giả</h2>
              <div className="mt-4 space-y-4">
                {[
                  ['Tiêu đề không trùng lặp', Boolean(title)],
                  ['Tóm tắt đủ chiều sâu', synopsis.length > 100],
                  ['Bìa đạt chuẩn HD (bước tiếp theo)', step > 1],
                  ['Bản nháp chương mở đầu', false],
                ].map(([label, done]) => (
                  <div key={label} className="flex gap-2">
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${done ? 'border-brand bg-brand text-white' : 'border-line'}`}
                    >
                      {done && <Check size={12} />}
                    </span>
                    <div>
                      <strong className="text-xs">{label}</strong>
                      <p className="text-[10px] text-muted">
                        {done ? 'Đã đáp ứng yêu cầu' : 'Hoàn thiện mục này ở bước tiếp theo.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-purple/10 p-4">
                <p className="text-xs font-semibold text-purple">MẸO HỮU ÍCH</p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Truyện có ít nhất 3 thẻ mô-típ phù hợp thường giữ chân độc giả tốt hơn.
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </AuthorLayout>
  )
}
function SectionTitle({ icon: Icon, title, note }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon size={18} className="text-brand" />
        {title}
      </h2>
      {note && <span className="text-[10px] text-muted">{note}</span>}
    </div>
  )
}
function Field({ label, count, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-xs font-semibold">
        <span>{label}</span>
        {count && <span className="font-normal text-muted">{count}</span>}
      </span>
      {children}
    </label>
  )
}
