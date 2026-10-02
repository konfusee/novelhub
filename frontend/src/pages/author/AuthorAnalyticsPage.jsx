import { useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Coins,
  Download,
  Lightbulb,
  Search,
  Sparkles,
  Trophy,
  UsersRound,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Select } from '../../components/ui'

const daily = [
  32, 39, 44, 78, 63, 48, 46, 52, 49, 62, 58, 85, 69, 55, 50, 53, 48, 65, 88, 72, 61, 58, 62, 67,
  93, 80, 68, 64, 73, 82,
]
const retention = [100, 92, 89, 87.5, 86, 85.4, 85, 84.8, 84.2, 84, 83.7, 83.5, 83.1, 82.9, 82.6]
const channels = [
  ['Bảng xếp hạng nổi bật', '#1 truyện kỳ ảo dài kỳ tuần', '42%', '524.370', '+24,1%', Trophy],
  ['Duyệt theo thể loại', 'Phân loại Kỳ ảo và Phiêu lưu', '28%', '349.580', '+11,5%', BarChart3],
  [
    'Thông báo tác giả đang theo dõi',
    'Thông báo đẩy tới người đăng ký',
    '20%',
    '249,700',
    '+5.4%',
    UsersRound,
  ],
  ['Tìm kiếm trực tiếp', 'Truy vấn từ khóa và tác giả', '10%', '124.850', '+3,2%', Search],
]

export function AuthorAnalyticsPage() {
  const [story, setStory] = useState('The Silent Forest')
  const [range, setRange] = useState('Last 30 Days')
  const [exported, setExported] = useState(false)
  const multiplier = range === 'Last 7 Days' ? 0.42 : range === 'Last 90 Days' ? 2.35 : 1
  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] text-muted">Studio tác giả / Đo lường hiệu suất</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Phân tích tác giả và thông tin độc giả
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={story} onChange={event => setStory(event.target.value)}>
              <option>The Silent Forest</option>
              <option>Echoes of Eldoria</option>
              <option value="All Stories">Tất cả truyện</option>
            </Select>
            <Select value={range} onChange={event => setRange(event.target.value)}>
              <option value="Last 7 Days">7 ngày gần nhất</option>
              <option value="Last 30 Days">30 ngày gần nhất</option>
              <option value="Last 90 Days">90 ngày gần nhất</option>
            </Select>
            <Button onClick={() => setExported(true)}>
              <Download size={15} />
              {exported ? 'Báo cáo đã sẵn sàng' : 'Xuất báo cáo'}
            </Button>
          </div>
        </div>
        <section className="nh-grid-12 mt-6 grid nh-cols-1 nh-sm-cols-2 gap-3 nh-xl-cols-4">
          <Kpi
            icon={BookOpen}
            label="Tổng lượt đọc truyện"
            value={Math.round(1248500 * multiplier).toLocaleString()}
            delta="↗ +18.4%"
          />
          <Kpi
            icon={UsersRound}
            label="Độc giả tương tác duy nhất"
            value={Math.round(84200 * multiplier).toLocaleString()}
            delta="↗ +6.2%"
            tone="orange"
          />
          <Kpi
            icon={Sparkles}
            label="Tỷ lệ hoàn thành chương trung bình"
            value="82.6%"
            delta="Top 5%"
            tone="purple"
          />
          <Kpi
            icon={Coins}
            label="Nhuận bút xu và tiền tip"
            value={`$${(1420.5 * multiplier).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            delta="98.400 xu"
            tone="orange"
          />
        </section>
        <div className="nh-grid-12 mt-6 grid gap-5 nh-layout-xl-8-4">
          <Card>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Tăng trưởng độc giả và lượt đọc hằng ngày</h2>
                <p className="text-xs text-muted">
                  Phiên đọc hoạt động trong khoảng thời gian đã chọn. Các đỉnh thể hiện đợt phát
                  hành truyện dài kỳ cuối tuần.
                </p>
              </div>
              <div className="flex gap-4 text-[10px]">
                <span className="text-brand">■ Lượt đọc hằng ngày</span>
                <span className="text-orange">■ Đỉnh phát hành</span>
              </div>
            </div>
            <div className="mt-8 flex h-56 items-end gap-1 border-b border-line px-1 sm:gap-2">
              {daily.map((height, index) => (
                <div
                  key={index}
                  title={`Ngày ${index + 1}: ${height}K lượt đọc`}
                  className={`min-w-0 flex-1 rounded-t-sm ${[3, 11, 18, 24].includes(index) ? 'bg-orange' : 'bg-brand'} ${index % 3 === 0 ? 'opacity-55' : 'opacity-90'}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[9px] text-muted">
              <span>Ngày 1</span>
              <span>Ngày 7</span>
              <span>Ngày 14</span>
              <span>Ngày 21</span>
              <span>Ngày 30</span>
            </div>
            <p className="mt-8 border-t border-line pt-4 text-xs">
              <strong className="text-brand">
                ⚡ Mức tăng độc giả cuối tuần trung bình: +46,2% tương tác
              </strong>
              <br />
              <span className="text-muted">Tính trên 4 đợt phát hành được lên lịch vào thứ Bảy</span>
            </p>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Phân bổ định dạng</h2>
            <p className="text-xs text-muted">Đọc văn bản so với lượt nghe sách nói</p>
            <div
              className="mx-auto mt-7 grid size-40 place-items-center rounded-full border-[26px] border-brand"
              style={{ borderRightColor: '#F4A261' }}
            >
              <div className="text-center">
                <span className="text-[10px] text-muted">CHỦ ĐẠO</span>
                <strong className="block text-2xl">65%</strong>
                <span className="text-[10px]">Văn bản</span>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <FormatRow
                color="bg-brand"
                label="Đọc văn bản"
                value="811.525 lượt đọc"
                percent="65%"
              />
              <FormatRow
                color="bg-orange"
                label="Sách nói"
                value="436.975 lượt phát"
                percent="35%"
              />
            </div>
          </Card>
        </div>
        <Card className="mt-6">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Tỷ lệ giữ chân theo chương và đường cong rời bỏ
              </h2>
              <p className="mt-1 text-xs text-muted">
                Theo dõi mức rời bỏ từ Chương 1 đến 15 của <em>{story}</em>. Chỉ số vượt trung bình
                nền tảng 14,2%.
              </p>
            </div>
            <div className="flex gap-4 text-[10px]">
              <span className="text-brand">■ Giữ chân thực tế của truyện</span>
              <span className="text-muted">— Mốc cơ sở nền tảng (68%)</span>
            </div>
          </div>
          <div className="nh-grid-12 mt-6 grid nh-cols-3 gap-2 nh-sm-cols-3">
            {retention.map((value, index) => (
              <button
                key={index}
                onClick={() => window.alert(`Tỷ lệ giữ chân Chương ${index + 1}: ${value}%`)}
                className={`rounded-xl border p-3 text-center ${index === 14 ? 'border-brand bg-brand/10' : 'border-line bg-elevated'}`}
              >
                <span className="text-[9px] text-muted">Chương {index + 1}</span>
                <span
                  className="mx-auto mt-3 block h-16 max-w-24 rounded-full bg-brand"
                  style={{ width: `${Math.max(55, value)}%`, opacity: 0.4 + (value / 100) * 0.6 }}
                />
                <strong className="mt-2 block text-[10px]">{value}%</strong>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-elevated p-4 sm:flex-row sm:items-center">
            <Lightbulb className="text-brand" />
            <div>
              <strong className="text-xs">Nhận định: Mức rời bỏ không đáng kể sau Chương 2</strong>
              <p className="text-[10px] text-muted">
                92% độc giả hoàn thành phần mở đầu tiếp tục đọc đến chương mới nhất.
              </p>
            </div>
            <Button onClick={() => window.alert('Đã mở phân tích chi tiết chương (bản mẫu).')} variant="secondary" className="sm:ml-auto min-h-9 text-xs">
              Xem chi tiết chương
            </Button>
          </div>
        </Card>
        <div className="nh-grid-12 mt-6 grid gap-5 nh-layout-xl-7-5">
          <Card>
            <h2 className="text-lg font-semibold">Đặc điểm độc giả và kênh khám phá</h2>
            <p className="text-xs text-muted">
              Nguồn lưu lượng đưa độc giả đến {story}
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="border-b border-line text-[10px] text-muted">
                  <tr>
                    <th className="pb-3">Nguồn kênh</th>
                    <th className="pb-3 text-right">Tỷ trọng</th>
                    <th className="pb-3 text-right">Lượt đọc chuyển đổi</th>
                    <th className="pb-3 text-right">Tăng trưởng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {channels.map(([name, note, share, reads, growth, Icon]) => (
                    <tr key={name}>
                      <td className="py-4">
                        <div className="flex gap-3">
                          <span className="grid size-8 place-items-center rounded-full bg-elevated text-brand">
                            <Icon size={14} />
                          </span>
                          <div>
                            <strong>{name}</strong>
                            <p className="text-[9px] text-muted">{note}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right font-semibold">{share}</td>
                      <td className="py-4 text-right">{reads}</td>
                      <td className="py-4 text-right text-brand">{growth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div className="flex justify-between">
              <div>
                <h2 className="text-lg font-semibold">Hồ sơ độc giả và thiết bị</h2>
                <p className="text-xs text-muted">Thiết bị, giao diện và hành vi đăng ký</p>
              </div>
              <Badge tone="green">Đã xác minh</Badge>
            </div>
            <div className="mt-5 space-y-5">
              <Progress label="Ứng dụng di động (eReader)" value={74} />
              <Progress label="Web máy tính / Máy tính bảng" value={26} color="orange" />
              <Progress label="Giao diện ban đêm / Tối" value={58} color="purple" />
              <Progress label="Người sở hữu gói Premium" value={68.4} />
            </div>
            <div className="mt-6 rounded-2xl bg-elevated p-4 text-xs italic leading-5">
              “Khả năng xây dựng thế giới dài kỳ của {story} luôn nằm trong nhóm 1% cao nhất
              NovelHub về mức giữ chân độc giả đọc liên tục nhiều chương.”
              <p className="mt-2 text-[9px] not-italic text-muted">
                — Hội đồng Biên tập NovelHub
              </p>
            </div>
          </Card>
        </div>
      </main>
    </AuthorLayout>
  )
}

function Kpi({ icon: Icon, label, value, delta, tone = 'brand' }) {
  const color = tone === 'orange' ? 'text-orange' : tone === 'purple' ? 'text-purple' : 'text-brand'
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon size={17} className={color} />
      </div>
      <strong className="mt-6 block text-2xl">{value}</strong>
      <Badge tone={tone === 'brand' ? 'green' : tone} className="mt-3">
        {delta}
      </Badge>
    </Card>
  )
}
function FormatRow({ color, label, value, percent }) {
  return (
    <div className="rounded-xl bg-elevated p-3">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${color}`} />
        <strong className="text-xs">{label}</strong>
        <strong className="ml-auto text-xs">{percent}</strong>
      </div>
      <p className="mt-1 text-right text-[10px] text-muted">{value}</p>
    </div>
  )
}
function Progress({ label, value, color = 'brand' }) {
  const bar = color === 'orange' ? 'bg-orange' : color === 'purple' ? 'bg-purple' : 'bg-brand'
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-elevated">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
