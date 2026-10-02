import { useMemo, useState } from 'react'
import {
  Bell,
  BookOpen,
  CheckCheck,
  MessageCircle,
  Settings,
  Trash2,
  UserRound,
  WalletCards,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { Badge, Button, Card } from '../../components/ui'
import { notifications as initialNotifications } from '../../data/mock/notifications'

const filters = [
  ['all', 'Tất cả', Bell],
  ['story', 'Cập nhật truyện', BookOpen],
  ['author', 'Tác giả', UserRound],
  ['comment', 'Bình luận & phản hồi', MessageCircle],
  ['system', 'Hệ thống & xu', WalletCards],
]

export function NotificationsPage() {
  const [items, setItems] = useState(initialNotifications)
  const [filter, setFilter] = useState('all')
  const [settings, setSettings] = useState(false)
  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter(item => item.type === filter)),
    [filter, items],
  )
  const markAll = () => setItems(current => current.map(item => ({ ...item, unread: false })))
  const toggleRead = id =>
    setItems(current =>
      current.map(item => (item.id === id ? { ...item, unread: !item.unread } : item)),
    )
  return (
    <ReaderLayout>
      <main className="page-reader py-7">
        <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-brand">
              Trung tâm hoạt động · Bảng tin độc giả
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Trung tâm thông báo</h1>
            <p className="mt-2 text-sm text-muted">
              Theo dõi chương mới, thảo luận cộng đồng và tác phẩm mới từ tác giả.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={markAll}>
              <CheckCheck size={16} />
              Đánh dấu tất cả đã đọc
            </Button>
            <Button variant="ghost" onClick={() => setSettings(!settings)}>
              <Settings size={16} />
              Cài đặt
            </Button>
          </div>
        </div>
        {settings && (
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-elevated">
            <div>
              <strong className="text-sm">Tùy chọn thông báo</strong>
              <p className="mt-1 text-xs text-muted">Đã bật thông báo truyện và tác giả.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Đã bật email</Badge>
              <Badge tone="green">Đã bật thông báo đẩy</Badge>
            </div>
          </Card>
        )}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {filters.map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${filter === value ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink'}`}
            >
              <Icon size={14} />
              {label} ({value === 'all' ? items.length : items.filter(i => i.type === value).length}
              )
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-xs">
          <span>
            <span className="mr-2 inline-block size-2 rounded-full bg-brand" />
            Bạn có {items.filter(i => i.unread).length} thông báo chưa đọc cần xem.
          </span>
          <span className="hidden text-muted sm:block">
            Hiển thị {shown.length} / {items.length}
          </span>
        </div>
        <section className="mt-5 space-y-3">
          {shown.map(item => (
            <Card
              key={item.id}
              className={`relative p-4 sm:p-5 ${item.unread ? 'border-brand/50' : ''}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={() => toggleRead(item.id)}
                  className="relative grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
                  style={{ backgroundColor: item.color }}
                >
                  NH
                  {item.unread && (
                    <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-surface bg-brand" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        item.type === 'system'
                          ? 'orange'
                          : item.type === 'author'
                            ? 'purple'
                            : 'green'
                      }
                    >
                      {item.label}
                    </Badge>
                    <span className="text-xs text-muted">{item.time}</span>
                    <span className="ml-auto text-[10px] text-muted">
                      {item.unread ? '● Chưa đọc' : 'Đã đọc'}
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-semibold sm:text-lg">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Button onClick={() => window.alert(`${item.action} opened (mock).`)} className="min-h-9 px-4 py-1.5 text-xs">{item.action}</Button>
                    <button onClick={() => toggleRead(item.id)} className="text-xs text-muted">
                      {item.unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                    </button>
                    <button
                      aria-label="Xóa thông báo"
                      onClick={() =>
                        setItems(current => current.filter(entry => entry.id !== item.id))
                      }
                      className="ml-auto p-2 text-muted hover:text-rose"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {shown.length === 0 && (
            <Card className="py-16 text-center">
              <Bell className="mx-auto text-muted" />
              <h2 className="mt-3 font-semibold">Bạn đã xem hết thông báo</h2>
              <p className="mt-1 text-sm text-muted">Không có thông báo trong nhóm này.</p>
            </Card>
          )}
        </section>
        <div className="mt-6 flex flex-col justify-between gap-3 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center">
          <span>Hiển thị {shown.length} thông báo trong 30 ngày qua</span>
          <Button onClick={() => window.alert('Đã tải các thông báo trước đó (mô phỏng).')} variant="secondary">Tải thông báo trước đó</Button>
        </div>
      </main>
    </ReaderLayout>
  )
}
