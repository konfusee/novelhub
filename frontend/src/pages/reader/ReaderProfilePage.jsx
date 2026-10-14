import { SecurityPanel } from '../../components/account/SecurityPanel';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Check,
  Eye,
  Headphones,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from '../../components/icons';
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  SectionHeader,
  Skeleton,
  SkeletonText,
  Tabs,
} from '../../components/ui';
import { ReaderRange } from '../../components/reader/ReaderSettings';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useMockResource } from '../../context/MockDataContext';

const workspaceLayouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
};
const DEFAULT_BIO = 'Yêu thích truyện kỳ ảo phát triển chậm và trinh thám chữa lành.';
const DEFAULT_GENRES = ['Kỳ ảo', 'Lãng mạn', 'Bí ẩn'];
const SUGGESTED_GENRE = 'Khoa học viễn tưởng';
const FONT_RANGE = { min: 14, max: 24 };
/* Reading-canvas swatches are a deliberate canvas preview (AGENTS §7), not product chrome. */
const canvases = {
  parchment: { labelKey: 'settings.reading.parchment', background: '#fcf8f2', ink: '#172033' },
  cream: { labelKey: 'settings.reading.cream', background: '#fffdf9', ink: '#172033' },
  navy: { labelKey: 'settings.reading.navy', background: '#081321', ink: '#f4f1ea' },
};
const handleFor = (name) =>
  `@${(name || 'novelhub_reader').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

const PREFERENCES_KEY = 'novelhub.user.preferences';
const defaultPreferences = (user) => ({
  name: user?.name || 'Độc giả NovelHub',
  handle: handleFor(user?.name),
  bio: DEFAULT_BIO,
  genres: DEFAULT_GENRES,
  fontSize: 18,
  spacing: 1.8,
  canvas: 'parchment',
  speed: 1,
  skip: 15,
  autoplay: true,
});
/* Preferences saved by this page; null when nothing was saved yet (resource 'empty'). */
const readSavedPreferences = () => {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};
const isMissing = (value) => !value;

export function ReaderProfilePage({ workspace = 'reader', embedded = false }) {
  const Layout = embedded ? Fragment : workspaceLayouts[workspace] || ReaderLayout;
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t } = useLocale();
  const [savedPreferences] = useState(readSavedPreferences);
  const {
    status,
    data: stored,
    retry,
  } = useMockResource('user:preferences', savedPreferences, {
    isEmpty: isMissing,
  });
  const settingsRoot = workspace === 'admin' ? '/admin/preferences' : `/${workspace}/settings`;
  const isSettings = location.pathname.startsWith(settingsRoot);
  const sectionFromPath = location.pathname.split('/').at(-1);
  const section =
    isSettings &&
    ['reading', 'listening', 'appearance', 'privacy', 'security'].includes(sectionFromPath)
      ? sectionFromPath
      : isSettings
        ? 'reading'
        : 'profile';
  const tabsRef = useRef(null);
  /* Keep the active section visible in the horizontally scrolling tab rail on phones. */
  useEffect(() => {
    const active = tabsRef.current?.querySelector('[aria-pressed="true"]');
    const rail = active?.parentElement;
    if (!rail || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollLeft =
      active.offsetLeft - rail.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
  }, [section]);
  const changeSection = (value) => {
    navigate(`${settingsRoot}/${value}`);
  };
  return (
    <Layout>
      <div className={embedded ? '' : `page-${workspace} pb-12 pt-7`}>
        {!embedded && (
          <header className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-strong">
              {t(isSettings ? 'settings.sharedPreferences' : 'settings.publicIdentity')} ·{' '}
              {t('settings.userId', { id: 'NV-88291' })}
            </p>
            <h1 className="mt-2 text-h2 sm:text-h1">
              {t(isSettings ? 'settings.title' : 'settings.userProfile')}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-ink/70">
              {isSettings ? t('settings.description') : t('settings.profileDescription')}
            </p>
          </header>
        )}
        {isSettings && (
          <div ref={tabsRef} className="mt-6">
            <Tabs
              singleRow
              label={t('settings.title')}
              value={section}
              onChange={changeSection}
              items={[
                { value: 'reading', label: t('settings.tabs.reading') },
                { value: 'listening', label: t('settings.tabs.listening') },
                { value: 'appearance', label: t('settings.tabs.appearance') },
                { value: 'privacy', label: t('settings.tabs.privacy') },
                { value: 'security', label: t('settings.tabs.security') },
              ]}
            />
          </div>
        )}
        {status === 'loading' ? (
          <PreferencesSkeleton isSettings={isSettings} />
        ) : status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được tùy chọn đã lưu"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại để chỉnh sửa tùy chọn của bạn."
              action={
                <Button variant="secondary" size="sm" onClick={retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : (
          <PreferencesForm
            initial={{ ...defaultPreferences(currentUser), ...(status === 'ready' ? stored : {}) }}
            isSettings={isSettings}
            section={section}
          />
        )}
      </div>
    </Layout>
  );
}

function PanelTitle({ icon: Icon, title, note }) {
  return (
    <div className="border-b border-hairline pb-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
              <Icon size={17} aria-hidden="true" />
            </span>
            {title}
          </span>
        }
        description={note}
      />
    </div>
  );
}
function Field({ label, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
function Choice({ active, onClick, title, note }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`whitespace-normal rounded-2xl border p-3 text-left transition-[border-color,background-color,transform] active:scale-[0.98] ${active ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/50'}`}
    >
      <strong className="flex items-center justify-between gap-2 text-sm">
        {title}
        {active && <Check size={14} aria-hidden="true" className="text-brand-strong" />}
      </strong>
      <span className="mt-1 block text-caption text-muted">{note}</span>
    </button>
  );
}
function Switch({ checked, onChange, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={onChange}
      className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors after:absolute after:-inset-2 ${checked ? 'bg-brand' : 'bg-ink/15'}`}
    >
      <span
        aria-hidden="true"
        className={`size-5 rounded-full bg-surface shadow-whisper transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}
function ControlRow({ label, labelId, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-4 last:border-0 last:pb-0">
      <span id={labelId} className="text-sm font-semibold">
        {label}
      </span>
      {children}
    </div>
  );
}

/*
 * Editable profile/preferences, seeded once from the loaded preferences. Discard restores the
 * last loaded or saved values; save persists them.
 */
function PreferencesForm({ initial, isSettings, section }) {
  const { theme, setTheme } = useTheme();
  const { t } = useLocale();
  const ids = useId();
  const [baseline, setBaseline] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [fontSize, setFontSize] = useState(initial.fontSize);
  const [spacing, setSpacing] = useState(initial.spacing);
  const [canvas, setCanvas] = useState(initial.canvas in canvases ? initial.canvas : 'parchment');
  const [speed, setSpeed] = useState(initial.speed);
  const [skip, setSkip] = useState(initial.skip);
  const [autoplay, setAutoplay] = useState(initial.autoplay);
  const [saved, setSaved] = useState(true);
  const [genres, setGenres] = useState(initial.genres);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [notice, setNotice] = useState('');
  const changed = () => setSaved(false);
  const changeFontSize = (value) => {
    setFontSize(Math.min(FONT_RANGE.max, Math.max(FONT_RANGE.min, value)));
    changed();
  };
  const save = () => {
    const values = {
      name,
      handle,
      bio,
      genres,
      fontSize,
      spacing,
      canvas,
      speed,
      skip,
      autoplay,
    };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(values));
    setBaseline(values);
    setSaved(true);
    setNotice(t(isSettings ? 'settings.preferencesSavedNotice' : 'settings.profileSavedNotice'));
  };
  const discard = () => {
    setName(baseline.name);
    setHandle(baseline.handle);
    setBio(baseline.bio);
    setGenres(baseline.genres);
    setFontSize(baseline.fontSize);
    setSpacing(baseline.spacing);
    setCanvas(baseline.canvas in canvases ? baseline.canvas : 'parchment');
    setSpeed(baseline.speed);
    setSkip(baseline.skip);
    setAutoplay(baseline.autoplay);
    setSaved(true);
    setNotice(t(isSettings ? 'settings.preferencesDiscarded' : 'settings.profileDiscarded'));
  };
  const activeCanvas = canvases[canvas];
  return (
    <>
      <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
        <div className="min-w-0 space-y-5">
          {notice && (
            <p
              role="status"
              className="nh-fade-enter flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand/10 px-4 py-3 text-sm text-brand-strong"
            >
              <Check size={16} aria-hidden="true" />
              {notice}
            </p>
          )}
          {section === 'profile' && (
            <Card>
              <PanelTitle
                icon={UserRound}
                title="Thông tin hồ sơ"
                note="Hiển thị công khai với cộng đồng độc giả"
              />
              <div className="mt-6 flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar name={name || 'Người dùng NovelHub'} className="size-20 text-2xl" />
                  <button
                    type="button"
                    onClick={() => setNotice('Đã mở trình chọn ảnh đại diện ở chế độ mẫu.')}
                    aria-label="Đổi ảnh đại diện"
                    className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-brand text-on-brand ring-4 ring-surface transition-transform active:scale-[0.96]"
                  >
                    <Camera size={15} />
                  </button>
                </div>
                <div>
                  <Button
                    onClick={() => setNotice('Đã mở trình chọn ảnh đại diện ở chế độ mẫu.')}
                    variant="secondary"
                    size="sm"
                  >
                    Tải ảnh mới
                  </Button>
                  <p className="mt-2 text-caption text-muted">JPG hoặc PNG, tối thiểu 400×400px.</p>
                </div>
              </div>
              <div className="nh-grid-12 mt-6 grid gap-4 nh-sm-cols-2">
                <Field label="Tên hiển thị" htmlFor={`${ids}-name`}>
                  <Input
                    id={`${ids}-name`}
                    autoComplete="nickname"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      changed();
                    }}
                  />
                </Field>
                <Field label="Tên định danh" htmlFor={`${ids}-handle`}>
                  <Input
                    id={`${ids}-handle`}
                    autoComplete="username"
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value);
                      changed();
                    }}
                  />
                </Field>
              </div>
              <Field label="Tiểu sử độc giả" htmlFor={`${ids}-bio`} className="mt-4">
                <textarea
                  id={`${ids}-bio`}
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    changed();
                  }}
                  maxLength={160}
                  aria-describedby={`${ids}-bio-count`}
                  className="min-h-24 w-full rounded-3xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-colors focus:border-brand sm:text-sm"
                />
                <span
                  id={`${ids}-bio-count`}
                  className="mt-1 block text-right text-caption tabular-nums text-muted"
                >
                  {bio.length} / 160
                </span>
              </Field>
              <div className="mt-4">
                <p id={`${ids}-genres`} className="text-sm font-semibold">
                  Thể loại yêu thích
                </p>
                <ul aria-labelledby={`${ids}-genres`} className="mt-2 flex flex-wrap gap-2">
                  {genres.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        aria-label={`Bỏ thể loại ${item}`}
                        className="inline-flex min-h-9 items-center rounded-full transition-transform active:scale-[0.96]"
                        onClick={() => {
                          setGenres((current) => current.filter((genre) => genre !== item));
                          changed();
                        }}
                      >
                        <Badge tone="green" className="gap-1">
                          {item}
                          <X size={12} aria-hidden="true" />
                        </Badge>
                      </button>
                    </li>
                  ))}
                  {!genres.includes(SUGGESTED_GENRE) && (
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setGenres((current) => [...current, SUGGESTED_GENRE]);
                          changed();
                        }}
                        className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-line px-3 text-xs font-semibold text-ink/80 transition-colors hover:border-brand hover:text-brand-strong"
                      >
                        <Plus size={12} aria-hidden="true" />
                        Thêm thể loại
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </Card>
          )}
          {section === 'reading' && (
            <Card>
              <PanelTitle
                icon={BookOpen}
                title={t('settings.reading.title')}
                note={t('settings.reading.note')}
              />
              <div className="mt-6 flex items-baseline justify-between gap-3">
                <span id={`${ids}-font`} className="text-sm font-semibold">
                  {t('settings.reading.fontSize')}
                </span>
                <span className="text-caption font-semibold tabular-nums text-brand-strong">
                  {fontSize}px
                </span>
              </div>
              <ReaderRange
                aria-labelledby={`${ids}-font`}
                min={FONT_RANGE.min}
                max={FONT_RANGE.max}
                value={fontSize}
                valueText={`${fontSize}px`}
                onChange={changeFontSize}
                className="mt-2"
              />
              <p id={`${ids}-spacing`} className="mt-6 text-sm font-semibold">
                {t('settings.reading.lineSpacing')}
              </p>
              <div
                role="group"
                aria-labelledby={`${ids}-spacing`}
                className="nh-grid-12 mt-2 grid nh-cols-3 gap-2"
              >
                {[1.4, 1.8, 2.2].map((value) => (
                  <Choice
                    key={value}
                    active={spacing === value}
                    onClick={() => {
                      setSpacing(value);
                      changed();
                    }}
                    title={`${value}×`}
                    note={t(
                      value === 1.4
                        ? 'settings.reading.compact'
                        : value === 1.8
                          ? 'settings.reading.relaxed'
                          : 'settings.reading.spacious',
                    )}
                  />
                ))}
              </div>
              <p id={`${ids}-canvas`} className="mt-6 text-sm font-semibold">
                {t('settings.reading.canvas')}
              </p>
              <div
                role="group"
                aria-labelledby={`${ids}-canvas`}
                className="nh-grid-12 mt-2 grid nh-cols-3 gap-2"
              >
                {Object.entries(canvases).map(([value, option]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={canvas === value}
                    onClick={() => {
                      setCanvas(value);
                      changed();
                    }}
                    className={`flex min-h-12 items-center justify-between gap-2 whitespace-normal rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-[border-color,box-shadow,transform] active:scale-[0.98] ${canvas === value ? 'border-brand ring-2 ring-brand/25' : 'border-line hover:border-brand/50'}`}
                    style={{ backgroundColor: option.background, color: option.ink }}
                  >
                    {t(option.labelKey)}
                    {canvas === value && <Check size={14} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </Card>
          )}
          {section === 'listening' && (
            <Card>
              <PanelTitle
                icon={Headphones}
                title={t('settings.listening.title')}
                note={t('settings.listening.note')}
              />
              <ControlRow label={t('settings.listening.speed')} labelId={`${ids}-speed`}>
                <div
                  role="group"
                  aria-labelledby={`${ids}-speed`}
                  className="flex gap-1 rounded-full border border-hairline bg-elevated p-1"
                >
                  {[0.8, 1, 1.25, 1.5].map((value) => (
                    <button
                      type="button"
                      aria-pressed={speed === value}
                      onClick={() => {
                        setSpeed(value);
                        changed();
                      }}
                      key={value}
                      className={`min-h-10 rounded-full px-3.5 text-xs font-semibold tabular-nums transition-colors pointer-coarse:min-h-11 ${speed === value ? 'bg-brand text-on-brand' : 'text-ink/70 hover:text-ink'}`}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
              </ControlRow>
              <ControlRow label={t('settings.listening.skip')} labelId={`${ids}-skip`}>
                <div role="group" aria-labelledby={`${ids}-skip`} className="flex gap-2">
                  {[10, 15, 30].map((value) => (
                    <button
                      type="button"
                      aria-pressed={skip === value}
                      onClick={() => {
                        setSkip(value);
                        changed();
                      }}
                      key={value}
                      className={`min-h-10 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors ${skip === value ? 'border-brand bg-brand/10 text-brand-strong' : 'border-line text-ink/80 hover:border-brand/50'}`}
                    >
                      {value}s
                    </button>
                  ))}
                </div>
              </ControlRow>
              <ControlRow label={t('settings.listening.autoplay')} labelId={`${ids}-autoplay`}>
                <Switch
                  checked={autoplay}
                  labelledBy={`${ids}-autoplay`}
                  onChange={() => {
                    setAutoplay(!autoplay);
                    changed();
                  }}
                />
              </ControlRow>
            </Card>
          )}
          {section === 'appearance' && (
            <Card>
              <PanelTitle
                icon={Palette}
                title={t('settings.appearance.title')}
                note={t('settings.appearance.note')}
              />
              <div className="nh-grid-12 mt-6 grid gap-3 nh-sm-cols-3">
                {[
                  ['light', 'settings.appearance.light'],
                  ['dark', 'settings.appearance.dark'],
                  ['system', 'settings.appearance.system'],
                ].map(([value, labelKey]) => (
                  <Choice
                    key={value}
                    active={theme === value}
                    onClick={() => setTheme(value)}
                    title={t(labelKey)}
                    note={t(
                      value === 'system'
                        ? 'settings.appearance.followDevice'
                        : 'settings.appearance.palette',
                    )}
                  />
                ))}
              </div>
            </Card>
          )}
          {section === 'privacy' && (
            <Card>
              <PanelTitle
                icon={ShieldCheck}
                title={t('settings.privacy.title')}
                note={t('settings.privacy.note')}
              />
              <ControlRow label={t('settings.privacy.activity')}>
                <Badge tone="green">{t('settings.privacy.friendsOnly')}</Badge>
              </ControlRow>
            </Card>
          )}
          {section === 'security' && <SecurityPanel />}
        </div>
        {isSettings && (
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            {(section === 'reading' || section === 'appearance') && (
              <Card
                className="border-hairline"
                style={{ backgroundColor: activeCanvas.background, color: activeCanvas.ink }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <Eye size={15} aria-hidden="true" />
                    {t('settings.preview.title')}
                  </span>
                  {/* Tinted from the canvas, not theme tokens, so it stays legible on paper in dark mode. */}
                  <span
                    className="rounded-full border border-current/25 px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                    style={{ color: activeCanvas.ink }}
                  >
                    {fontSize}px · {spacing}×
                  </span>
                </div>
                <div className="mt-5 border-y border-current/12 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[.16em] opacity-70">
                    Chương 14 · The Silver Compass
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">The Whisper in the Pines</h2>
                  <p className="mt-4" style={{ fontSize, lineHeight: spacing }}>
                    The ancient trail curved gently beneath the canopy of silver pines, where
                    twilight pooled in deep amethyst shadows. The story had not ended at the lake.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    aria-label={`${t('settings.reading.fontSize')} −`}
                    disabled={fontSize <= FONT_RANGE.min}
                    onClick={() => changeFontSize(fontSize - 1)}
                    className="grid size-8 place-items-center rounded-full font-semibold transition-colors hover:bg-current/10 disabled:opacity-40 pointer-coarse:size-11"
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    aria-label={`${t('settings.reading.fontSize')} +`}
                    disabled={fontSize >= FONT_RANGE.max}
                    onClick={() => changeFontSize(fontSize + 1)}
                    className="grid size-8 place-items-center rounded-full font-semibold transition-colors hover:bg-current/10 disabled:opacity-40 pointer-coarse:size-11"
                  >
                    A+
                  </button>
                  <ProgressBar
                    value={62}
                    tone="orange"
                    size="sm"
                    label="Tiến độ đọc mẫu"
                    className="ml-auto max-w-24"
                  />
                  <span className="ml-2 tabular-nums">62%</span>
                </div>
              </Card>
            )}
            {section === 'listening' && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <strong className="text-sm">{t('settings.preview.narrator')}</strong>
                  <span className="text-xs font-semibold text-orange-strong">
                    {speed}× {t('settings.preview.cadence')}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                    <Headphones aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm">The Silver Compass (Audio)</strong>
                    <ProgressBar value={42} size="sm" label="Tiến độ nghe mẫu" className="mt-2" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudioPlaying((value) => !value)}
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-[0_10px_24px_-14px_var(--primary)] transition-transform active:scale-[0.96]"
                    aria-label={t(
                      audioPlaying ? 'settings.preview.pause' : 'settings.preview.play',
                    )}
                  >
                    {audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                </div>
              </Card>
            )}
            <Card className="border-hairline bg-elevated">
              <p className="text-h3 font-medium italic text-brand-strong">
                “Những câu chuyện hay làm ngày mai thêm tử tế.”
              </p>
              <p className="mt-3 text-caption text-ink/70">
                Mỗi lựa chọn về cỡ chữ và tông nền đều tạo nên sự gần gũi cho không gian đọc của
                bạn.
              </p>
            </Card>
          </aside>
        )}
      </div>
      {!saved && (
        <section
          aria-label={t(isSettings ? 'settings.preferencesUnsaved' : 'settings.profileUnsaved')}
          className="nh-dialog-enter sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 mt-8 rounded-3xl border border-line bg-surface p-4 shadow-soft sm:p-5"
        >
          <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-caption text-muted">
              {t(isSettings ? 'settings.preferencesUnsaved' : 'settings.profileUnsaved')}
            </p>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="secondary" onClick={discard}>
                {t('common.discard')}
              </Button>
              <Button className="flex-1 sm:flex-none" onClick={save}>
                <Save size={15} aria-hidden="true" />
                {t('common.saveChanges')}
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/* Field placeholder: label line above a pill input of the given height. */
function FieldSkeleton({ control = 'h-11', className = '' }) {
  return (
    <div className={className}>
      <span className="flex h-5 items-center">
        <Skeleton className="h-3 w-24" />
      </span>
      <Skeleton className={`mt-2 w-full rounded-3xl ${control}`} />
    </div>
  );
}

/*
 * Placeholder for the profile form (avatar, fields, bio, genres) or a settings panel plus its
 * preview aside, sized to the loaded panels so nothing jumps when preferences arrive.
 */
function PreferencesSkeleton({ isSettings }) {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải tùy chọn đã lưu"
      className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4"
    >
      <Card as="div" aria-hidden="true" className={isSettings ? 'min-h-[27rem]' : ''}>
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-2xl" />
          <span className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </span>
        </div>
        {isSettings ? (
          <>
            <div className="mt-6 flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="mt-4 h-2 w-full" />
            <Skeleton className="mt-8 h-3.5 w-28" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-14 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="mt-6 h-3.5 w-28" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-12 rounded-2xl" />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-4">
              <Skeleton className="size-20 shrink-0" />
              <span className="space-y-3">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-3 w-44" />
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <FieldSkeleton control="h-24" className="mt-4" />
            <span className="mt-1 flex h-5 items-center justify-end">
              <Skeleton className="h-3 w-12" />
            </span>
            <span className="mt-4 flex h-5 items-center">
              <Skeleton className="h-3.5 w-32" />
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-9 w-24" />
              ))}
            </div>
          </>
        )}
      </Card>
      {isSettings && (
        <div aria-hidden="true" className="min-w-0 space-y-5">
          <Card as="div" className="min-h-[26rem]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="mt-6 h-2.5 w-36" />
            <Skeleton className="mt-3 h-5 w-48" />
            <SkeletonText lines={5} className="mt-5" />
            <Skeleton className="mt-8 h-8 w-full" />
          </Card>
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      )}
    </div>
  );
}
