import { useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Hash,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Tabs } from '../../components/ui'

const seed = [
  ['Fantasy & Mythic', 'fantasy-mythic', 'Soft Teal', '14,200', '2.4M'],
  ['Romance & Drama', 'romance-drama', 'Soft Rose', '21,800', '3.8M'],
  ['Mystery & Thriller', 'mystery-thriller', 'Soft Orange', '9,400', '1.1M'],
  ['Sci-Fi & Cyberpunk', 'scifi-cyberpunk', 'Soft Purple', '11,600', '1.9M'],
  ['Adventure & Exploration', 'adventure-exploration', 'Neutral Teal', '16,100', '1.5M'],
  ['Slice of Life & Cozy', 'slice-of-life-cozy', 'Soft Amber', '8,300', '920K'],
  ['Historical & Period', 'historical-period', 'Neutral Slate', '6,700', '640K'],
  ['Horror & Supernatural', 'horror-supernatural', 'Dark Slate', '5,200', '480K'],
  ['Comedy & Satire', 'comedy-satire', 'Soft Orange', '4,100', '380K'],
]
const tabs = [
  { value: 'categories', label: 'Danh mục · 9 đang hoạt động' },
  { value: 'tags', label: 'Thể loại phụ và thẻ · 148' },
  { value: 'ratings', label: 'Xếp hạng nội dung · 3 cấp' },
  { value: 'lifecycle', label: 'Vòng đời truyện · 6 trạng thái' },
]
const categoryLabels = {
  'Fantasy & Mythic': 'Kỳ ảo và thần thoại', 'Romance & Drama': 'Lãng mạn và chính kịch',
  'Mystery & Thriller': 'Bí ẩn và giật gân', 'Sci-Fi & Cyberpunk': 'Khoa học viễn tưởng và Cyberpunk',
  'Adventure & Exploration': 'Phiêu lưu và khám phá', 'Slice of Life & Cozy': 'Đời thường và chữa lành',
  'Historical & Period': 'Lịch sử và thời đại', 'Horror & Supernatural': 'Kinh dị và siêu nhiên',
  'Comedy & Satire': 'Hài hước và châm biếm',
}
const tintLabels = { 'Soft Teal': 'Xanh ngọc nhạt', 'Soft Rose': 'Hồng nhạt', 'Soft Orange': 'Cam nhạt', 'Soft Purple': 'Tím nhạt', 'Neutral Teal': 'Xanh ngọc trung tính', 'Soft Amber': 'Hổ phách nhạt', 'Neutral Slate': 'Xám đá trung tính', 'Dark Slate': 'Xám đá đậm' }

export function CategoriesConfigurationPage() {
  const [active, setActive] = useState('categories')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState(seed)
  const [modal, setModal] = useState('')
  const [ai, setAi] = useState(true)
  const [notice, setNotice] = useState('')
  const filtered = useMemo(
    () => categories.filter(item => item.join(' ').toLowerCase().includes(query.toLowerCase())),
    [categories, query],
  )
  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= categories.length) return
    setCategories(items => {
      const copy = [...items]
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
      return copy
    })
    setNotice('Đã cập nhật thứ tự phân loại cục bộ')
  }
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">
              Bảng điều khiển quản trị / Kiến trúc nội dung / Phân loại và xếp hạng
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Cấu hình danh mục, thẻ và nội dung
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setNotice('Đã đưa việc lập lại chỉ mục phân loại vào hàng đợi (bản mẫu).')}
            >
              <RefreshCw size={15} />
              Lập lại chỉ mục phân loại
            </Button>
            <Button variant="secondary" onClick={() => setModal('Tạo thẻ')}>
              <Hash size={15} />
              Tạo thẻ
            </Button>
            <Button onClick={() => setModal('Thêm danh mục mới')}>
              <Plus size={15} />
              Thêm danh mục
            </Button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto border-b border-line pb-3">
          <Tabs value={active} onChange={setActive} items={tabs} />
        </div>
        {active === 'categories' && <Card className="mt-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Danh mục xuất bản cốt lõi <Badge tone="blue">Phân loại cấp 1</Badge>
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-muted">
                Thể loại cốt lõi xuất hiện trong khám phá, điều hướng độc giả và bộ lọc công khai.
              </p>
            </div>
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Lọc bản ghi danh mục..."
              className="w-full lg:w-72"
            />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-elevated text-[9px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-4 py-4">Thứ tự</th><th>Danh mục và token</th><th>Màu nhận diện</th>
                  <th>Truyện hoạt động</th><th>Lượt đọc tháng</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item, index) => (
                  <tr key={item[1]} className="hover:bg-elevated/50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(index, -1)}>
                          <ChevronUp size={14} />
                        </button>
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <button onClick={() => move(index, 1)}>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong className="block text-sm">{categoryLabels[item[0]] ?? item[0]}</strong>
                      <span className="font-mono text-[10px] text-muted">/genre/{item[1]}</span>
                    </td>
                    <td>
                      <Badge tone={index % 3 === 1 ? 'red' : index % 3 === 2 ? 'orange' : 'green'}>
                        {tintLabels[item[2]] ?? item[2]}
                      </Badge>
                    </td>
                    <td className="font-semibold">{item[3]}</td>
                    <td className="font-semibold text-brand">{item[4]}</td>
                    <td>
                      <Badge tone="blue">{index < 4 ? 'Hàng nổi bật' : 'Lưới khám phá'}</Badge>
                    </td>
                    <td>
                      <Badge tone="green">Đang hoạt động</Badge>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          aria-label={`Sửa ${categoryLabels[item[0]] ?? item[0]}`}
                          onClick={() => setModal(`Sửa ${categoryLabels[item[0]] ?? item[0]}`)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          aria-label={`Lưu trữ ${categoryLabels[item[0]] ?? item[0]}`}
                          onClick={() => setNotice(`Đã lưu trữ ${categoryLabels[item[0]] ?? item[0]} (bản mẫu).`)}
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3 text-[10px] text-muted">
            <span>
              Đang hiển thị {filtered.length} / {categories.length} danh mục đã xuất bản
            </span>
            <button
              onClick={() => setNotice('Đã tải lược đồ phân loại (bản mẫu).')}
              className="flex items-center gap-1 text-brand"
            >
              <Download size={13} />
              Tải lược đồ phân loại
            </button>
          </div>
        </Card>}
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {active === 'tags' && <Card>
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">Từ vựng thẻ và tiếp nhận bằng AI</h2>
                <p className="text-xs text-muted">
                  Quản lý tiểu thể loại, mô-típ độc giả và quy tắc gắn thẻ tự động.
                </p>
              </div>
              <Badge tone="blue">148 thẻ</Badge>
            </div>
            <Input icon={Hash} placeholder="Tìm thẻ, ví dụ #SlowBurn" className="mt-5" />
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                '#SlowBurn',
                '#AncientMagic',
                '#MythologicalCreatures',
                '#SeaVoyage',
                '#DarkFantasy',
              ].map((tag, index) => (
                <Badge key={tag} tone={index === 4 ? 'orange' : 'green'}>
                  {tag} · {1240 - index * 190}
                </Badge>
              ))}
            </div>
            <button
              onClick={() => setAi(!ai)}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-elevated p-4 text-left"
            >
              <Sparkles className="text-brand" />
              <span className="flex-1">
                <strong className="block text-sm">Bộ máy đề xuất thẻ tự động</strong>
                <small className="text-muted">NovelCraft AI gắn thẻ khi tiếp nhận truyện</small>
              </span>
              <span
                className={`flex h-6 w-11 items-center rounded-full p-1 ${ai ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
              >
                <span className="size-4 rounded-full bg-white" />
              </span>
            </button>
          </Card>}
          {active === 'ratings' && <Card>
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">Xếp hạng nội dung và giới hạn độ tuổi</h2>
                <p className="text-xs text-muted">
                  Tiêu chí bắt buộc cho các nhóm tuổi độc giả và yêu cầu tuân thủ.
                </p>
              </div>
              <Badge tone="blue">3 cấp</Badge>
            </div>
            <div className="mt-5 space-y-3">
              <Rating
                badge="G"
                title="Mọi đối tượng (G / PG)" note="Nội dung an toàn, không có bạo lực trực diện và phù hợp gia đình."
                tone="green"
              />
              <Rating
                badge="13+"
                title="Thanh thiếu niên (PG-13)" note="Có cảnh chiến đấu cách điệu vừa phải và chủ đề căng thẳng."
                tone="orange"
              />
              <Rating
                badge="18+"
                title="Trưởng thành (18+)" note="Kinh dị trực diện hoặc lãng mạn trưởng thành yêu cầu xác minh độ tuổi."
                tone="red"
              />
            </div>
          </Card>}
          {active === 'lifecycle' && <Card className="xl:col-span-2">
            <h2 className="text-xl font-semibold">Trạng thái vòng đời truyện</h2>
            <p className="mt-1 text-xs text-muted">Trạng thái xuất bản kiểm soát khả năng hiển thị, chỉnh sửa, kiểm duyệt và truy cập của độc giả.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {['Bản nháp', 'Chờ duyệt', 'Yêu cầu chỉnh sửa', 'Đã duyệt', 'Đã xuất bản', 'Đã lưu trữ'].map((state, index) => (
                <div key={state} className="rounded-2xl border border-line bg-elevated p-4">
                  <Badge tone={index < 2 ? 'orange' : index === 4 ? 'green' : 'neutral'}>{state}</Badge>
                  <p className="mt-3 text-xs text-muted">{index + 1}. Chuyển đổi hợp lệ trong quy trình biên tập và xuất bản.</p>
                </div>
              ))}
            </div>
          </Card>}
        </div>
        <Card className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <strong>Đã lưu mọi thay đổi cục bộ đang chờ</strong>
            <p className="text-xs text-muted">
              Phiên bản xuất bản gần nhất: 4.12.0 · Đã tự động lưu cục bộ
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setNotice('Đã dựng lại chỉ mục danh mục ElasticSearch (bản mẫu).')}
          >
            Dựng lại chỉ mục tìm kiếm
          </Button>
          <Button onClick={() => setNotice('Đã lưu cấu hình phân loại cục bộ.')}>
            Lưu cấu hình phân loại
          </Button>
        </Card>
        <Modal open={Boolean(modal)} title={modal} onClose={() => setModal('')}>
          <div className="space-y-3">
            <Input placeholder="Tên hiển thị" />
            <Input placeholder="URL slug" />
            <Input placeholder="Mô tả" />
            <Button
              onClick={() => {
                setModal('')
                setNotice('Đã lưu cấu hình (bản mẫu).')
              }}
              className="w-full"
            >
              Lưu cấu hình
            </Button>
          </div>
        </Modal>
        <Modal open={Boolean(notice)} title="Cập nhật cấu hình" onClose={() => setNotice('')}>
          <p className="text-sm">{notice}</p>
          <Button onClick={() => setNotice('')} className="mt-5 w-full">
            Hoàn tất
          </Button>
        </Modal>
      </main>
    </AdminLayout>
  )
}
function Rating({ badge, title, note, tone }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-line p-4">
      <Badge tone={tone}>{badge}</Badge>
      <div>
        <strong className="text-sm">{title}</strong>
        <p className="mt-1 text-xs text-muted">{note}</p>
      </div>
    </div>
  )
}
