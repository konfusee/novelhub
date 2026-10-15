import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCheck,
  Headphones,
  MessageCircle,
  RefreshCw,
  Settings,
  Trash2,
  UserRound,
  WalletCards,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { useNotifications } from '../../api/useNotifications';

const filters = [
  ['all', 'Tất cả', Bell],
  ['story', 'Cập nhật truyện', BookOpen],
  ['author', 'Tác giả', UserRound],
  ['comment', 'Bình luận & phản hồi', MessageCircle],
  ['system', 'Hệ thống & xu', WalletCards],
];

const typeStyles = {
  story: { tone: 'green', tile: 'bg-brand/12 text-brand-strong', icon: BookOpen },
  author: { tone: 'purple', tile: 'bg-purple/12 text-purple-strong', icon: UserRound },
  comment: { tone: 'green', tile: 'bg-brand/12 text-brand-strong', icon: MessageCircle },
  system: { tone: 'orange', tile: 'bg-orange/16 text-orange-strong', icon: WalletCards },
};

/* Notification card frame: icon tile, badge row, title, body, action footer (wraps on phones). */
function NotificationSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="p-4 sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <Skeleton className="size-11 shrink-0 rounded-2xl sm:size-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-16" />
            <span className="flex h-4 items-center max-sm:basis-full sm:ml-auto">
              <Skeleton className="h-3 w-14" />
            </span>
          </div>
          <span className="mt-2 flex flex-col justify-center gap-2 py-1 sm:h-7 sm:py-0">
            <Skeleton className="h-4 w-3/5 sm:h-5" />
            <Skeleton className="h-4 w-2/5 sm:hidden" />
          </span>
          <span className="mt-1 flex max-w-prose flex-col gap-3 py-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full sm:w-2/3" />
            <Skeleton className="h-3 w-1/2 sm:hidden" />
          </span>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-3">
            <Skeleton className="h-9 w-28" />
            <span className="ml-auto flex items-center justify-end gap-3 max-sm:basis-full">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="size-11 shrink-0" />
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function NotificationsPage() {
  const feed = useNotifications();
  const loading = feed.status === 'loading';
  const items = feed.data;
  const [filter, setFilter] = useState('all');
  const [settings, setSettings] = useState(false);
  const [removed, setRemoved] = useState(null);
  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.type === filter)),
    [filter, items],
  );
  const unreadCount = feed.unreadCount;
  const markAll = () => feed.write('/reader/notifications/read-all', 'POST', {});
  const setRead = (id, unread) =>
    feed.write(`/reader/notifications/${id}`, 'PUT', { read: !unread });
  const remove = async (item) => {
    if (await feed.write(`/reader/notifications/${item.id}`, 'DELETE')) setRemoved(item);
  };
  const undoRemove = async () => {
    if (removed && (await feed.write(`/reader/notifications/${removed.id}/restore`, 'POST', {})))
      setRemoved(null);
  };
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        {feed.actionError && (
          <p role="alert" className="mb-4 text-sm text-rose-strong">
            {feed.actionError}
          </p>
        )}
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-brand-strong">
              Trung tâm hoạt động · Bảng tin độc giả
            </p>
            <h1 className="mt-2 text-h2 sm:text-h1">Trung tâm thông báo</h1>
            <p className="mt-2 max-w-prose text-sm text-muted">
              Theo dõi chương mới, thảo luận cộng đồng và tác phẩm mới từ tác giả.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={markAll}
              disabled={!unreadCount || feed.busy}
            >
              <CheckCheck size={16} />
              Đánh dấu tất cả đã đọc
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={settings}
              aria-controls="notification-settings"
              onClick={() => setSettings(!settings)}
            >
              <Settings size={16} />
              Cài đặt
            </Button>
          </div>
        </div>
        {settings && (
          <Card
            id="notification-settings"
            className="nh-dialog-enter mt-4 flex flex-wrap items-center justify-between gap-3 bg-elevated p-5"
          >
            <div>
              <h2 className="text-sm font-semibold">Tùy chọn thông báo</h2>
              <p className="mt-1 text-xs text-ink/70">
                Thông báo trong ứng dụng được lưu theo tài khoản.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">Email: chưa cấu hình tùy chọn</Badge>
              <Badge tone="neutral">Thông báo đẩy: chưa cấu hình</Badge>
            </div>
          </Card>
        )}
        <div className="mt-5">
          <Tabs
            label="Lọc thông báo"
            value={filter}
            onChange={setFilter}
            items={filters.map(([value, label, Icon]) => ({
              value,
              icon: Icon,
              label:
                feed.status === 'ready'
                  ? `${label} (${value === 'all' ? items.length : items.filter((i) => i.type === value).length})`
                  : label,
            }))}
          />
        </div>
        {loading ? (
          <div
            aria-hidden="true"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3"
          >
            <span className="flex h-5 items-center gap-2">
              <Skeleton className="size-2" />
              <Skeleton className="h-3 w-56 max-w-[60vw]" />
            </span>
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          feed.status === 'ready' && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${unreadCount ? 'bg-brand' : 'bg-ink/25'}`}
                />
                {unreadCount
                  ? `Bạn có ${unreadCount} thông báo chưa đọc cần xem.`
                  : 'Bạn đã đọc hết thông báo.'}
              </span>
              {removed ? (
                <span className="flex items-center gap-2 text-xs text-muted">
                  Đã xóa một thông báo.
                  <button
                    type="button"
                    onClick={undoRemove}
                    disabled={feed.busy}
                    className="font-semibold text-brand-strong underline-offset-4 hover:underline"
                  >
                    Hoàn tác
                  </button>
                </span>
              ) : (
                <span className="text-xs text-muted">
                  Hiển thị {shown.length} / {items.length}
                </span>
              )}
            </div>
          )
        )}
        {loading ? (
          <section aria-busy="true" aria-label="Đang tải thông báo" className="mt-5 space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <NotificationSkeleton key={index} />
            ))}
          </section>
        ) : feed.status === 'error' ? (
          <Card className="mt-5 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được thông báo"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
              action={
                <Button variant="secondary" size="sm" onClick={feed.retry} disabled={feed.busy}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : (
          <section aria-label="Danh sách thông báo" className="nh-fade-enter mt-5 space-y-3">
            {shown.map((item) => {
              const style = typeStyles[item.type] || typeStyles.story;
              const Icon = /âm thanh/i.test(item.label) ? Headphones : style.icon;
              return (
                <Card
                  as="article"
                  key={item.id}
                  className={`p-4 sm:p-5 ${item.unread ? 'border-brand/45' : ''}`}
                >
                  <div className="flex gap-3 sm:gap-4">
                    <span
                      className={`relative grid size-11 shrink-0 place-items-center rounded-2xl sm:size-14 ${style.tile}`}
                    >
                      <Icon size={20} />
                      {item.unread && (
                        <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-surface bg-brand" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={style.tone}>{item.label}</Badge>
                        <span className="text-xs text-muted">{item.time}</span>
                        <span
                          className={`ml-auto text-xs ${item.unread ? 'font-semibold text-brand-strong' : 'text-muted'}`}
                        >
                          {item.unread ? 'Chưa đọc' : 'Đã đọc'}
                        </span>
                      </div>
                      <h2 className="mt-2 text-base font-semibold sm:text-h3">{item.title}</h2>
                      <p className="mt-1 max-w-prose text-sm leading-6 text-muted">{item.body}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-3">
                        <ButtonLink
                          to={item.href}
                          size="sm"
                          onClick={() => setRead(item.id, false)}
                        >
                          {item.action}
                        </ButtonLink>
                        <div className="ml-auto flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setRead(item.id, !item.unread)}
                            disabled={feed.busy}
                            className="min-h-9 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:text-ink pointer-coarse:min-h-11"
                          >
                            {item.unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                          </button>
                          <IconButton
                            label={`Xóa thông báo: ${item.title}`}
                            tone="rose"
                            shape="circle"
                            size="md"
                            onClick={() => remove(item)}
                            disabled={feed.busy}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
            {shown.length === 0 && (
              <Card className="p-0">
                <EmptyState
                  icon={Bell}
                  title={items.length ? 'Bạn đã xem hết thông báo' : 'Chưa có thông báo nào'}
                  description={
                    items.length
                      ? 'Không có thông báo trong nhóm này.'
                      : 'Theo dõi truyện và tác giả để nhận chương mới, phản hồi và tin từ cộng đồng.'
                  }
                  action={
                    filter !== 'all' ? (
                      <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                        Xem tất cả thông báo
                      </Button>
                    ) : (
                      !items.length && (
                        <ButtonLink to="/reader/following" variant="secondary" size="sm">
                          Quản lý theo dõi
                        </ButtonLink>
                      )
                    )
                  }
                />
              </Card>
            )}
          </section>
        )}
        <div className="mt-6 flex flex-col justify-between gap-3 border-t border-hairline pt-5 text-xs text-muted sm:flex-row sm:items-center">
          <span role="status" aria-busy={loading || undefined}>
            {loading && <Skeleton className="h-3 w-56" />}
            {feed.status === 'ready' &&
              (feed.hasMore
                ? `Đã tải ${items.length} thông báo, còn thông báo cũ hơn.`
                : `Đã tải toàn bộ ${items.length} thông báo`)}
          </span>
          <Button
            variant="secondary"
            disabled={!feed.hasMore || feed.busy || feed.status !== 'ready'}
            onClick={feed.loadMore}
          >
            Tải thông báo trước đó
          </Button>
        </div>
      </div>
    </ReaderLayout>
  );
}
