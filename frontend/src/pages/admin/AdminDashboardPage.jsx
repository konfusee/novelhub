import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Download,
  Gauge,
  MoreHorizontal,
  RotateCcw,
  ShieldAlert,
  UserRoundCheck,
} from '../../components/icons'
import { AdminLayout } from '../../layouts'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Modal,
  ProgressBar,
  Reveal,
  Select,
  Skeleton,
  Tabs,
  Trend,
  parseTrend,
} from '../../components/ui'
const icons = [Activity, BookOpen, UserRoundCheck, BookOpen, ShieldAlert, Gauge]
const iconTones = [
  'bg-brand/10 text-brand-strong',
  'bg-orange/16 text-orange-strong',
  'bg-brand/10 text-brand-strong',
  'bg-purple/12 text-purple-strong',
  'bg-rose/12 text-rose-strong',
  'bg-brand/10 text-brand-strong',
]
const emptyDashboard = {
  kpis: [],
  actions: [],
}
const dashboardKeys = [
  'activeAccounts',
  'activeAuthors',
  'publishedStories',
  'pendingApplications',
  'reviewQueue',
]
const validateDashboard = value => {
  if (
    !value ||
    !Number.isFinite(Date.parse(value.asOf)) ||
    !Array.isArray(value.kpis) ||
    value.kpis.length !== dashboardKeys.length ||
    value.kpis.some(
      ([key, count], index) =>
        key !== dashboardKeys[index] || !Number.isSafeInteger(count) || count < 0,
    ) ||
    !Array.isArray(value.actions) ||
    value.actions.some(
      row => !Array.isArray(row) || row.length !== 4 || row.some(cell => typeof cell !== 'string'),
    )
  )
    throw new Error('Invalid Admin dashboard')
  return value
}
const metricSeries = {
  signups: ['Độc giả mới', 'Tác giả mới'],
  stories: ['Truyện mới', 'Chương cập nhật'],
  royalty: ['Xu đã chi', 'Nhuận bút đã trả'],
}
const statNotes = {}
const statusLabels = {
  Success: 'Thành công',
  'Policy Violation': 'Vi phạm chính sách',
  'High Severity Alert': 'Cảnh báo nghiêm trọng cao',
}
const eventLabels = {
  'Updated TTS Neural Voice Engine endpoint':
    'Đã cập nhật điểm cuối bộ máy giọng nói TTS thần kinh',
  'Auto-scaled storage mesh node us-east-2': 'Tự động mở rộng nút mạng lưu trữ us-east-2',
  'Revoked publication rights for Author #AUT-9921':
    'Đã thu hồi quyền xuất bản của Tác giả #AUT-9921',
  'Mitigated IP rate-limit anomaly (142 blocked)':
    'Đã xử lý bất thường giới hạn tốc độ IP (chặn 142)',
}
const statusTone = status =>
  status === 'Success' ? 'green' : status.includes('High') ? 'red' : 'orange'
export function AdminDashboardPage() {
  const { t, formatNumber } = useLocale(),
    m = key => t(`dashboardData.${key}`)
  const dashboard = useBackendResource('/admin/dashboard', emptyDashboard, validateDashboard)
  const resource = data => ({
    ...dashboard,
    data,
    status: dashboard.status === 'ready' && !data.length ? 'empty' : dashboard.status,
  })
  const kpis = resource(
    dashboard.data.kpis.map(([key, value]) => [key, formatNumber(value), m('current')]),
  )
  const actions = resource(
    dashboard.data.actions.map(([time, actor, action, result]) => [
      new Date(time).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }),
      actor === 'system' ? m('system') : actor,
      action,
      result,
    ]),
  )
  const growth = resource([])
  const services = resource([])
  const [metric, setMetric] = useState('signups')
  const [range, setRange] = useState('30d')
  const [exported, setExported] = useState(false)
  const [maintenance, setMaintenance] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [safeguard, setSafeguard] = useState(null)
  const [auditEntry, setAuditEntry] = useState(null)
  const [firstSeries, secondSeries] = metricSeries[metric]
  const exportKpis = () => {
    const rows = [
      [m('metric'), m('value')],
      ...dashboard.data.kpis.map(([key, value]) => [m(key), value]),
    ]
    const csv = rows
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'novelhub-admin-kpi.csv'
    link.click()
    URL.revokeObjectURL(url)
    setExported(true)
  }

  /* Turning a safeguard on needs confirmation; turning it off is immediate. */
  const requestToggle = (label, value, setValue) => {
    if (value) {
      setValue(false)
      return
    }
    setSafeguard({
      label,
      confirm: () => setValue(true),
    })
  }
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-caption text-ink/70">
              Bảng điều khiển quản trị / Vận hành và tình trạng hệ thống
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Bảng vận hành nền tảng</h1>
            <ButtonLink to="/admin/payouts#finance-report" variant="secondary" className="mt-4">
              {t('platformFinance.title')}
            </ButtonLink>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={dashboard.status === 'loading'}
              onClick={dashboard.retry}
            >
              <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
              {m('reload')}
            </Button>
            <Button
              variant="secondary"
              disabled={dashboard.status !== 'ready'}
              onClick={exportKpis}
            >
              <Download size={16} />
              {m(exported ? 'exported' : 'export')}
            </Button>
            <ButtonLink to="/admin/author-statistics" variant="secondary">
              {t('adminAuthorStats.title')}
            </ButtonLink>
          </div>
        </header>

        {kpis.status === 'error' || kpis.status === 'empty' ? (
          <Card as="section" aria-label="Chỉ số chính" className="mt-6 p-0">
            {kpis.status === 'error' ? (
              <LoadError
                title="Không tải được chỉ số chính"
                description="Kho số liệu vận hành chưa phản hồi. Các dịch vụ nền tảng không bị ảnh hưởng."
                onRetry={kpis.retry}
                className="py-10"
              />
            ) : (
              <EmptyState
                icon={Gauge}
                title="Chưa có chỉ số cho kỳ này"
                description="Số liệu KPI xuất hiện sau lần tổng hợp đầu tiên. Xem nhật ký kiểm tra để theo dõi hoạt động."
                className="py-10"
                action={
                  <ButtonLink to="/admin/audit-logs" variant="secondary" size="sm">
                    Mở nhật ký kiểm tra
                  </ButtonLink>
                }
              />
            )}
          </Card>
        ) : (
          <section
            aria-label={kpis.status === 'loading' ? 'Đang tải chỉ số chính' : 'Chỉ số chính'}
            aria-busy={kpis.status === 'loading'}
            className="nh-grid-12 mt-6 grid nh-cols-1 nh-sm-cols-2 gap-4 nh-xl-cols-3"
          >
            {kpis.status === 'loading'
              ? Array.from(
                  {
                    length: 6,
                  },
                  (_, index) => (
                    <Card key={index} as="div" aria-hidden="true" className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-5 items-center">
                          <Skeleton className="h-3 w-32" />
                        </span>
                        <Skeleton className="size-9 rounded-xl" />
                      </div>
                      <div className="mt-3 flex h-9 items-center gap-3">
                        <Skeleton className="h-7 w-28 rounded-xl" />
                        <Skeleton className="h-3.5 w-14" />
                      </div>
                      <div className="mt-auto pt-4">
                        <Skeleton className="h-1.5 w-full" />
                        <span className="mt-2 flex h-4 items-center">
                          <Skeleton className="h-3 w-44" />
                        </span>
                      </div>
                    </Card>
                  ),
                )
              : kpis.data.map(([label, value, note], index) => {
                  const Icon = icons[index]
                  return (
                    <Card key={label} as="article" className="nh-fade-enter flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-caption font-medium text-muted">{m(label)}</h2>
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTones[index]}`}
                        >
                          <Icon size={17} aria-hidden="true" />
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <strong className="text-[1.75rem] font-bold leading-9 tracking-tight">
                          {value}
                        </strong>
                        {parseTrend(statNotes[note] ?? note).direction === 'up' ? (
                          <Trend value={statNotes[note]} variant="inline" />
                        ) : (
                          <span className="text-caption font-semibold text-brand-strong">
                            {statNotes[note] ?? note}
                          </span>
                        )}
                      </div>
                      <div className="mt-auto pt-4">
                        <p className="mt-2 text-xs text-muted">{m('source')}</p>
                      </div>
                    </Card>
                  )
                })}
          </section>
        )}

        <div className="nh-grid-12 mt-6 grid min-w-0 items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h2 className="text-h3">Tăng trưởng nền tảng và xu hướng hoạt động</h2>
                  <p className="mt-1 text-caption text-muted">
                    So sánh chỉ số tiếp nhận và người tham gia nền tảng
                  </p>
                </div>
                <Select
                  aria-label="Khoảng thời gian"
                  value={range}
                  onChange={event => setRange(event.target.value)}
                  className="shrink-0"
                >
                  <option value="30d">30 ngày gần nhất</option>
                  <option value="90d">90 ngày gần nhất</option>
                </Select>
              </div>
              <div className="mt-4 min-w-0">
                <Tabs
                  label="Chỉ số biểu đồ"
                  singleRow
                  value={metric}
                  onChange={setMetric}
                  items={[
                    {
                      value: 'signups',
                      label: 'Đăng ký người dùng',
                    },
                    {
                      value: 'stories',
                      label: 'Tiếp nhận truyện',
                    },
                    {
                      value: 'royalty',
                      label: 'Nhuận bút xu',
                    },
                  ]}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-caption text-ink/70">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
                  {firstSeries}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-orange" />
                  {secondSeries}
                </span>
              </div>
              {growth.status === 'error' ? (
                <LoadError
                  title="Không tải được biểu đồ tăng trưởng"
                  description="Dữ liệu xu hướng theo tuần chưa phản hồi."
                  onRetry={growth.retry}
                />
              ) : growth.status === 'empty' ? (
                <EmptyState
                  icon={Activity}
                  headingAs="h3"
                  title="Chưa đủ dữ liệu để vẽ xu hướng"
                  description={m('noGrowth')}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setRange('90d')}>
                      Xem 90 ngày gần nhất
                    </Button>
                  }
                />
              ) : growth.status === 'loading' ? (
                <div aria-busy="true" aria-label="Đang tải biểu đồ tăng trưởng">
                  <div
                    aria-hidden="true"
                    className="mt-4 flex h-56 items-end justify-around gap-3 border-b border-line px-2 sm:h-64 sm:gap-5 sm:px-4"
                  >
                    {[
                      ['h-[55%]', 'h-[35%]'],
                      ['h-[69%]', 'h-[46%]'],
                      ['h-[91%]', 'h-[66%]'],
                      ['h-[78%]', 'h-[52%]'],
                    ].map((heights, index) => (
                      <div
                        key={index}
                        className="flex h-full flex-1 items-end justify-center gap-2"
                      >
                        {heights.map(height => (
                          <Skeleton
                            key={height}
                            className={`w-1/3 max-w-12 rounded-xl ${height}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div aria-hidden="true" className="nh-grid-12 mt-3 grid nh-cols-4">
                    {[0, 1, 2, 3].map(index => (
                      <span key={index} className="flex h-4 items-center justify-center">
                        <Skeleton className="h-3 w-14" />
                      </span>
                    ))}
                  </div>
                  <div
                    aria-hidden="true"
                    className="nh-grid-12 mt-6 grid gap-4 rounded-3xl bg-elevated p-5 nh-sm-cols-3"
                  >
                    {[0, 1, 2].map(index => (
                      <div key={index}>
                        <span className="flex h-4 flex-col justify-center gap-2 sm:h-8">
                          <Skeleton className="h-3 w-3/4" />
                          <span className="hidden sm:block">
                            <Skeleton className="h-3 w-1/2" />
                          </span>
                        </span>
                        <Skeleton className="mt-1 h-7 w-24 rounded-xl" />
                        <span className="flex h-[1.1875rem] items-center">
                          <Skeleton className="h-3 w-28" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="nh-fade-enter">
                  <figure className="mt-4">
                    <div
                      aria-hidden="true"
                      className="flex h-56 items-end justify-around gap-3 border-b border-line px-2 sm:h-64 sm:gap-5 sm:px-4"
                    >
                      {growth.data.map(([readers, authors], index) => {
                        const [first, second] = seriesValues(metric, readers, authors)
                        const scale = range === '90d' ? 0.88 : 1
                        return (
                          <div
                            key={index}
                            className="flex h-full flex-1 items-end justify-center gap-2"
                          >
                            <Bar value={first * scale} className="bg-brand" />
                            <Bar value={second * scale} className="bg-orange" />
                          </div>
                        )
                      })}
                    </div>
                    <div className="nh-grid-12 mt-3 grid nh-cols-4 text-center text-xs text-muted">
                      {growth.data.map((_, index) =>
                        index === 2 ? (
                          <strong key={index} className="font-semibold text-ink">
                            Tuần 3 · cao nhất
                          </strong>
                        ) : (
                          <span key={index}>Tuần {index + 1}</span>
                        ),
                      )}
                    </div>
                    <figcaption className="sr-only">
                      {`${firstSeries} và ${secondSeries} theo tuần: `}
                      {growth.data
                        .map(([readers, authors], index) => {
                          const [first, second] = seriesValues(metric, readers, authors)
                          return `Tuần ${index + 1}: ${first} và ${second}`
                        })
                        .join('; ')}
                    </figcaption>
                  </figure>
                  <div className="nh-grid-12 mt-6 grid gap-4 rounded-3xl bg-elevated p-5 nh-sm-cols-3">
                    <Metric
                      label="Người dùng hoạt động hằng ngày"
                      value="—"
                      note={m('unavailable')}
                    />
                    <Metric label="Phiên đọc trung bình" value="—" note={m('unavailable')} />
                    <Metric label="Dòng lưu thông xu" value="—" note={m('unavailable')} />
                  </div>
                </div>
              )}
            </Card>

            <Reveal>
              <Card>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <h2 className="text-h3">Thao tác quản trị quan trọng gần đây</h2>
                    <p className="mt-1 text-caption text-muted">
                      Nhật ký kiểm tra bất biến theo thời gian phục vụ tuân thủ nền tảng
                    </p>
                  </div>
                  <ButtonLink
                    to="/admin/audit-logs"
                    variant="outline"
                    size="sm"
                    trailingIcon={ArrowRight}
                    className="shrink-0 self-start"
                  >
                    Xem toàn bộ nhật ký
                  </ButtonLink>
                </div>
                {actions.status === 'error' ? (
                  <LoadError
                    title="Không tải được thao tác quản trị"
                    description="Nhật ký kiểm tra chưa phản hồi. Các bản ghi vẫn được lưu bất biến."
                    onRetry={actions.retry}
                  />
                ) : actions.status === 'empty' ? (
                  <EmptyState
                    icon={ShieldAlert}
                    headingAs="h3"
                    title="Chưa có thao tác quản trị nào"
                    description="Các thao tác quan trọng sẽ xuất hiện tại đây ngay khi được ghi nhận."
                    action={
                      <ButtonLink to="/admin/audit-logs" variant="secondary" size="sm">
                        Mở nhật ký kiểm tra
                      </ButtonLink>
                    }
                  />
                ) : (
                  <div className="-mx-6 mt-5 overflow-x-auto px-6">
                    <table
                      aria-busy={actions.status === 'loading'}
                      className="w-full min-w-[680px] text-left text-sm"
                    >
                      <caption className="sr-only">Thao tác quản trị gần đây</caption>
                      <thead className="border-b border-line text-xs uppercase tracking-[.12em] text-muted">
                        <tr>
                          <th scope="col" className="whitespace-nowrap pb-3 pr-4 font-semibold">
                            Thời gian
                          </th>
                          <th scope="col" className="pb-3 pr-4 font-semibold">
                            Người vận hành / Chủ thể
                          </th>
                          <th scope="col" className="pb-3 pr-4 font-semibold">
                            Sự kiện hệ thống và phạm vi
                          </th>
                          <th scope="col" className="pb-3 pr-4 font-semibold">
                            Kết quả
                          </th>
                          <th scope="col" className="pb-3">
                            <span className="sr-only">Chi tiết</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y divide-hairline ${actions.status === 'loading' ? '' : 'nh-fade-enter'}`}
                      >
                        {actions.status === 'loading'
                          ? Array.from(
                              {
                                length: 4,
                              },
                              (_, index) => (
                                <tr key={index} aria-hidden="true">
                                  <td className="py-4 pr-4">
                                    <Skeleton className="h-3 w-24" />
                                  </td>
                                  <td className="py-4 pr-4">
                                    <Skeleton className="h-3.5 w-28" />
                                  </td>
                                  <td className="py-4 pr-4">
                                    <span className="flex h-[3.75rem] flex-col justify-center gap-2.5">
                                      <Skeleton className="h-3.5 w-48 max-w-full" />
                                      <Skeleton className="h-3.5 w-40 max-w-full" />
                                      <Skeleton className="h-3.5 w-24" />
                                    </span>
                                  </td>
                                  <td className="py-4 pr-4">
                                    <Skeleton className="h-6 w-24" />
                                  </td>
                                  <td className="py-4 text-right">
                                    <Skeleton className="ml-auto size-9" />
                                  </td>
                                </tr>
                              ),
                            )
                          : actions.data.map(entry => {
                              const [time, operator, event, status] = entry
                              return (
                                <tr key={`${time}:${operator}:${event}`}>
                                  <td className="py-4 pr-4 font-mono text-xs text-muted">{time}</td>
                                  <td className="whitespace-nowrap py-4 pr-4 font-semibold">
                                    {operator}
                                  </td>
                                  <td className="py-4 pr-4">{eventLabels[event] ?? event}</td>
                                  <td className="py-4 pr-4">
                                    <Badge tone={statusTone(status)} className="whitespace-nowrap">
                                      {statusLabels[status] ?? status}
                                    </Badge>
                                  </td>
                                  <td className="py-4 text-right">
                                    <IconButton
                                      label={`Chi tiết sự kiện lúc ${time}`}
                                      size="sm"
                                      shape="circle"
                                      onClick={() => setAuditEntry(entry)}
                                    >
                                      <MoreHorizontal size={16} />
                                    </IconButton>
                                  </td>
                                </tr>
                              )
                            })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </Reveal>
          </div>

          <aside className="min-w-0 space-y-6 xl:sticky xl:top-24">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <h2 className="text-h3">Tình trạng dịch vụ</h2>
                  <p className="mt-1 text-caption text-muted">
                    Ping và độ trễ vi dịch vụ theo thời gian thực
                  </p>
                </div>
                {services.status === 'loading' ? (
                  <Skeleton className="h-6 w-28" />
                ) : (
                  services.status === 'ready' && (
                    <Badge tone="green" className="nh-fade-enter whitespace-nowrap">
                      100% ổn định
                    </Badge>
                  )
                )}
              </div>
              {services.status === 'error' ? (
                <LoadError
                  title="Không tải được tình trạng dịch vụ"
                  description="Bộ giám sát chưa phản hồi."
                  onRetry={services.retry}
                  className="px-0 py-10"
                />
              ) : services.status === 'empty' ? (
                <EmptyState
                  icon={Gauge}
                  headingAs="h3"
                  title="Chưa có dịch vụ được giám sát"
                  description={m('noTelemetry')}
                  className="px-0 py-10"
                  action={
                    <ButtonLink to="/admin/settings" variant="secondary" size="sm">
                      Mở cài đặt dịch vụ
                    </ButtonLink>
                  }
                />
              ) : services.status === 'loading' ? (
                <ul
                  aria-busy="true"
                  aria-label="Đang tải tình trạng dịch vụ"
                  className="mt-5 space-y-2"
                >
                  {Array.from(
                    {
                      length: 5,
                    },
                    (_, index) => (
                      <li
                        key={index}
                        aria-hidden="true"
                        className="rounded-2xl border border-hairline bg-elevated px-4 py-3"
                      >
                        <div className="flex h-5 items-center justify-between gap-3">
                          <Skeleton className="h-3.5 w-36" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <div className="mt-1 flex h-4 items-center justify-between gap-3">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <ul className="nh-fade-enter mt-5 space-y-2">
                  {services.data.map(([name, stack, latency, uptime]) => (
                    <li
                      key={name}
                      className="rounded-2xl border border-hairline bg-elevated px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <strong className="min-w-0 text-sm font-semibold">{name}</strong>
                        <span className="inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-semibold text-brand-strong">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
                          {latency}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3 text-xs text-ink/70">
                        <span className="min-w-0 sm:truncate">{stack}</span>
                        <span className="shrink-0">{uptime}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="text-h3">Lưu trữ và dung lượng</h2>
              <Capacity label={m('database')} value="—" percent={null} />
              <Capacity
                label="Kho đối tượng media và âm thanh"
                value="—"
                percent={null}
                tone="orange"
              />
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-h3 text-rose-strong">
                <ShieldAlert size={20} aria-hidden="true" />
                Biện pháp bảo vệ nền tảng
              </h2>
              <p className="mt-1 text-caption text-muted">{m('safeguardsUnavailable')}</p>
              <div className="mt-4 space-y-2">
                <Toggle
                  label="Chế độ bảo trì"
                  note="Hiển thị màn hình bảo trì cho độc giả"
                  value={maintenance}
                  onToggle={() => requestToggle('Bật chế độ bảo trì', maintenance, setMaintenance)}
                />
                <Toggle
                  label="Khóa chỉ đọc"
                  note="Tạm dừng bản gửi mới của tác giả"
                  value={readOnly}
                  onToggle={() => requestToggle('Bật khóa chỉ đọc', readOnly, setReadOnly)}
                />
              </div>
              <Button
                variant="danger"
                disabled
                title={m('safeguardsUnavailable')}
                className="mt-4 w-full whitespace-normal"
              >
                Xóa bộ nhớ đệm CDN biên toàn cầu
              </Button>
            </Card>
          </aside>
        </div>

        <Modal
          open={Boolean(safeguard)}
          title="Xác nhận biện pháp bảo vệ nền tảng"
          onClose={() => setSafeguard(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-rose/10 p-4">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-rose-strong" />
            <p className="text-sm">
              <strong className="font-semibold">{safeguard?.label}</strong> sẽ chỉ được mô phỏng cục
              bộ. Không dịch vụ nền tảng nào bị thay đổi.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setSafeguard(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                safeguard.confirm()
                setSafeguard(null)
              }}
            >
              Xác nhận: {safeguard?.label}
            </Button>
          </div>
        </Modal>
        <Modal
          open={Boolean(auditEntry)}
          title="Chi tiết sự kiện kiểm tra"
          onClose={() => setAuditEntry(null)}
        >
          {auditEntry && (
            <dl className="divide-y divide-hairline text-sm">
              {[
                ['Thời gian', auditEntry[0]],
                ['Người vận hành', auditEntry[1]],
                ['Sự kiện', eventLabels[auditEntry[2]] ?? auditEntry[2]],
              ].map(([term, detail]) => (
                <div key={term} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                  <dt className="shrink-0 text-ink/70 sm:w-36">{term}</dt>
                  <dd className="font-semibold">{detail}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-ink/70 sm:w-36">Kết quả</dt>
                <dd>
                  <Badge tone={statusTone(auditEntry[3])}>
                    {statusLabels[auditEntry[3]] ?? auditEntry[3]}
                  </Badge>
                </dd>
              </div>
            </dl>
          )}
          <ButtonLink
            to="/admin/audit-logs"
            variant="secondary"
            trailingIcon={ArrowRight}
            className="mt-6 w-full"
          >
            Mở nhật ký kiểm tra
          </ButtonLink>
        </Modal>
      </div>
    </AdminLayout>
  )
}
function seriesValues(metric, readers, authors) {
  if (metric === 'stories') return [authors, readers]
  if (metric === 'royalty') return [Math.round((readers + authors) / 2), Math.max(18, authors - 8)]
  return [readers, authors]
}
function Bar({ value, className }) {
  return (
    <div className="flex h-full w-1/3 max-w-12 items-end">
      <div
        className={`h-full w-full origin-bottom rounded-t-xl transition-transform duration-700 ease-spring ${className}`}
        style={{
          transform: `scaleY(${Math.round(value) / 100})`,
        }}
      />
    </div>
  )
}
function Metric({ label, value, note }) {
  return (
    <div className="min-w-0">
      <span className="text-xs text-ink/70">{label}</span>
      <strong className="mt-1 block text-xl font-bold">{value}</strong>
      <span className="text-xs font-semibold text-brand-strong">{note}</span>
    </div>
  )
}
function Capacity({ label, value, percent, tone = 'brand' }) {
  const { t } = useLocale()
  return (
    <div className="mt-5">
      <div className="flex flex-wrap justify-between gap-x-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      {Number.isFinite(percent) && (
        <ProgressBar value={percent} tone={tone} label={label} className="mt-2" />
      )}
      <p className="mt-1.5 text-xs text-muted">{t('dashboardData.noCapacity')}</p>
    </div>
  )
}
function Toggle({ label, note, value, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      disabled
      aria-checked={value}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-elevated p-3 text-left transition-colors hover:border-line"
    >
      <span className="min-w-0 flex-1 whitespace-normal">
        <strong className="block text-sm font-semibold">{label}</strong>
        <span className="text-xs text-ink/70">{note}</span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${value ? 'bg-brand' : 'bg-ink/15'}`}
      >
        <span
          className={`size-4 rounded-full bg-surface shadow-whisper transition-transform duration-200 ease-spring ${value ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </span>
    </button>
  )
}
function LoadError({ title, description, onRetry, className }) {
  return (
    <EmptyState
      tone="rose"
      icon={AlertTriangle}
      headingAs="h3"
      title={title}
      description={description}
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw size={14} />
          Thử lại
        </Button>
      }
    />
  )
}
