import { useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Cloud,
  Database,
  Download,
  FileSearch,
  Headphones,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from '../../components/icons';
import { AdminLayout } from '../../layouts';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  ProgressBar,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui';

const services = [
  [
    'TTS Neural Engine',
    'ElevenLabs & Custom WaveNet v3.4',
    '99.98%',
    '180ms',
    Headphones,
    'Configure Voices',
  ],
  ['AI Writing Co-Pilot', 'NovelCraft Engine 4.2 Pro', '99.92%', '820 RPM', Bot, 'Adjust Quota'],
  [
    'Storage & CDN Mesh',
    'AWS S3 + Cloudflare Enterprise',
    '100%',
    '14.8 TB',
    Cloud,
    'Purge Edge Cache',
  ],
  [
    'PostgreSQL Cluster',
    'Aurora Multi-AZ · Read Replicas',
    '99.99%',
    '28ms',
    Database,
    'Manage Backups',
  ],
];
const logs = [
  [
    '2026-10-24 16:12:04',
    'Marcus Vance',
    'service.update',
    'TTS Engine endpoint',
    'Medium',
    'ElevenLabs Voice Cluster',
  ],
  [
    '2026-10-24 15:40:22',
    'System Worker #02',
    'backup.snapshot',
    'Full PostgreSQL db',
    'Low',
    'RDS Aurora Cluster',
  ],
  [
    '2026-10-24 14:15:10',
    'Sarah Jenkins',
    'story.publish_approval',
    'Editorial queue',
    'Low',
    'Story #MS-88402',
  ],
  [
    '2026-10-24 11:02:45',
    'SecOps Daemon',
    'security.ip_block',
    'Edge perimeter firewall',
    'High',
    'IP Range 185.22.0.101/24',
  ],
  [
    '2026-10-24 09:18:30',
    'Marcus Vance',
    'rbac.permission_grant',
    'Staff capability update',
    'Critical',
    'Role: Moderator',
  ],
];
const sections = [
  'Platform Settings',
  'External Services & APIs',
  'TTS & Audio Narration',
  'AI Models & Orchestrator',
  'Storage & Media Mesh',
  'Audit Logs',
];
const sectionLabels = {
  'Platform Settings': 'Cài đặt nền tảng',
  'External Services & APIs': 'Dịch vụ ngoài và API',
  'TTS & Audio Narration': 'TTS và thuyết minh âm thanh',
  'AI Models & Orchestrator': 'Mô hình AI và bộ điều phối',
  'Storage & Media Mesh': 'Lưu trữ và mạng media',
  'Audit Logs': 'Nhật ký kiểm tra',
};
const actionLabels = {
  'Configure Voices': 'Cấu hình giọng đọc',
  'Adjust Quota': 'Điều chỉnh hạn mức',
  'Purge Edge Cache': 'Xóa bộ nhớ đệm biên',
  'Manage Backups': 'Quản lý bản sao lưu',
};
const impactLabels = { Low: 'Thấp', Medium: 'Trung bình', High: 'Cao', Critical: 'Nghiêm trọng' };
const serviceLabels = {
  'TTS Neural Engine': 'Bộ máy TTS thần kinh',
  'AI Writing Co-Pilot': 'Trợ lý viết AI',
  'Storage & CDN Mesh': 'Mạng lưu trữ và CDN',
  'PostgreSQL Cluster': 'Cụm PostgreSQL',
};
const logDetailLabels = {
  'TTS Engine endpoint': 'Điểm cuối bộ máy TTS',
  'Full PostgreSQL db': 'Toàn bộ cơ sở dữ liệu PostgreSQL',
  'Editorial queue': 'Hàng đợi biên tập',
  'Edge perimeter firewall': 'Tường lửa biên ngoài',
  'Staff capability update': 'Cập nhật quyền nhân viên',
  'Role: Moderator': 'Vai trò: Kiểm duyệt viên',
};

const thresholds = ['Từ chương 3', 'Từ chương 4 cần xu để mở khóa', 'Từ chương 6'];
const initialSettings = {
  siteName: 'NovelHub',
  tagline: 'Những câu chuyện cho ngày mai tươi sáng hơn.',
  theme: 'light',
  threshold: thresholds[1],
  coinRate: '100 xu = 0,99 USD',
  revenueSplit: '70% tác giả / 20% âm thanh / 10% nền tảng',
  pdfLimit: '50 MB',
};
const serviceSections = {
  'TTS & Audio Narration': 'TTS Neural Engine',
  'AI Models & Orchestrator': 'AI Writing Co-Pilot',
  'Storage & Media Mesh': 'Storage & CDN Mesh',
};

export function PlatformSettingsPage() {
  const integrations = useMockResource('admin:integrations', services);
  const config = useMockResource('admin:platform-settings', initialSettings);
  const auditStream = useMockResource('admin:audit-stream', logs);
  const [section, setSection] = useState('External Services & APIs');
  const [maintenance, setMaintenance] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState('All');
  const [modal, setModal] = useState('');
  /* Local saves and unsaved edits layered over the loaded settings; null = use what loaded. */
  const [savedOverride, setSavedOverride] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const savedSettings = savedOverride ?? config.data;
  const settings = draft ?? savedSettings;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return auditStream.data.filter(
      (row) =>
        (actor === 'All' || row[1] === actor) && row.join(' ').toLowerCase().includes(needle),
    );
  }, [auditStream.data, query, actor]);
  const visibleServices = integrations.data.filter(
    (service) => section === 'External Services & APIs' || serviceSections[section] === service[0],
  );
  const dirty = Object.keys(settings).some((key) => settings[key] !== savedSettings[key]);
  const update = (key, value) => {
    setDraft((current) => ({ ...(current ?? savedSettings), [key]: value }));
    setSavedNotice(false);
  };
  const isServiceSection = section !== 'Platform Settings' && section !== 'Audit Logs';

  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-ink/70">
              Bảng điều khiển quản trị / Vận hành nền tảng / Dịch vụ và cài đặt hệ thống
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Cài đặt nền tảng, dịch vụ ngoài và kiểm tra</h1>
            <p className="mt-2 flex items-start gap-2 text-caption font-medium text-brand-strong">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
              Môi trường thật · Cụm US-East · Kho khóa đang hoạt động
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setModal('Đã xuất luồng kiểm tra (bản mẫu).')}
            >
              <Download size={16} />
              Xuất luồng kiểm tra
            </Button>
            <Button
              variant={maintenance ? 'accent' : 'secondary'}
              aria-pressed={maintenance}
              onClick={() => (maintenance ? setMaintenance(false) : setConfirmMaintenance(true))}
            >
              <ShieldAlert size={16} />
              Chế độ bảo trì {maintenance ? 'BẬT' : 'TẮT'}
            </Button>
          </div>
        </header>

        <div className="mt-6 min-w-0">
          <Tabs
            label="Nhóm cài đặt"
            singleRow
            value={section}
            onChange={setSection}
            items={sections.map((value) => ({ value, label: sectionLabels[value] }))}
          />
        </div>

        {isServiceSection && (
          <section className="mt-6" aria-labelledby="services-title">
            <h2 id="services-title" className="text-h3 md:text-h2">
              {section === 'External Services & APIs'
                ? 'Dịch vụ ngoài và cổng hạ tầng'
                : sectionLabels[section]}
            </h2>
            <p className="mt-1 text-caption text-ink/70">
              Trạng thái vận hành, dữ liệu mạng dịch vụ và thông tin xác thực cổng.
            </p>
            {integrations.status === 'error' ? (
              <Card className="mt-4 p-0">
                <LoadError
                  title="Không tải được trạng thái dịch vụ"
                  description="Cổng hạ tầng chưa phản hồi. Dịch vụ vẫn chạy với cấu hình hiện hành."
                  onRetry={integrations.retry}
                />
              </Card>
            ) : integrations.status === 'empty' ? (
              <Card className="mt-4 p-0">
                <EmptyState
                  icon={Cloud}
                  headingAs="h3"
                  title="Chưa kết nối dịch vụ ngoài nào"
                  description="Kết nối TTS, AI và lưu trữ sẽ hiển thị tại đây. Kiểm tra nhật ký để xem lần thay đổi gần nhất."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setSection('Audit Logs')}>
                      <FileSearch size={14} />
                      Mở nhật ký kiểm tra
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div
                aria-busy={integrations.status === 'loading'}
                aria-label={integrations.status === 'loading' ? 'Đang tải dịch vụ' : undefined}
                className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2 nh-2xl-cols-4"
              >
                {integrations.status === 'loading'
                  ? Array.from(
                      { length: section === 'External Services & APIs' ? services.length : 1 },
                      (_, index) => <ServiceCardSkeleton key={index} />,
                    )
                  : visibleServices.map((service) => (
                      <ServiceCard
                        key={service[0]}
                        service={service}
                        onAction={() => setModal(actionLabels[service[5]] ?? service[5])}
                      />
                    ))}
              </div>
            )}
          </section>
        )}

        {section === 'Platform Settings' && (
          <>
            <Card
              as="form"
              className="mt-6"
              aria-busy={config.status === 'loading'}
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand-strong">
                  <SlidersHorizontal size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-h3">Tham số cấu hình chung của nền tảng</h2>
                  <p className="mt-1 text-caption text-muted">
                    Nhận diện nền tảng, mặc định cho độc giả, tỷ lệ doanh thu và giới hạn tài
                    nguyên.
                  </p>
                </div>
              </div>
              {config.status === 'loading' ? (
                <SettingsFormSkeleton />
              ) : config.status === 'error' ? (
                <LoadError
                  title="Không tải được cấu hình đã lưu"
                  description="Kho cấu hình chưa phản hồi. Nền tảng vẫn dùng giá trị đang hiệu lực."
                  onRetry={config.retry}
                />
              ) : config.status === 'empty' ? (
                <EmptyState
                  icon={SlidersHorizontal}
                  headingAs="h3"
                  title="Chưa có cấu hình đã lưu"
                  description="Nền tảng đang chạy với giá trị mặc định. Xem nhật ký kiểm tra để biết lần thay đổi gần nhất."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setSection('Audit Logs')}>
                      <FileSearch size={14} />
                      Mở nhật ký kiểm tra
                    </Button>
                  }
                />
              ) : (
                <div className="nh-fade-enter">
                  <SettingsGroup title="Nhận diện nền tảng">
                    <Field
                      label="Tên trang"
                      value={settings.siteName}
                      onChange={(value) => update('siteName', value)}
                    />
                    <Field
                      label="Khẩu hiệu nền tảng"
                      value={settings.tagline}
                      onChange={(value) => update('tagline', value)}
                    />
                  </SettingsGroup>

                  <SettingsGroup
                    title="Mặc định cho độc giả"
                    after={
                      <fieldset className="mt-5">
                        <legend className="text-sm font-semibold">
                          Ngưỡng khóa chương mặc định
                        </legend>
                        <div className="nh-grid-12 mt-2 grid gap-3 nh-sm-cols-3">
                          {thresholds.map((item) => {
                            const checked = settings.threshold === item;
                            return (
                              <label
                                key={item}
                                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors ${checked ? 'border-brand bg-brand/8 font-semibold' : 'border-line hover:border-brand/40'}`}
                              >
                                <input
                                  type="radio"
                                  name="threshold"
                                  className="size-4 shrink-0 accent-brand"
                                  checked={checked}
                                  onChange={() => update('threshold', item)}
                                />
                                {item}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    }
                  >
                    <SelectField
                      label="Giao diện mặc định của độc giả"
                      value={settings.theme}
                      onChange={(value) => update('theme', value)}
                    />
                  </SettingsGroup>

                  <SettingsGroup title="Doanh thu và giới hạn tài nguyên">
                    <Field
                      label="Tỷ lệ quy đổi xu sang USD"
                      value={settings.coinRate}
                      onChange={(value) => update('coinRate', value)}
                    />
                    <Field
                      label="Tỷ lệ phân chia doanh thu tác giả"
                      value={settings.revenueSplit}
                      onChange={(value) => update('revenueSplit', value)}
                    />
                    <Field
                      label="Dung lượng PDF tải lên tối đa"
                      value={settings.pdfLimit}
                      onChange={(value) => update('pdfLimit', value)}
                    />
                  </SettingsGroup>
                  {savedNotice && (
                    <p
                      role="status"
                      className="mt-6 rounded-2xl bg-brand/10 p-3 text-sm text-brand-strong"
                    >
                      Đã lưu cấu hình nền tảng (bản mẫu).
                    </p>
                  )}
                </div>
              )}
            </Card>
            {dirty && (
              <Card className="nh-dialog-enter mt-4 flex flex-col gap-4 border-orange/40 p-5 sm:flex-row sm:items-center">
                <p role="status" className="min-w-0 flex-1 text-sm font-semibold">
                  Bạn có thay đổi cấu hình chưa lưu.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setDraft(null)}>
                    <RotateCcw size={16} />
                    Hủy thay đổi
                  </Button>
                  <Button
                    onClick={() => {
                      setSavedOverride(settings);
                      setDraft(null);
                      setSavedNotice(true);
                    }}
                  >
                    <Save size={16} />
                    Lưu cấu hình
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {section === 'Audit Logs' && (
          <Card className="mt-6 overflow-hidden p-0">
            <div className="p-5">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-h3">
                    <ShieldCheck size={20} aria-hidden="true" className="shrink-0 text-brand" />
                    Luồng nhật ký kiểm tra hệ thống bất biến
                  </h2>
                  <p className="mt-1 text-caption text-muted">
                    Bản ghi chỉ ghi một lần, được xác minh bằng mật mã về thao tác và thay đổi phân
                    quyền.
                  </p>
                </div>
                <Badge tone="green" className="self-start whitespace-nowrap">
                  Đã xác minh lưu trữ WORM
                </Badge>
              </div>
              <div className="nh-grid-12 mt-5 grid gap-3 nh-layout-lg-8-4">
                <Input
                  icon={Search}
                  type="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Tìm trong nhật ký kiểm tra"
                  placeholder="Mã sự kiện, chủ thể hoặc IP…"
                />
                <Select
                  aria-label="Lọc theo chủ thể"
                  value={actor}
                  onChange={(event) => setActor(event.target.value)}
                >
                  <option value="All">Tất cả chủ thể</option>
                  {[...new Set(auditStream.data.map((row) => row[1]))].map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </Select>
              </div>
            </div>
            {auditStream.status === 'error' ? (
              <div className="border-t border-hairline">
                <LoadError
                  title="Không tải được nhật ký kiểm tra"
                  description="Kho lưu trữ WORM chưa phản hồi. Bản ghi không bị mất."
                  onRetry={auditStream.retry}
                />
              </div>
            ) : auditStream.status === 'empty' ? (
              <EmptyState
                icon={FileSearch}
                headingAs="h3"
                title="Luồng kiểm tra chưa có bản ghi"
                description="Thao tác quản trị và thay đổi phân quyền sẽ được ghi tại đây."
                className="border-t border-hairline"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setModal('Đã làm mới luồng kiểm tra.')}
                  >
                    <RefreshCw size={14} />
                    Làm mới luồng
                  </Button>
                }
              />
            ) : auditStream.status === 'loading' || filtered.length ? (
              <div className="overflow-x-auto">
                <table
                  aria-busy={auditStream.status === 'loading'}
                  className="w-full min-w-[860px] text-left text-sm"
                >
                  <caption className="sr-only">
                    {auditStream.status === 'loading'
                      ? 'Đang tải nhật ký kiểm tra hệ thống'
                      : 'Nhật ký kiểm tra hệ thống'}
                  </caption>
                  <thead className="border-y border-hairline bg-elevated text-[11px] uppercase tracking-[.12em] text-ink/70">
                    <tr>
                      {[
                        'Thời gian UTC',
                        'Chủ thể và mã',
                        'Thao tác và tài nguyên',
                        'Mức tác động',
                        'Đối tượng / Thực thể',
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-4 py-3 font-semibold first:pl-5 last:pr-5"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y divide-hairline ${auditStream.status === 'loading' ? '' : 'nh-fade-enter'}`}
                  >
                    {auditStream.status === 'loading' &&
                      Array.from({ length: 5 }, (_, index) => <LogRowSkeleton key={index} />)}
                    {auditStream.status === 'ready' &&
                      filtered.map((row) => (
                        <tr key={row[0]}>
                          <td className="whitespace-nowrap px-4 py-4 pl-5 font-mono text-xs text-muted">
                            {row[0]}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold">{row[1]}</td>
                          <td className="px-4 py-4">
                            <code className="rounded-full bg-brand/10 px-2.5 py-1 text-xs text-brand-strong">
                              {row[2]}
                            </code>
                            <small className="mt-1.5 block text-xs text-muted">
                              {logDetailLabels[row[3]] ?? row[3]}
                            </small>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              tone={
                                row[4] === 'Critical'
                                  ? 'red'
                                  : row[4] === 'High' || row[4] === 'Medium'
                                    ? 'orange'
                                    : 'blue'
                              }
                            >
                              {impactLabels[row[4]] ?? row[4]}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 pr-5">{logDetailLabels[row[5]] ?? row[5]}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={FileSearch}
                title="Không có bản ghi nào khớp bộ lọc"
                description="Thử từ khóa khác hoặc chọn Tất cả chủ thể."
                className="border-t border-hairline"
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery('');
                      setActor('All');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                }
              />
            )}
            <div className="flex flex-col justify-between gap-3 border-t border-hairline px-5 py-4 text-caption text-muted sm:flex-row sm:items-center">
              <span>Được ký bằng mật mã và sao chép trên các kho lưu trữ chỉ ghi một lần.</span>
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto"
                onClick={() => setModal('Đã làm mới luồng kiểm tra.')}
              >
                <RefreshCw size={15} />
                Làm mới luồng
              </Button>
            </div>
          </Card>
        )}

        <Modal open={Boolean(modal)} title="Thao tác nền tảng" onClose={() => setModal('')}>
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <KeyRound size={20} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-sm">{modal} Thao tác được bảo vệ này chỉ được mô phỏng cục bộ.</p>
          </div>
          <Button onClick={() => setModal('')} className="mt-6 w-full">
            Xác nhận thao tác mẫu
          </Button>
        </Modal>
        <Modal
          open={confirmMaintenance}
          title="Bật chế độ bảo trì"
          onClose={() => setConfirmMaintenance(false)}
        >
          <div className="flex gap-3 rounded-2xl bg-rose/10 p-4">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-rose-strong" />
            <p className="text-sm">
              Toàn bộ độc giả và tác giả của <strong className="font-semibold">NovelHub</strong> sẽ
              thấy màn hình bảo trì cho đến khi bạn tắt chế độ này. Thao tác chỉ được mô phỏng cục
              bộ.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmMaintenance(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setMaintenance(true);
                setConfirmMaintenance(false);
              }}
            >
              Bật chế độ bảo trì
            </Button>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}

function ServiceCard({ service, onAction }) {
  const [name, provider, uptime, metric, Icon, action] = service;
  const label = serviceLabels[name] ?? name;
  return (
    <Card as="article" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand-strong">
          <Icon size={19} aria-hidden="true" />
        </span>
        <Badge tone="green" className="whitespace-nowrap">
          Hoạt động {uptime}
        </Badge>
      </div>
      <h3 className="mt-5 text-base font-semibold">{label}</h3>
      <p className="mt-0.5 text-xs text-muted">{provider}</p>
      <div className="mb-4 mt-4 rounded-2xl bg-elevated p-3">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-ink/70">Chỉ số vận hành</span>
          <strong className="font-semibold">{metric}</strong>
        </div>
        <ProgressBar
          value={Number.parseFloat(uptime)}
          size="sm"
          label={`Thời gian hoạt động của ${label}`}
          className="mt-2"
        />
      </div>
      <Button variant="secondary" onClick={onAction} className="mt-auto w-full">
        {actionLabels[action] ?? action}
      </Button>
    </Card>
  );
}
function SettingsGroup({ title, after, children }) {
  return (
    <fieldset className="mt-6 border-t border-hairline pt-6">
      <legend className="sr-only">{title}</legend>
      <h3 aria-hidden="true" className="text-base font-semibold">
        {title}
      </h3>
      <div className="nh-grid-12 mt-4 grid gap-5 nh-lg-cols-2">{children}</div>
      {after}
    </fieldset>
  );
}
function Field({ label, value, onChange }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
      />
    </div>
  );
}
function SelectField({ label, value, onChange }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full"
      >
        <option value="light">Giao diện sáng (Giấy da)</option>
        <option value="dark">Giao diện tối (Nửa đêm)</option>
        <option value="system">Theo hệ thống</option>
      </Select>
    </div>
  );
}

/* ServiceCard geometry: icon + uptime badge, name, provider, metric well, full-width action. */
function ServiceCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="size-10 shrink-0 rounded-2xl" />
        <Skeleton className="h-6 w-28" />
      </div>
      <span className="mt-5 flex h-6 items-center">
        <Skeleton className="h-4 w-36" />
      </span>
      <span className="mt-0.5 flex h-4 items-center">
        <Skeleton className="h-3 w-44 max-w-full" />
      </span>
      <div className="mb-4 mt-4 rounded-2xl bg-elevated p-3">
        <div className="flex h-4 items-center justify-between gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="mt-2 h-1.5 w-full" />
      </div>
      <Skeleton className="mt-auto h-11 w-full" />
    </Card>
  );
}

/* The three settings groups with labelled 44px fields and the three threshold options. */
function SettingsFormSkeleton() {
  const group = (fields, after) => (
    <div className="mt-6 border-t border-hairline pt-6">
      <span className="flex h-6 items-center">
        <Skeleton className="h-4 w-40" />
      </span>
      <div className="nh-grid-12 mt-4 grid gap-5 nh-lg-cols-2">
        {fields.map((width) => (
          <div key={width}>
            <span className="flex h-[1.625rem] items-center">
              <Skeleton className={`h-3.5 ${width}`} />
            </span>
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        ))}
      </div>
      {after}
    </div>
  );
  return (
    <div aria-hidden="true">
      {group(['w-20', 'w-32'])}
      {group(
        ['w-52'],
        <div className="mt-5">
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-48" />
          </span>
          <div className="nh-grid-12 mt-2 grid gap-3 nh-sm-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-12 w-full rounded-2xl" />
            ))}
          </div>
        </div>,
      )}
      {group(['w-44', 'w-52', 'w-48'])}
    </div>
  );
}

/* Audit row: timestamp, actor, code pill over a detail line, impact badge, target. */
function LogRowSkeleton() {
  return (
    <tr aria-hidden="true">
      <td className="px-4 py-4 pl-5">
        <Skeleton className="h-3 w-32" />
      </td>
      <td className="px-4 py-4">
        <Skeleton className="h-3.5 w-28" />
      </td>
      <td className="px-4 py-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2.5 h-3 w-44" />
      </td>
      <td className="px-4 py-4">
        <Skeleton className="h-6 w-20" />
      </td>
      <td className="px-4 py-4 pr-5">
        <Skeleton className="h-3.5 w-32" />
      </td>
    </tr>
  );
}

function LoadError({ title, description, onRetry }) {
  return (
    <EmptyState
      tone="rose"
      icon={AlertTriangle}
      headingAs="h3"
      title={title}
      description={description}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw size={14} />
          Thử lại
        </Button>
      }
    />
  );
}
