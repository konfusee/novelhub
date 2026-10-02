import { useMemo, useState } from 'react'
import { NovelHubMark, ExternalLink, Moon, Search, Sun } from '../../components/icons'
import { Link } from 'react-router-dom'
import { pageRegistry, pageRoles, pageStatuses } from '../../data/pageRegistry'
import { useTheme } from '../../context/ThemeContext'
import { Badge, Button, Card, Input, PageContainer, Select } from '../../components/ui'
import { StoryCover } from '../../components/story/StoryCover'
import { stories } from '../../data/mock/stories'
import { IconGallery } from '../../components/icons/IconGallery'
const statusTone = { TODO: 'neutral', IN_PROGRESS: 'orange', DONE: 'green', BLOCKED: 'red' }
const workflows = [
  ['Đăng ký làm tác giả', '/author/apply'],
  ['Thỏa thuận doanh thu', '/admin/users/user-author'],
  ['403 Không có quyền', '/403'],
  ['404 Không tìm thấy', '/route-not-found'],
]
const statusLabels = { TODO: 'Cần làm', IN_PROGRESS: 'Đang thực hiện', DONE: 'Hoàn tất', BLOCKED: 'Bị chặn' }
export function UIPreviewPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const completed = pageRegistry.filter(p => p.status === 'DONE').length
  const visible = useMemo(
    () =>
      pageRegistry.filter(
        p =>
          (filter === 'All' || p.role === filter || p.status === filter) &&
          `${p.id} ${p.name} ${p.role}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  )
  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white">
              <NovelHubMark size={24} />
            </span>
            <div>
              <p className="font-bold tracking-tight">NovelHub</p>
              <h1 className="text-sm text-muted">Xem trước giao diện · 36 màn hình</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              Công cụ phát triển / Trình bày
            </span>
            <Button
              variant="secondary"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{' '}
              {resolvedTheme === 'dark' ? 'Sáng' : 'Tối'}
            </Button>
          </div>
        </div>
      </header>
      <PageContainer>
        <section className="mb-8 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-brand">
              Tiến độ frontend
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {completed} / {pageRegistry.length} màn hình đã hoàn tất
            </h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(completed / pageRegistry.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="nh-grid-12 grid nh-cols-2 gap-2 nh-sm-cols-3">
            {pageRoles.map(role => {
              const pages = pageRegistry.filter(p => p.role === role)
              return (
                <div
                  className="rounded-2xl border border-line bg-surface p-3 text-center"
                  key={role}
                >
                  <strong className="block text-sm">
                    {pages.filter(p => p.status === 'DONE').length}/{pages.length}
                  </strong>
                  <span className="block max-w-24 truncate text-[10px] text-muted">{role}</span>
                </div>
              )
            })}
          </div>
        </section>
        <section className="mb-7 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 md:flex-row">
          <Input
            icon={Search}
            placeholder="Tìm màn hình..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1"
          />
          <Select
            aria-label="Lọc màn hình"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="All">Tất cả</option>
            <optgroup label="Vai trò">
              {pageRoles.map(role => (
                <option key={role}>{role}</option>
              ))}
            </optgroup>
            <optgroup label="Trạng thái">
              {pageStatuses.map(status => (
                <option key={status}>{status}</option>
              ))}
            </optgroup>
          </Select>
        </section>
        <div className="nh-grid-12 grid gap-4 nh-sm-cols-2 nh-lg-cols-3 nh-xl-cols-4">
          {visible.map(page => {
            const available = page.status !== 'TODO'
            return (
              <Card key={page.id} className="flex min-h-56 flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand">{page.id}</span>
                  <Badge tone={statusTone[page.status]}>{statusLabels[page.status]}</Badge>
                </div>
                <h3 className="mt-5 text-lg font-semibold leading-snug">{page.name}</h3>
                <p className="mt-2 text-sm text-muted">{page.role}</p>
                <code className="mt-3 truncate text-xs text-muted">{page.route}</code>
                <div className="mt-auto flex gap-2 pt-5">
                  {available ? (
                    <>
                      <Link
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-brand bg-brand px-3 py-2.5 text-sm font-semibold text-white"
                        to={page.route}
                      >
                        Mở trang
                      </Link>
                      <Link
                        className="inline-grid size-11 place-items-center rounded-2xl border border-line bg-surface"
                        to={page.previewRoute}
                        aria-label={`Xem trước ${page.name}`}
                      >
                        <ExternalLink size={17} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <Button className="flex-1 px-3" disabled>
                        Mở trang
                      </Button>
                      <Button
                        variant="secondary"
                        className="px-3"
                        disabled
                        aria-label={`Xem trước ${page.name}`}
                      >
                        <ExternalLink size={17} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
        {!visible.length && (
          <div className="py-20 text-center text-muted">Không có màn hình nào khớp tìm kiếm.</div>
        )}
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-2xl font-semibold">Quy trình bổ sung</h2>
          <p className="mt-1 text-sm text-muted">
            Các hành trình hỗ trợ nằm ngoài danh mục đánh số P01–P36.
          </p>
          <div className="nh-grid-12 mt-5 grid gap-3 nh-sm-cols-2 nh-lg-cols-4">
            {workflows.map(([label, route]) => (
              <Link
                key={label}
                to={route}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 text-sm font-semibold hover:border-brand"
              >
                {label}
                <ExternalLink size={16} className="text-brand" />
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-2xl font-semibold">Tài nguyên hình ảnh</h2>
          <p className="mt-1 text-sm text-muted">
            Ảnh gốc tỷ lệ 2:3 không chứa chữ, tiêu đề dựng bằng HTML và có phương án dự phòng.
          </p>
          <div className="nh-grid-12 mt-5 grid nh-cols-2 gap-4 nh-sm-cols-3 lg:max-w-3xl">
            {stories.slice(0, 3).map(story => (
              <article key={story.id} className="group min-w-0">
                <StoryCover story={story} className="aspect-[2/3] rounded-2xl border border-line" />
                <h3 className="mt-2 truncate text-sm font-semibold">{story.title}</h3>
                <p className="text-xs text-muted">Ảnh minh họa AI · WebP</p>
              </article>
            ))}
          </div>
        </section>
        <IconGallery />
      </PageContainer>
    </div>
  )
}
