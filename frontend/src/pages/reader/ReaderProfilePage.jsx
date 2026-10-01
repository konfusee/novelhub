import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Camera,
  Check,
  Eye,
  Headphones,
  Palette,
  Pause,
  Play,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts'
import { Avatar, Badge, Button, Card, Input, Tabs } from '../../components/ui'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

const workspaceLayouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
}

export function ReaderProfilePage({ workspace = 'reader' }) {
  const Layout = workspaceLayouts[workspace] || ReaderLayout
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { currentUser } = useAuth()
  const { t } = useLocale()
  const settingsRoot = workspace === 'admin' ? '/admin/preferences' : `/${workspace}/settings`
  const isSettings = location.pathname.startsWith(settingsRoot)
  const sectionFromPath = location.pathname.split('/').at(-1)
  const section = isSettings && ['reading', 'listening', 'appearance', 'privacy', 'security'].includes(sectionFromPath)
    ? sectionFromPath
    : isSettings ? 'reading' : 'profile'
  const [name, setName] = useState(currentUser?.name || 'Độc giả NovelHub')
  const [handle, setHandle] = useState(`@${(currentUser?.name || 'novelhub_reader').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
  const [bio, setBio] = useState('Yêu thích truyện kỳ ảo phát triển chậm và trinh thám chữa lành. 📚✨')
  const [fontSize, setFontSize] = useState(18)
  const [spacing, setSpacing] = useState(1.8)
  const [canvas, setCanvas] = useState('parchment')
  const [speed, setSpeed] = useState(1)
  const [skip, setSkip] = useState(15)
  const [autoplay, setAutoplay] = useState(true)
  const [saved, setSaved] = useState(true)
  const [genres, setGenres] = useState(['Kỳ ảo', 'Lãng mạn', 'Bí ẩn'])
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [twoFactor, setTwoFactor] = useState(false)
  const [notice, setNotice] = useState('')
  const changed = () => setSaved(false)
  const changeSection = value => {
    navigate(`${settingsRoot}/${value}`)
  }
  const save = () => {
    localStorage.setItem(
      'novelhub.user.preferences',
      JSON.stringify({ name, handle, bio, genres, fontSize, spacing, canvas, speed, skip, autoplay, twoFactor }),
    )
    setSaved(true)
    setNotice(t(isSettings ? 'settings.preferencesSavedNotice' : 'settings.profileSavedNotice'))
  }
  const discard = () => {
    setName(currentUser?.name || 'Độc giả NovelHub')
    setHandle(`@${(currentUser?.name || 'novelhub_reader').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
    setBio('Yêu thích truyện kỳ ảo phát triển chậm và trinh thám chữa lành. 📚✨')
    setGenres(['Kỳ ảo', 'Lãng mạn', 'Bí ẩn'])
    setFontSize(18)
    setSpacing(1.8)
    setCanvas('parchment')
    setSpeed(1)
    setSkip(15)
    setAutoplay(true)
    setTwoFactor(false)
    setSaved(true)
    setNotice(t(isSettings ? 'settings.preferencesDiscarded' : 'settings.profileDiscarded'))
  }
  return (
    <Layout>
      <main className={`page-${workspace} pb-12 pt-7`}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-brand">
              {t(isSettings ? 'settings.sharedPreferences' : 'settings.publicIdentity')} · {t('settings.userId', { id: 'NV-88291' })}
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {t(isSettings ? 'settings.title' : 'settings.userProfile')}
            </h1>
          </div>
          <p className="max-w-md text-sm text-muted">
            {isSettings
              ? t('settings.description')
              : t('settings.profileDescription')}
          </p>
        </div>
        {isSettings && <div className="mt-6 overflow-x-auto">
          <Tabs
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
        </div>}
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            {notice && <p role="status" className="rounded-2xl border border-brand/20 bg-brand/10 px-4 py-3 text-xs text-brand">{notice}</p>}
            {section === 'profile' && (
            <Card>
              <SectionTitle
                icon={UserRound}
                title="Thông tin hồ sơ"
                note="Hiển thị công khai với cộng đồng độc giả"
              />
              <div className="mt-5 flex items-center gap-4">
                <div className="relative">
                  <Avatar name={name} className="size-20 text-xl" />
                  <button
                    onClick={() => setNotice('Đã mở trình chọn ảnh đại diện ở chế độ mẫu.')}
                    aria-label="Đổi ảnh đại diện"
                    className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-brand text-white"
                  >
                    <Camera size={15} />
                  </button>
                </div>
                <div>
                  <Button onClick={() => setNotice('Đã mở trình chọn ảnh đại diện ở chế độ mẫu.')} variant="secondary" className="min-h-9 py-1.5">
                    Tải ảnh đại diện mới
                  </Button>
                  <p className="mt-2 text-[10px] text-muted">JPG hoặc PNG, tối thiểu 400×400px.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Tên hiển thị">
                  <Input
                    value={name}
                    onChange={e => {
                      setName(e.target.value)
                      changed()
                    }}
                  />
                </Field>
                <Field label="Tên định danh">
                  <Input
                    value={handle}
                    onChange={e => {
                      setHandle(e.target.value)
                      changed()
                    }}
                  />
                </Field>
              </div>
              <Field label="Tiểu sử độc giả" className="mt-4">
                <textarea
                  value={bio}
                  onChange={e => {
                    setBio(e.target.value)
                    changed()
                  }}
                  maxLength={160}
                  className="min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none focus:border-brand"
                />
                <span className="float-right text-[10px] text-muted">{bio.length} / 160</span>
              </Field>
              <div className="mt-5">
                <p className="text-xs font-semibold">Thể loại yêu thích</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {genres.map(item => (
                    <button type="button" key={item} onClick={() => { setGenres(current => current.filter(genre => genre !== item)); changed() }}>
                      <Badge tone="green">{item} ×</Badge>
                    </button>
                  ))}
                  <button onClick={() => { setGenres(current => current.includes('Sci-Fi') ? current : [...current, 'Sci-Fi']); changed() }} className="rounded-full border border-dashed border-line px-3 py-1 text-xs">
                    + Add Genre
                  </button>
                </div>
              </div>
            </Card>
            )}
            {section === 'reading' && (
            <Card>
              <SectionTitle icon={BookOpen} title={t('settings.reading.title')} note={t('settings.reading.note')} />
              <p className="mt-5 text-xs font-semibold">
                {t('settings.reading.fontSize')} <span className="float-right text-brand">{fontSize}px</span>
              </p>
              <input
                type="range"
                min="14"
                max="24"
                value={fontSize}
                onChange={e => {
                  setFontSize(Number(e.target.value))
                  changed()
                }}
                className="mt-2 w-full accent-brand"
              />
              <p className="mt-5 text-xs font-semibold">{t('settings.reading.lineSpacing')}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[1.4, 1.8, 2.2].map(value => (
                  <Choice
                    key={value}
                    active={spacing === value}
                    onClick={() => {
                      setSpacing(value)
                      changed()
                    }}
                    title={`${value}×`}
                    note={t(value === 1.4 ? 'settings.reading.compact' : value === 1.8 ? 'settings.reading.relaxed' : 'settings.reading.spacious')}
                  />
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold">{t('settings.reading.canvas')}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ['parchment', 'settings.reading.parchment', '#fcf8f2'],
                  ['cream', 'settings.reading.cream', '#fffdf9'],
                  ['navy', 'settings.reading.navy', '#081321'],
                ].map(([value, labelKey, color]) => (
                  <button
                    key={value}
                    onClick={() => {
                      setCanvas(value)
                      changed()
                    }}
                    className={`rounded-2xl border p-3 text-left text-xs ${canvas === value ? 'border-brand' : 'border-line'}`}
                    style={{
                      backgroundColor: color,
                      color: value === 'navy' ? 'white' : '#172033',
                    }}
                  >
                    {t(labelKey)}
                    {canvas === value && <Check size={13} className="float-right" />}
                  </button>
                ))}
              </div>
            </Card>
            )}
            {section === 'listening' && (
            <Card>
              <SectionTitle
                icon={Headphones}
                title={t('settings.listening.title')}
                note={t('settings.listening.note')}
              />
              <ControlRow label={t('settings.listening.speed')}>
                <div className="flex rounded-xl bg-elevated p-1">
                  {[0.8, 1, 1.25, 1.5].map(value => (
                    <button
                      onClick={() => {
                        setSpeed(value)
                        changed()
                      }}
                      key={value}
                      className={`rounded-lg px-3 py-1 text-xs ${speed === value ? 'bg-brand text-white' : ''}`}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
              </ControlRow>
              <ControlRow label={t('settings.listening.skip')}>
                <div className="flex gap-2">
                  {[10, 15, 30].map(value => (
                    <button
                      onClick={() => {
                        setSkip(value)
                        changed()
                      }}
                      key={value}
                      className={`rounded-full border px-3 py-1 text-xs ${skip === value ? 'border-brand bg-brand/10 text-brand' : 'border-line'}`}
                    >
                      {value}s
                    </button>
                  ))}
                </div>
              </ControlRow>
              <ControlRow label={t('settings.listening.autoplay')}>
                <button
                  onClick={() => {
                    setAutoplay(!autoplay)
                    changed()
                  }}
                  className={`h-6 w-11 rounded-full p-1 ${autoplay ? 'bg-brand' : 'bg-line'}`}
                >
                  <span
                    className={`block size-4 rounded-full bg-white transition ${autoplay ? 'translate-x-5' : ''}`}
                  />
                </button>
              </ControlRow>
            </Card>
            )}
            {section === 'appearance' && (
            <Card>
              <SectionTitle
                icon={Palette}
                title={t('settings.appearance.title')}
                note={t('settings.appearance.note')}
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['light', 'settings.appearance.light'],
                  ['dark', 'settings.appearance.dark'],
                  ['system', 'settings.appearance.system'],
                ].map(([value, labelKey]) => (
                  <Choice
                    key={value}
                    active={theme === value}
                    onClick={() => {
                      setTheme(value)
                      changed()
                    }}
                    title={t(labelKey)}
                    note={t(value === 'system' ? 'settings.appearance.followDevice' : 'settings.appearance.palette')}
                  />
                ))}
              </div>
            </Card>
            )}
            {section === 'privacy' && (
            <Card>
              <SectionTitle
                icon={ShieldCheck}
                title={t('settings.privacy.title')}
                note={t('settings.privacy.note')}
              />
              <ControlRow label={t('settings.privacy.activity')}>
                <Badge tone="green">{t('settings.privacy.friendsOnly')}</Badge>
              </ControlRow>
            </Card>
            )}
            {section === 'security' && (
            <Card>
              <SectionTitle
                icon={ShieldCheck}
                title={t('settings.security.title')}
                note={t('settings.security.note')}
              />
              <ControlRow label={t('settings.security.twoFactor')}>
                <Button onClick={() => { setTwoFactor(value => !value); setNotice(t(twoFactor ? 'settings.security.disabledNotice' : 'settings.security.enabledNotice')) }} variant="secondary" className="min-h-9 py-1.5">
                  {t(twoFactor ? 'settings.security.disable' : 'settings.security.configure')}
                </Button>
              </ControlRow>
            </Card>
            )}
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            {isSettings && (section === 'reading' || section === 'appearance') && (
            <Card className={canvas === 'navy' ? 'bg-[#081321] text-white' : 'bg-reader text-ink'}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <Eye size={15} />
                  {t('settings.preview.title')}
                </span>
                <Badge tone="green">
                  {fontSize}px · {spacing}×
                </Badge>
              </div>
              <div className="mt-5 border-y border-line py-5">
                <p className="text-[10px] uppercase tracking-[.18em] text-orange">
                  Chương 14 · The Silver Compass
                </p>
                <h2 className="mt-2 text-lg font-semibold">The Whisper in the Pines</h2>
                <p className="mt-4" style={{ fontSize, lineHeight: spacing }}>
                  The ancient trail curved gently beneath the canopy of silver pines, where twilight
                  pooled in deep amethyst shadows. The story had not ended at the lake.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs">
                <span>A−</span>
                <span>A+</span>
                <div className="ml-auto h-1.5 w-24 rounded-full bg-line">
                  <div className="h-full w-[62%] rounded-full bg-orange" />
                </div>
                <span>62%</span>
              </div>
            </Card>
            )}
            {isSettings && section === 'listening' && (
            <Card>
              <div className="flex items-center justify-between">
                <strong className="text-sm">{t('settings.preview.narrator')}</strong>
                <span className="text-xs text-orange">{speed}× {t('settings.preview.cadence')}</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="grid size-14 place-items-center rounded-xl bg-orange/20">
                  <Headphones />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-xs">The Silver Compass (Audio)</strong>
                  <div className="mt-2 h-1 rounded-full bg-elevated">
                    <div className="h-full w-[42%] bg-brand" />
                  </div>
                </div>
                <button onClick={() => setAudioPlaying(value => !value)} className="grid size-10 place-items-center rounded-full bg-brand text-white" aria-label={t(audioPlaying ? 'settings.preview.pause' : 'settings.preview.play')}>
                  {audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </div>
            </Card>
            )}
            {isSettings && <Card className="bg-elevated">
              <p className="text-xl italic text-brand">“Những câu chuyện hay làm ngày mai thêm tử tế.”</p>
              <p className="mt-3 text-xs text-muted">
                Mỗi lựa chọn về cỡ chữ và tông nền đều tạo nên sự gần gũi cho không gian đọc của bạn.
              </p>
            </Card>}
          </aside>
        </div>
        {!saved && <section className="relative z-10 mt-8 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <p className="hidden text-xs text-muted sm:block">
            {t(saved
              ? isSettings ? 'settings.preferencesSaved' : 'settings.profileSaved'
              : isSettings ? 'settings.preferencesUnsaved' : 'settings.profileUnsaved')}
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="secondary" onClick={discard}>
              {t('common.discard')}
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={save}>
              <Save size={15} />
              {t('common.saveChanges')}
            </Button>
          </div>
        </div>
        </section>}
      </main>
    </Layout>
  )
}

function SectionTitle({ icon: Icon, title, note }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon size={17} className="text-brand" />
        {title}
      </h2>
      <span className="text-[10px] text-muted">{note}</span>
    </div>
  )
}
function Field({ label, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  )
}
function Choice({ active, onClick, title, note }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left ${active ? 'border-brand bg-brand/10' : 'border-line'}`}
    >
      <strong className="block text-xs">
        {title}
        {active && <Check size={13} className="float-right text-brand" />}
      </strong>
      <span className="mt-1 block text-[10px] text-muted">{note}</span>
    </button>
  )
}
function ControlRow({ label, children }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-b border-line pb-4 last:border-0 last:pb-0">
      <span className="text-xs font-semibold">{label}</span>
      {children}
    </div>
  )
}
