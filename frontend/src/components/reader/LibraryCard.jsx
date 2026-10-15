import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, CheckCircle2, Download, Headphones, MoreVertical, Play, Trash2 } from '../icons';
import { Badge, ButtonLink, Card, ProgressBar, Skeleton } from '../ui';
import { StoryCover } from '../story/StoryCover';
import { useLocale } from '../../context/LocaleContext';

const menuItemClass =
  'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-elevated pointer-coarse:min-h-11';
/* Menu footprint used to keep it on-screen (w-52 + margin; three items at touch height). */
const MENU_WIDTH = 216;
const MENU_HEIGHT = 150;

export function LibraryCard({ item, view = 'grid', onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [placement, setPlacement] = useState('right-0 bottom-full mb-1');
  const [notice, setNotice] = useState('');
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const { t } = useLocale();
  const audio = item.type === 'audio';
  const href = item.chapterId
    ? audio
      ? `/listen/${item.id}/${item.chapterId}`
      : `/read/${item.id}/${item.chapterId}`
    : `/stories/${item.id}`;
  const typeLabel = t(audio ? 'library.audiobook' : 'library.textStory');

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (
        event.type === 'keydown' ? event.key === 'Escape' : !menuRef.current?.contains(event.target)
      )
        setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const choose = (message) => {
    setNotice(message);
    setMenuOpen(false);
  };

  /* Open toward the side and direction with room: never past the viewport edge or under the header. */
  const toggleMenu = () => {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const headerBottom =
        document.querySelector('[data-app-header]')?.getBoundingClientRect().bottom ?? 0;
      const fitsAbove = rect.top - MENU_HEIGHT >= headerBottom + 8;
      const fitsBelow = rect.bottom + MENU_HEIGHT <= window.innerHeight - 8;
      const below = view === 'list' ? fitsBelow || !fitsAbove : !fitsAbove && fitsBelow;
      setPlacement(
        `${rect.right < MENU_WIDTH ? 'left-0' : 'right-0'} ${below ? 'top-full mt-1' : 'bottom-full mb-1'}`,
      );
    }
    setMenuOpen(!menuOpen);
  };

  const menu = (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('common.options')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="grid size-9 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-200 hover:bg-elevated hover:text-ink active:scale-[0.96] pointer-coarse:size-11"
        onClick={toggleMenu}
      >
        <MoreVertical size={18} />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className={`nh-dialog-enter absolute z-20 w-52 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-1.5 text-xs shadow-float ${placement}`}
        >
          <button
            role="menuitem"
            onClick={() => choose('Tác phẩm chưa có bản tải ngoại tuyến.')}
            className={menuItemClass}
          >
            <Download size={15} />
            {t('library.downloadOffline')}
          </button>
          <button
            role="menuitem"
            onClick={() => choose('Tiến độ hoàn tất được cập nhật khi bạn đọc các chương.')}
            className={menuItemClass}
          >
            <CheckCircle2 size={15} />
            {t('library.markFinished')}
          </button>
          <button
            role="menuitem"
            onClick={() => onRemove(item.id)}
            className={`${menuItemClass} text-rose-strong hover:bg-rose/10`}
          >
            <Trash2 size={15} />
            {t('library.remove')}
          </button>
        </div>
      )}
    </div>
  );

  const status = notice && (
    <p role="status" className="mt-2 text-xs font-medium text-brand-strong">
      {notice}
    </p>
  );

  if (view === 'list')
    return (
      <Card as="article" className="flex items-center gap-3 p-3 sm:gap-4">
        <Link to={href} tabIndex={-1} aria-hidden="true" className="group shrink-0">
          <StoryCover story={item} className="aspect-[2/3] w-16 rounded-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className="line-clamp-2 min-w-0 whitespace-normal text-base font-semibold"
              title={item.title}
            >
              <Link to={href} className="whitespace-normal transition-colors hover:text-brand">
                {item.title}
              </Link>
            </h3>
            <Badge tone={audio ? 'orange' : 'green'}>{typeLabel}</Badge>
          </div>
          <p className="truncate text-xs text-muted" title={item.author}>
            {item.author}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <ProgressBar
              value={item.progress}
              tone={audio ? 'orange' : 'brand'}
              size="sm"
              label={`Tiến độ ${item.title}`}
              className="flex-1"
            />
            <span className="text-xs font-semibold tabular-nums">{item.progress}%</span>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {item.detail} · {item.activity}
          </p>
          {status}
        </div>
        <ButtonLink
          to={href}
          size="sm"
          aria-label={`${t('common.continue')} ${item.title}`}
          className="px-3 sm:px-4"
        >
          {audio ? <Play size={14} /> : <BookOpen size={14} />}
          <span className="hidden sm:inline">{t('common.continue')}</span>
        </ButtonLink>
        {menu}
      </Card>
    );

  return (
    <Card as="article" className="group flex flex-col p-3">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="block">
        <StoryCover
          story={item}
          className="aspect-[2/3] rounded-2xl"
          badge={
            <>
              <span className="absolute bottom-2 left-2 rounded-full bg-surface/90 shadow-whisper">
                <Badge tone={audio ? 'orange' : 'green'}>
                  {audio ? <Headphones size={12} /> : <BookOpen size={12} />}
                  <span className="hidden sm:inline">{typeLabel}</span>
                </Badge>
              </span>
              {item.offline && (
                <span
                  role="img"
                  aria-label={t('library.availableOffline')}
                  title={t('library.availableOffline')}
                  className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-surface/90 text-brand-strong shadow-whisper"
                >
                  <Download size={14} />
                </span>
              )}
            </>
          }
        />
      </Link>
      <h3 className="mt-3 line-clamp-2 whitespace-normal text-sm font-semibold" title={item.title}>
        <Link to={href} className="whitespace-normal transition-colors hover:text-brand">
          {item.title}
        </Link>
      </h3>
      <p className="truncate text-xs text-muted" title={item.author}>
        {item.author}
      </p>
      <div className="mt-3">
        <div className="flex justify-between gap-2 text-xs">
          <span className="min-w-0 text-muted">{item.detail}</span>
          <strong
            className={`shrink-0 tabular-nums ${audio ? 'text-orange-strong' : 'text-brand-strong'}`}
          >
            {item.progress}%
          </strong>
        </div>
        <ProgressBar
          value={item.progress}
          tone={audio ? 'orange' : 'brand'}
          size="sm"
          label={`Tiến độ ${item.title}`}
          className="mt-1.5"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-2 text-xs text-muted">
        <span className="min-w-0">{item.activity}</span>
        {menu}
      </div>
      {status}
    </Card>
  );
}

/* Placeholder for both LibraryCard views, matching cover sizes and row heights. */
export function LibraryCardSkeleton({ view = 'grid' }) {
  if (view === 'list')
    return (
      <Card as="div" aria-hidden="true" className="flex items-center gap-3 p-3 sm:gap-4">
        <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 min-w-0 flex-1 items-center">
              <Skeleton className="h-4 w-3/5" />
            </span>
            <Skeleton className="h-6 w-20 shrink-0" />
          </div>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-1/3" />
          </span>
          <div className="mt-2.5 flex h-4 items-center gap-3">
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-3 w-8" />
          </div>
          <span className="mt-1.5 flex h-4 items-center">
            <Skeleton className="h-2.5 w-2/5" />
          </span>
        </div>
        <Skeleton className="h-9 w-10 shrink-0 sm:w-28" />
        <Skeleton className="size-9 shrink-0 pointer-coarse:size-11" />
      </Card>
    );
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-3">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <span className="mt-3 flex flex-col justify-center gap-1.5 sm:h-5 sm:gap-0">
        <Skeleton className="mt-[3px] h-3.5 w-4/5 sm:mt-0" />
        <Skeleton className="mb-[3px] h-3.5 w-1/2 sm:hidden" />
      </span>
      <span className="flex h-4 items-center">
        <Skeleton className="h-2.5 w-1/2" />
      </span>
      <div className="mt-3">
        <div className="flex h-4 items-center justify-between gap-2">
          <Skeleton className="h-2.5 w-1/3" />
          <Skeleton className="h-2.5 w-8" />
        </div>
        <Skeleton className="mt-1.5 h-1.5 w-full" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-2">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="size-9 shrink-0 pointer-coarse:size-11" />
      </div>
    </Card>
  );
}
