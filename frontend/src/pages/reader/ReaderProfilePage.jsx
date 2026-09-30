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
import { ReaderLayout } from '../../layouts'
import { Avatar, Badge, Button, Card, Input, Tabs } from '../../components/ui'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

export function ReaderProfilePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { currentUser } = useAuth()
  const isSettings = location.pathname.startsWith('/reader/settings')
  const sectionFromPath = location.pathname.split('/').at(-1)
  const section = isSettings && ['reading', 'listening', 'appearance', 'privacy', 'security'].includes(sectionFromPath)
    ? sectionFromPath
    : isSettings ? 'reading' : 'profile'
  const [name, setName] = useState(currentUser?.name || 'NovelHub Reader')
  const [handle, setHandle] = useState(`@${(currentUser?.name || 'novelhub_reader').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
  const [bio, setBio] = useState('Passionate reader of slow-burn fantasy & cozy mysteries. 📚✨')
  const [fontSize, setFontSize] = useState(18)
  const [spacing, setSpacing] = useState(1.8)
  const [canvas, setCanvas] = useState('parchment')
  const [speed, setSpeed] = useState(1)
  const [skip, setSkip] = useState(15)
  const [autoplay, setAutoplay] = useState(true)
  const [saved, setSaved] = useState(true)
  const [genres, setGenres] = useState(['Fantasy', 'Romance', 'Mystery'])
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [twoFactor, setTwoFactor] = useState(false)
  const [notice, setNotice] = useState('')
  const changed = () => setSaved(false)
  const changeSection = value => {
    navigate(`/reader/settings/${value}`)
  }
  const save = () => {
    localStorage.setItem(
      'novelhub.reader.preferences',
      JSON.stringify({ name, handle, bio, genres, fontSize, spacing, canvas, speed, skip, autoplay, twoFactor }),
    )
    setSaved(true)
    setNotice(isSettings ? 'Your preferences were saved.' : 'Your profile was saved.')
  }
  const discard = () => {
    setName(currentUser?.name || 'NovelHub Reader')
    setHandle(`@${(currentUser?.name || 'novelhub_reader').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
    setBio('Passionate reader of slow-burn fantasy & cozy mysteries. 📚✨')
    setGenres(['Fantasy', 'Romance', 'Mystery'])
    setFontSize(18)
    setSpacing(1.8)
    setCanvas('parchment')
    setSpeed(1)
    setSkip(15)
    setAutoplay(true)
    setTwoFactor(false)
    setSaved(true)
    setNotice(isSettings ? 'Unsaved preference changes were discarded.' : 'Unsaved profile changes were discarded.')
  }
  return (
    <ReaderLayout>
      <main className="page-reader pb-12 pt-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-brand">
              {isSettings ? 'Reader preferences' : 'Public identity'} · Reader ID #NV-88291
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {isSettings ? 'Reader Settings' : 'Reader Profile'}
            </h1>
          </div>
          <p className="max-w-md text-sm text-muted">
            {isSettings
              ? 'Configure reading, listening, appearance, privacy, and account safeguards.'
              : 'Manage the identity and interests shown on your NovelHub profile.'}
          </p>
        </div>
        {isSettings && <div className="mt-6 overflow-x-auto">
          <Tabs
            value={section}
            onChange={changeSection}
            items={[
              { value: 'reading', label: 'Reading Preferences' },
              { value: 'listening', label: 'Listening Preferences' },
              { value: 'appearance', label: 'Appearance' },
              { value: 'privacy', label: 'Privacy' },
              { value: 'security', label: 'Security' },
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
                title="Profile Information"
                note="Publicly visible to serial commentators"
              />
              <div className="mt-5 flex items-center gap-4">
                <div className="relative">
                  <Avatar name={name} className="size-20 text-xl" />
                  <button
                    onClick={() => setNotice('Avatar picker opened in demo mode.')}
                    aria-label="Change avatar"
                    className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-brand text-white"
                  >
                    <Camera size={15} />
                  </button>
                </div>
                <div>
                  <Button onClick={() => setNotice('Avatar picker opened in demo mode.')} variant="secondary" className="min-h-9 py-1.5">
                    Upload New Avatar
                  </Button>
                  <p className="mt-2 text-[10px] text-muted">JPG or PNG, minimum 400×400px.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Display Name">
                  <Input
                    value={name}
                    onChange={e => {
                      setName(e.target.value)
                      changed()
                    }}
                  />
                </Field>
                <Field label="User Handle">
                  <Input
                    value={handle}
                    onChange={e => {
                      setHandle(e.target.value)
                      changed()
                    }}
                  />
                </Field>
              </div>
              <Field label="Reader Bio" className="mt-4">
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
                <p className="text-xs font-semibold">Favorite Genres</p>
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
              <SectionTitle icon={BookOpen} title="Reading Settings" note="Typography & canvas" />
              <p className="mt-5 text-xs font-semibold">
                Default Font Size <span className="float-right text-brand">{fontSize}px</span>
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
              <p className="mt-5 text-xs font-semibold">Line Spacing &amp; Rhythm</p>
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
                    note={value === 1.4 ? 'Compact' : value === 1.8 ? 'Relaxed' : 'Spacious'}
                  />
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold">Preferred Reader Canvas</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ['parchment', 'Parchment', '#fcf8f2'],
                  ['cream', 'Soft Cream', '#fffdf9'],
                  ['navy', 'Dark Navy', '#081321'],
                ].map(([value, label, color]) => (
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
                    {label}
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
                title="Listening Preferences"
                note="Audio Lounge & Narration"
              />
              <ControlRow label="Default Playback Speed">
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
              <ControlRow label="Skip Interval">
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
              <ControlRow label="Autoplay Next Chapter">
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
                title="Appearance & Themes"
                note="System chrome & navigation"
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['light', 'Light Theme'],
                  ['dark', 'Dark Theme'],
                  ['system', 'System'],
                ].map(([value, label]) => (
                  <Choice
                    key={value}
                    active={theme === value}
                    onClick={() => {
                      setTheme(value)
                      changed()
                    }}
                    title={label}
                    note={value === 'system' ? 'Follow device' : `${label} palette`}
                  />
                ))}
              </div>
            </Card>
            )}
            {section === 'privacy' && (
            <Card>
              <SectionTitle
                icon={ShieldCheck}
                title="Privacy"
                note="Activity visibility"
              />
              <ControlRow label="Public reading activity">
                <Badge tone="green">Friends only</Badge>
              </ControlRow>
            </Card>
            )}
            {section === 'security' && (
            <Card>
              <SectionTitle
                icon={ShieldCheck}
                title="Security"
                note="Account safeguards"
              />
              <ControlRow label="Two-factor authentication">
                <Button onClick={() => { setTwoFactor(value => !value); setNotice(twoFactor ? 'Two-factor authentication disabled for this demo.' : 'Two-factor authentication enabled for this demo.') }} variant="secondary" className="min-h-9 py-1.5">
                  {twoFactor ? 'Disable' : 'Configure'}
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
                  Live Reader Sample
                </span>
                <Badge tone="green">
                  {fontSize}px · {spacing}×
                </Badge>
              </div>
              <div className="mt-5 border-y border-line py-5">
                <p className="text-[10px] uppercase tracking-[.18em] text-orange">
                  Chapter 14 · The Silver Compass
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
                <strong className="text-sm">Narrator Sync Test</strong>
                <span className="text-xs text-orange">{speed}× Cadence</span>
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
                <button onClick={() => setAudioPlaying(value => !value)} className="grid size-10 place-items-center rounded-full bg-brand text-white" aria-label={audioPlaying ? 'Pause sample' : 'Play sample'}>
                  {audioPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
              </div>
            </Card>
            )}
            {isSettings && <Card className="bg-elevated">
              <p className="text-xl italic text-brand">“Good stories make a kinder tomorrow.”</p>
              <p className="mt-3 text-xs text-muted">
                Every font size nuance and canvas tone you choose shapes the intimacy of your
                reading sanctuary.
              </p>
            </Card>}
          </aside>
        </div>
        <section className="relative z-10 mt-8 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <p className="hidden text-xs text-muted sm:block">
            {saved
              ? isSettings ? 'Preferences saved' : 'Profile saved'
              : isSettings ? 'Unsaved preferences: review your changes.' : 'Unsaved profile changes: review your changes.'}
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="secondary" onClick={discard}>
              Discard
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={save}>
              <Save size={15} />
              Save Changes
            </Button>
          </div>
        </div>
        </section>
      </main>
    </ReaderLayout>
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
