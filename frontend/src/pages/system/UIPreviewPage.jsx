import { useMemo, useState } from 'react';
import {
  ArrowRight,
  NovelHubMark,
  ExternalLink,
  FileSearch,
  Moon,
  Search,
  Sun,
} from '../../components/icons';
import { Link } from 'react-router';
import { pageRegistry, pageRoles, pageStatuses } from '../../data/pageRegistry';
import { useTheme } from '../../context/ThemeContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageContainer,
  ProgressBar,
  Select,
} from '../../components/ui';
import { StoryCover } from '../../components/story/StoryCover';
import { stories } from '../../data/mock/stories';
import { IconGallery } from '../../components/icons/IconGallery';

const statusTone = { TODO: 'neutral', IN_PROGRESS: 'orange', DONE: 'green', BLOCKED: 'red' };
const workflows = [
  ['Đăng ký làm tác giả', '/author/apply'],
  ['Thỏa thuận doanh thu', '/admin/users/user-author'],
  ['403 Không có quyền', '/403'],
  ['404 Không tìm thấy', '/route-not-found'],
];
const statusLabels = {
  TODO: 'Cần làm',
  IN_PROGRESS: 'Đang thực hiện',
  DONE: 'Hoàn tất',
  BLOCKED: 'Bị chặn',
};

export function UIPreviewPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const completed = pageRegistry.filter((p) => p.status === 'DONE').length;
  const visible = useMemo(
    () =>
      pageRegistry.filter(
        (p) =>
          (filter === 'All' || p.role === filter || p.status === filter) &&
          `${p.id} ${p.name} ${p.role}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  );
  const dark = resolvedTheme === 'dark';

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-4 py-4 sm:px-5 md:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand shadow-[0_10px_24px_-14px_var(--primary)]">
              <NovelHubMark size={24} />
            </span>
            <div className="min-w-0">
              <p className="font-bold tracking-tight">NovelHub</p>
              <h1 className="truncate text-sm font-normal text-muted">
                Xem trước giao diện · {pageRegistry.length} màn hình
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm text-muted md:inline">
              Công cụ phát triển / Trình bày
            </span>
            <Button variant="secondary" size="sm" onClick={() => setTheme(dark ? 'light' : 'dark')}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? 'Sáng' : 'Tối'}
            </Button>
          </div>
        </div>
      </header>
      <PageContainer>
        <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end">
          <div className="min-w-0">
            <p className="nh-eyebrow">Tiến độ frontend</p>
            <h2 className="mt-3 text-h2 sm:text-h1">
              {completed} / {pageRegistry.length} màn hình đã hoàn tất
            </h2>
            <ProgressBar
              value={completed}
              max={pageRegistry.length}
              className="mt-5"
              label="Tiến độ hoàn tất màn hình"
            />
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
            {pageRoles.map((role) => {
              const pages = pageRegistry.filter((p) => p.role === role);
              return (
                <li
                  className="min-w-0 rounded-2xl border border-hairline bg-surface px-3 py-2.5 shadow-whisper"
                  key={role}
                >
                  <strong className="block text-sm tabular-nums">
                    {pages.filter((p) => p.status === 'DONE').length}/{pages.length}
                  </strong>
                  <span className="block truncate text-xs text-muted" title={role}>
                    {role}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <Card className="mb-7 flex flex-col gap-3 p-3 sm:p-4 md:flex-row">
          <Input
            icon={Search}
            type="search"
            aria-label="Tìm màn hình"
            placeholder="Tìm màn hình..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Select
            aria-label="Lọc màn hình"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="md:w-56"
          >
            <option value="All">Tất cả</option>
            <optgroup label="Vai trò">
              {pageRoles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </optgroup>
            <optgroup label="Trạng thái">
              {pageStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status] || status}
                </option>
              ))}
            </optgroup>
          </Select>
        </Card>

        {visible.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((page) => {
              const available = page.status !== 'TODO';
              return (
                <Card as="article" key={page.id} className="flex min-h-56 min-w-0 flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-brand-strong tabular-nums">
                      {page.id}
                    </span>
                    <Badge tone={statusTone[page.status]}>{statusLabels[page.status]}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold leading-6">{page.name}</h3>
                  <p className="mt-1 text-sm text-muted">{page.role}</p>
                  <code className="mt-3 truncate rounded-full bg-elevated px-3 py-1 text-xs text-ink/70">
                    {page.route}
                  </code>
                  <div className="mt-auto flex gap-2 pt-5">
                    {available ? (
                      <>
                        <ButtonLink to={page.route} size="sm" className="min-h-10 flex-1">
                          Mở trang
                        </ButtonLink>
                        <Link
                          className="inline-grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink transition-[border-color,color,transform] duration-200 hover:border-brand hover:text-brand-strong active:scale-[0.96]"
                          to={page.previewRoute}
                          aria-label={`Xem trước ${page.name}`}
                        >
                          <ExternalLink size={16} />
                        </Link>
                      </>
                    ) : (
                      <Button size="sm" className="min-h-10 flex-1" disabled>
                        Chưa sẵn sàng
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-0">
            <EmptyState
              icon={FileSearch}
              title="Không có màn hình nào khớp tìm kiếm."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setFilter('All');
                  }}
                >
                  Xóa bộ lọc
                </Button>
              }
            />
          </Card>
        )}

        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-h3 md:text-h2">Quy trình bổ sung</h2>
          <p className="mt-1 text-sm text-muted">
            Các hành trình hỗ trợ nằm ngoài danh mục đánh số P01–P36.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {workflows.map(([label, route]) => (
              <Card
                as={Link}
                interactive
                key={label}
                to={route}
                className="group flex items-center justify-between gap-3 p-4 text-sm font-semibold hover:border-brand/50"
              >
                {label}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand-strong transition-transform duration-[420ms] group-hover:translate-x-0.5">
                  <ArrowRight size={15} />
                </span>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-10 border-t border-hairline pt-8">
          <h2 className="text-h3 md:text-h2">Tài nguyên hình ảnh</h2>
          <p className="mt-1 max-w-[65ch] text-sm text-muted">
            Ảnh gốc tỷ lệ 2:3 không chứa chữ, tiêu đề dựng bằng HTML và có phương án dự phòng.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:max-w-3xl">
            {stories.slice(0, 3).map((story) => (
              <article key={story.id} className="min-w-0">
                <StoryCover story={story} className="aspect-[2/3] rounded-2xl" />
                <h3 className="mt-2 truncate text-sm font-semibold">{story.title}</h3>
                <p className="text-xs text-muted">Ảnh minh họa AI · WebP</p>
              </article>
            ))}
          </div>
        </section>
        <IconGallery />
      </PageContainer>
    </div>
  );
}
