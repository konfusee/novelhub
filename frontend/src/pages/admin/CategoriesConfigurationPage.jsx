import { useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  FolderTree,
  Hash,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
} from '../../components/icons';
import { AdminLayout } from '../../layouts';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Skeleton,
  Tabs,
} from '../../components/ui';

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
];
const tabs = [
  { value: 'categories', label: 'Danh mục · 9 đang hoạt động' },
  { value: 'tags', label: 'Thể loại phụ và thẻ · 148' },
  { value: 'ratings', label: 'Xếp hạng nội dung · 3 cấp' },
  { value: 'lifecycle', label: 'Vòng đời truyện · 6 trạng thái' },
];
const categoryLabels = {
  'Fantasy & Mythic': 'Kỳ ảo và thần thoại',
  'Romance & Drama': 'Lãng mạn và chính kịch',
  'Mystery & Thriller': 'Bí ẩn và giật gân',
  'Sci-Fi & Cyberpunk': 'Khoa học viễn tưởng và Cyberpunk',
  'Adventure & Exploration': 'Phiêu lưu và khám phá',
  'Slice of Life & Cozy': 'Đời thường và chữa lành',
  'Historical & Period': 'Lịch sử và thời đại',
  'Horror & Supernatural': 'Kinh dị và siêu nhiên',
  'Comedy & Satire': 'Hài hước và châm biếm',
};
const tintLabels = {
  'Soft Teal': 'Xanh ngọc nhạt',
  'Soft Rose': 'Hồng nhạt',
  'Soft Orange': 'Cam nhạt',
  'Soft Purple': 'Tím nhạt',
  'Neutral Teal': 'Xanh ngọc trung tính',
  'Soft Amber': 'Hổ phách nhạt',
  'Neutral Slate': 'Xám đá trung tính',
  'Dark Slate': 'Xám đá đậm',
};

const tintTones = {
  'Soft Teal': 'green',
  'Neutral Teal': 'green',
  'Soft Rose': 'red',
  'Soft Orange': 'orange',
  'Soft Amber': 'orange',
  'Soft Purple': 'purple',
  'Neutral Slate': 'blue',
  'Dark Slate': 'blue',
};
const tagSeed = [
  '#SlowBurn',
  '#AncientMagic',
  '#MythologicalCreatures',
  '#SeaVoyage',
  '#DarkFantasy',
];
const lifecycle = [
  'Bản nháp',
  'Chờ duyệt',
  'Yêu cầu chỉnh sửa',
  'Đã duyệt',
  'Đã xuất bản',
  'Đã lưu trữ',
];
const labelOf = (item) => categoryLabels[item[0]] ?? item[0];
/* Colour, counts and placement (heading indexes 2–5) are dropped below md so status and actions fit. */
const secondaryColumn = (index) => (index >= 2 && index <= 5 ? 'hidden md:table-cell' : '');
const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const initialConfig = { categories: seed, archived: [], ai: true };

export function CategoriesConfigurationPage() {
  const taxonomy = useMockResource('admin:taxonomy', initialConfig, {
    isEmpty: (value) => !value.categories.length,
  });
  const tagList = useMockResource('admin:tags', tagSeed);
  const [active, setActive] = useState('categories');
  const [query, setQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [saved, setSaved] = useState(initialConfig);
  const [categories, setCategories] = useState(seed);
  const [archived, setArchived] = useState([]);
  const [ai, setAi] = useState(true);
  /* form: { mode: 'category' | 'tag' | 'edit', item? } */
  const [form, setForm] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories.filter((item) =>
      `${item.join(' ')} ${labelOf(item)}`.toLowerCase().includes(needle),
    );
  }, [categories, query]);
  const tags = tagList.data.filter((tag) =>
    tag.toLowerCase().includes(tagQuery.trim().toLowerCase().replace(/^#/, '')),
  );
  const loadingCategories = taxonomy.status === 'loading';
  const changes =
    categories.filter((item, index) => item !== saved.categories[index]).length +
    Math.abs(categories.length - saved.categories.length) +
    archived.filter((slug) => !saved.archived.includes(slug)).length +
    saved.archived.filter((slug) => !archived.includes(slug)).length +
    (ai === saved.ai ? 0 : 1);

  const move = (slug, delta) => {
    setCategories((items) => {
      const index = items.findIndex((item) => item[1] === slug);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const copy = [...items];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };
  const submitForm = ({ name, slug }) => {
    const cleanSlug = slugify(slug || name);
    if (form.mode === 'tag') {
      setNotice(`Đã tạo thẻ #${cleanSlug || name} (bản mẫu).`);
    } else if (form.mode === 'edit') {
      setCategories((items) =>
        items.map((item) =>
          item[1] === form.item[1] ? [name, cleanSlug || item[1], ...item.slice(2)] : item,
        ),
      );
      setArchived((items) =>
        items.map((value) => (value === form.item[1] ? cleanSlug || value : value)),
      );
    } else {
      setCategories((items) => [...items, [name, cleanSlug, 'Neutral Slate', '0', '0']]);
    }
    setForm(null);
  };
  const confirmArchive = () => {
    setArchived((items) => [...items, archiving[1]]);
    setArchiving(null);
  };
  const discard = () => {
    setCategories(saved.categories);
    setArchived(saved.archived);
    setAi(saved.ai);
  };
  const save = () => {
    setSaved({ categories, archived, ai });
    setNotice('Đã lưu cấu hình phân loại cục bộ.');
  };

  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-ink/70">
              Bảng điều khiển quản trị / Kiến trúc nội dung / Phân loại và xếp hạng
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Cấu hình danh mục, thẻ và nội dung</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setNotice('Đã đưa việc lập lại chỉ mục phân loại vào hàng đợi (bản mẫu).')
              }
            >
              <RefreshCw size={16} />
              Lập lại chỉ mục phân loại
            </Button>
            <Button variant="secondary" onClick={() => setForm({ mode: 'tag' })}>
              <Hash size={16} />
              Tạo thẻ
            </Button>
            <Button onClick={() => setForm({ mode: 'category' })}>
              <Plus size={16} />
              Thêm danh mục
            </Button>
          </div>
        </header>

        <div className="mt-6 min-w-0">
          <Tabs
            label="Nhóm cấu hình"
            singleRow
            value={active}
            onChange={setActive}
            items={tabs.map((tab) =>
              tab.value === 'categories'
                ? {
                    ...tab,
                    label:
                      taxonomy.status === 'ready'
                        ? `Danh mục · ${categories.length - archived.length} đang hoạt động`
                        : 'Danh mục',
                  }
                : tab,
            )}
          />
        </div>

        {active === 'categories' && (
          <Card className="mt-6 overflow-hidden p-0">
            <div className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-h3">
                  Danh mục xuất bản cốt lõi <Badge tone="blue">Phân loại cấp 1</Badge>
                </h2>
                <p className="mt-1 max-w-2xl text-caption text-muted">
                  Thể loại cốt lõi xuất hiện trong khám phá, điều hướng độc giả và bộ lọc công khai.
                </p>
              </div>
              <Input
                icon={Search}
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Lọc danh mục"
                placeholder="Lọc bản ghi danh mục…"
                className="w-full shrink-0 lg:w-72"
              />
            </div>
            {taxonomy.status === 'error' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được danh mục"
                description="Dịch vụ phân loại chưa phản hồi. Cấu hình đang xuất bản vẫn được giữ nguyên."
                className="border-t border-hairline"
                action={
                  <Button variant="secondary" size="sm" onClick={taxonomy.retry}>
                    <RotateCcw size={14} />
                    Thử lại
                  </Button>
                }
              />
            ) : taxonomy.status === 'empty' ? (
              <EmptyState
                icon={FolderTree}
                title="Chưa có danh mục xuất bản"
                description="Tạo danh mục cấp 1 đầu tiên để độc giả có thể khám phá và lọc truyện."
                className="border-t border-hairline"
                action={
                  <Button size="sm" onClick={() => setForm({ mode: 'category' })}>
                    <Plus size={14} />
                    Thêm danh mục
                  </Button>
                }
              />
            ) : loadingCategories || filtered.length ? (
              <div className="overflow-x-auto">
                <table
                  aria-busy={loadingCategories}
                  className="w-full whitespace-nowrap text-left text-sm md:min-w-[920px]"
                >
                  <caption className="sr-only">
                    {loadingCategories ? 'Đang tải danh mục xuất bản' : 'Danh mục xuất bản cốt lõi'}
                  </caption>
                  <thead className="border-y border-hairline bg-elevated text-[11px] uppercase tracking-[.12em] text-ink/70">
                    <tr>
                      {[
                        'Thứ tự',
                        'Danh mục và token',
                        'Màu nhận diện',
                        'Truyện hoạt động',
                        'Lượt đọc tháng',
                        'Vị trí',
                        'Trạng thái',
                      ].map((heading, index) => (
                        <th
                          key={heading}
                          scope="col"
                          className={`px-4 py-3 font-semibold first:pl-5 ${secondaryColumn(index)}`}
                        >
                          {heading}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="right-0 bg-elevated px-4 py-3 pr-5 text-right font-semibold md:sticky md:shadow-[-12px_0_12px_-12px_var(--hairline)]"
                      >
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y divide-hairline ${loadingCategories ? '' : 'nh-fade-enter'}`}
                  >
                    {loadingCategories &&
                      Array.from({ length: 9 }, (_, index) => <CategoryRowSkeleton key={index} />)}
                    {!loadingCategories &&
                      filtered.map((item) => {
                        const position = categories.indexOf(item);
                        const label = labelOf(item);
                        const isArchived = archived.includes(item[1]);
                        return (
                          <tr
                            key={item[1]}
                            className={`transition-colors hover:bg-elevated/60 ${isArchived ? 'text-ink/60' : ''}`}
                          >
                            <td className="px-4 py-3 pl-5">
                              <div className="flex items-center gap-1">
                                <IconButton
                                  label={`Chuyển ${label} lên`}
                                  shape="circle"
                                  size="sm"
                                  disabled={position === 0}
                                  onClick={() => move(item[1], -1)}
                                >
                                  <ChevronUp size={16} />
                                </IconButton>
                                <span className="w-6 text-center font-mono text-xs font-semibold">
                                  {String(position + 1).padStart(2, '0')}
                                </span>
                                <IconButton
                                  label={`Chuyển ${label} xuống`}
                                  shape="circle"
                                  size="sm"
                                  disabled={position === categories.length - 1}
                                  onClick={() => move(item[1], 1)}
                                >
                                  <ChevronDown size={16} />
                                </IconButton>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <strong className="block font-semibold text-ink">{label}</strong>
                              <span className="font-mono text-xs text-muted">/genre/{item[1]}</span>
                            </td>
                            <td className="hidden px-4 py-3 md:table-cell">
                              <Badge tone={tintTones[item[2]] ?? 'neutral'}>
                                {tintLabels[item[2]] ?? item[2]}
                              </Badge>
                            </td>
                            <td className="hidden px-4 py-3 font-semibold md:table-cell">
                              {item[3]}
                            </td>
                            <td className="hidden px-4 py-3 font-semibold text-brand-strong md:table-cell">
                              {item[4]}
                            </td>
                            <td className="hidden px-4 py-3 md:table-cell">
                              <Badge tone="blue">
                                {position < 4 ? 'Hàng nổi bật' : 'Lưới khám phá'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={isArchived ? 'neutral' : 'green'}>
                                {isArchived ? 'Đã lưu trữ' : 'Đang hoạt động'}
                              </Badge>
                            </td>
                            <td className="right-0 bg-surface px-4 py-3 pr-5 md:sticky md:shadow-[-12px_0_12px_-12px_var(--hairline)]">
                              <div className="flex justify-end gap-2">
                                <IconButton
                                  label={`Sửa ${label}`}
                                  tone="brand"
                                  size="sm"
                                  onClick={() => setForm({ mode: 'edit', item })}
                                >
                                  <Edit3 size={16} />
                                </IconButton>
                                {isArchived ? (
                                  <IconButton
                                    label={`Khôi phục ${label}`}
                                    tone="purple"
                                    size="sm"
                                    onClick={() =>
                                      setArchived((items) =>
                                        items.filter((value) => value !== item[1]),
                                      )
                                    }
                                  >
                                    <RotateCcw size={16} />
                                  </IconButton>
                                ) : (
                                  <IconButton
                                    label={`Lưu trữ ${label}`}
                                    tone="rose"
                                    size="sm"
                                    onClick={() => setArchiving(item)}
                                  >
                                    <Archive size={16} />
                                  </IconButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={FolderTree}
                title="Không tìm thấy danh mục"
                description="Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh mục."
                className="border-t border-hairline"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Xóa bộ lọc
                  </Button>
                }
              />
            )}
            <div className="flex flex-col justify-between gap-3 border-t border-hairline px-5 py-4 text-caption text-muted sm:flex-row sm:items-center">
              <span>
                {loadingCategories
                  ? 'Đang tải danh mục…'
                  : `Đang hiển thị ${taxonomy.status === 'ready' ? filtered.length : 0} / ${taxonomy.status === 'ready' ? categories.length : 0} danh mục đã xuất bản`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto"
                onClick={() => setNotice('Đã tải lược đồ phân loại (bản mẫu).')}
              >
                <Download size={15} />
                Tải lược đồ phân loại
              </Button>
            </div>
          </Card>
        )}

        {active === 'tags' && (
          <Card className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-h3">Từ vựng thẻ và tiếp nhận bằng AI</h2>
                <p className="mt-1 text-caption text-muted">
                  Quản lý tiểu thể loại, mô-típ độc giả và quy tắc gắn thẻ tự động.
                </p>
              </div>
              <Badge tone="blue">148 thẻ</Badge>
            </div>
            <Input
              icon={Hash}
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              aria-label="Tìm thẻ"
              placeholder="Tìm thẻ, ví dụ #SlowBurn"
              className="mt-5 max-w-md"
            />
            {tagList.status === 'error' ? (
              <LoadError
                title="Không tải được từ vựng thẻ"
                description="Danh sách thẻ chưa phản hồi."
                onRetry={tagList.retry}
                className="px-0 py-10"
              />
            ) : tagList.status === 'empty' ? (
              <EmptyState
                icon={Hash}
                headingAs="h3"
                title="Chưa có thẻ nào"
                description="Tạo thẻ đầu tiên để mô tả mô-típ và tiểu thể loại."
                className="px-0 py-10"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setForm({ mode: 'tag' })}>
                    <Hash size={14} />
                    Tạo thẻ
                  </Button>
                }
              />
            ) : (
              <div
                aria-busy={tagList.status === 'loading'}
                aria-label={tagList.status === 'loading' ? 'Đang tải thẻ' : undefined}
                className="mt-4 flex min-h-8 flex-wrap gap-2"
              >
                {tagList.status === 'loading' ? (
                  ['w-32', 'w-36', 'w-48', 'w-32', 'w-36'].map((width, index) => (
                    <Skeleton key={index} className={`h-6 ${width}`} />
                  ))
                ) : tags.length ? (
                  tags.map((tag) => (
                    <Badge
                      key={tag}
                      tone={tag === '#DarkFantasy' ? 'orange' : 'green'}
                      className="nh-fade-enter"
                    >
                      {tag} · {1240 - tagList.data.indexOf(tag) * 190}
                    </Badge>
                  ))
                ) : (
                  <p className="text-caption text-muted">Không có thẻ nào khớp từ khóa.</p>
                )}
              </div>
            )}
            {loadingCategories ? (
              <Skeleton className="mt-6 h-[4.625rem] w-full rounded-2xl" />
            ) : (
              taxonomy.status !== 'error' && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={ai}
                  onClick={() => setAi(!ai)}
                  className="nh-fade-enter mt-6 flex w-full items-center gap-3 rounded-2xl border border-hairline bg-elevated p-4 text-left transition-colors hover:border-line"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-strong">
                    <Sparkles size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 whitespace-normal">
                    <strong className="block text-sm font-semibold">
                      Bộ máy đề xuất thẻ tự động
                    </strong>
                    <span className="text-xs text-ink/70">
                      NovelCraft AI gắn thẻ khi tiếp nhận truyện
                    </span>
                  </span>
                  <SwitchTrack on={ai} />
                </button>
              )
            )}
          </Card>
        )}

        {active === 'ratings' && (
          <Card className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-h3">Xếp hạng nội dung và giới hạn độ tuổi</h2>
                <p className="mt-1 text-caption text-muted">
                  Tiêu chí bắt buộc cho các nhóm tuổi độc giả và yêu cầu tuân thủ.
                </p>
              </div>
              <Badge tone="blue">3 cấp</Badge>
            </div>
            <div className="nh-grid-12 mt-5 grid gap-3 nh-lg-cols-3">
              <Rating
                badge="G"
                title="Mọi đối tượng (G / PG)"
                note="Nội dung an toàn, không có bạo lực trực diện và phù hợp gia đình."
                tone="green"
              />
              <Rating
                badge="13+"
                title="Thanh thiếu niên (PG-13)"
                note="Có cảnh chiến đấu cách điệu vừa phải và chủ đề căng thẳng."
                tone="orange"
              />
              <Rating
                badge="18+"
                title="Trưởng thành (18+)"
                note="Kinh dị trực diện hoặc lãng mạn trưởng thành yêu cầu xác minh độ tuổi."
                tone="red"
              />
            </div>
          </Card>
        )}

        {active === 'lifecycle' && (
          <Card className="mt-6">
            <h2 className="text-h3">Trạng thái vòng đời truyện</h2>
            <p className="mt-1 text-caption text-muted">
              Trạng thái xuất bản kiểm soát khả năng hiển thị, chỉnh sửa, kiểm duyệt và truy cập của
              độc giả.
            </p>
            <ol className="nh-grid-12 mt-5 grid gap-3 nh-sm-cols-2 nh-lg-cols-3">
              {lifecycle.map((state, index) => (
                <li
                  key={state}
                  className="flex items-start gap-3 rounded-2xl border border-hairline bg-elevated p-4"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-mono text-xs font-semibold text-ink/70">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <Badge tone={index < 2 ? 'orange' : index === 4 ? 'green' : 'neutral'}>
                      {state}
                    </Badge>
                    <p className="mt-2 text-xs text-ink/70">
                      Chuyển đổi hợp lệ trong quy trình biên tập và xuất bản.
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {changes > 0 && (
          <Card className="nh-dialog-enter mt-6 flex flex-col gap-4 border-orange/40 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1" role="status">
              <h2 className="text-base font-semibold">{changes} thay đổi phân loại chưa lưu</h2>
              <p className="mt-1 text-caption text-muted">
                Phiên bản xuất bản gần nhất: 4.12.0 · Thay đổi chỉ được lưu cục bộ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={discard}>
                <RotateCcw size={16} />
                Hủy thay đổi
              </Button>
              <Button onClick={save}>Lưu cấu hình phân loại</Button>
            </div>
          </Card>
        )}

        <Modal
          open={Boolean(form)}
          title={
            form?.mode === 'edit'
              ? `Sửa ${labelOf(form.item)}`
              : form?.mode === 'tag'
                ? 'Tạo thẻ'
                : 'Thêm danh mục mới'
          }
          onClose={() => setForm(null)}
        >
          {form && (
            <TaxonomyForm
              key={form.item?.[1] ?? form.mode}
              mode={form.mode}
              item={form.item}
              onCancel={() => setForm(null)}
              onSubmit={submitForm}
            />
          )}
        </Modal>
        <Modal
          open={Boolean(archiving)}
          title="Lưu trữ danh mục"
          onClose={() => setArchiving(null)}
        >
          {archiving && (
            <>
              <div className="flex gap-3 rounded-2xl bg-rose/10 p-4">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-strong" />
                <p className="text-sm">
                  Lưu trữ <strong className="font-semibold">{labelOf(archiving)}</strong> (
                  <span className="font-mono">/genre/{archiving[1]}</span>) sẽ ẩn danh mục khỏi khám
                  phá và bộ lọc công khai. {archiving[3]} truyện đang hoạt động sẽ cần được gán danh
                  mục khác.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setArchiving(null)}>
                  Hủy
                </Button>
                <Button variant="danger" onClick={confirmArchive}>
                  <Archive size={16} />
                  Lưu trữ {labelOf(archiving)}
                </Button>
              </div>
            </>
          )}
        </Modal>
        <Modal open={Boolean(notice)} title="Cập nhật cấu hình" onClose={() => setNotice('')}>
          <p className="text-sm">{notice}</p>
          <Button onClick={() => setNotice('')} className="mt-6 w-full">
            Hoàn tất
          </Button>
        </Modal>
      </div>
    </AdminLayout>
  );
}

function TaxonomyForm({ mode, item, onCancel, onSubmit }) {
  const id = useId();
  const [name, setName] = useState(item ? labelOf(item) : '');
  const [slug, setSlug] = useState(item ? item[1] : '');
  const [description, setDescription] = useState('');
  const isTag = mode === 'tag';
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSubmit({ name: name.trim(), slug: slug.trim() });
      }}
    >
      <div>
        <label htmlFor={`${id}-name`} className="text-sm font-semibold">
          {isTag ? 'Tên thẻ' : 'Tên hiển thị'}
        </label>
        <Input
          id={`${id}-name`}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2"
        />
      </div>
      <div>
        <label htmlFor={`${id}-slug`} className="text-sm font-semibold">
          URL slug
        </label>
        <Input
          id={`${id}-slug`}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder={slugify(name) || 'tu-dong-tao-tu-ten'}
          className="mt-2"
        />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className="text-sm font-semibold">
          Mô tả
        </label>
        <Input
          id={`${id}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {mode === 'edit' ? 'Lưu thay đổi' : isTag ? 'Tạo thẻ' : 'Thêm danh mục'}
        </Button>
      </div>
    </form>
  );
}
function SwitchTrack({ on }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${on ? 'bg-brand' : 'bg-ink/15'}`}
    >
      <span
        className={`size-4 rounded-full bg-surface shadow-whisper transition-transform duration-200 ease-spring ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </span>
  );
}
function Rating({ badge, title, note, tone }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-hairline bg-elevated p-4">
      <Badge tone={tone} className="h-fit shrink-0">
        {badge}
      </Badge>
      <div className="min-w-0">
        <strong className="text-sm font-semibold">{title}</strong>
        <p className="mt-1 text-xs text-ink/70">{note}</p>
      </div>
    </div>
  );
}

/* Matches a category row: reorder controls, two-line name, badges, counts and action icons. */
function CategoryRowSkeleton() {
  return (
    <tr aria-hidden="true">
      <td className="px-4 py-3 pl-5">
        <div className="flex items-center gap-1">
          <Skeleton className="size-9 pointer-coarse:size-11" />
          <Skeleton className="mx-1 h-3 w-4" />
          <Skeleton className="size-9 pointer-coarse:size-11" />
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-36" />
        </span>
        <span className="flex h-5 items-center">
          <Skeleton className="h-3 w-44" />
        </span>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Skeleton className="h-6 w-24" />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Skeleton className="h-3.5 w-14" />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Skeleton className="h-3.5 w-12" />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Skeleton className="h-6 w-28" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-6 w-28" />
      </td>
      <td className="right-0 bg-surface px-4 py-3 pr-5 md:sticky md:shadow-[-12px_0_12px_-12px_var(--hairline)]">
        <div className="flex justify-end gap-2">
          <Skeleton className="size-9 rounded-2xl pointer-coarse:size-11" />
          <Skeleton className="size-9 rounded-2xl pointer-coarse:size-11" />
        </div>
      </td>
    </tr>
  );
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
  );
}
