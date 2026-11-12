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
  Skeleton,
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
  const [exported, setExported] = useState(false)
  const [auditEntry, setAuditEntry] = useState(null)
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
            <ButtonLink to="/admin/payouts" variant="secondary">
              {t('adminAuthorStats.financeReport')}
            </ButtonLink>
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
              <h2 className="text-h3">Lưu trữ và dung lượng</h2>
              <Capacity label={m('database')} value="—" percent={null} />
              <Capacity
                label="Kho đối tượng media và âm thanh"
                value="—"
                percent={null}
                tone="orange"
              />
            </Card>
          </aside>
        </div>

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
