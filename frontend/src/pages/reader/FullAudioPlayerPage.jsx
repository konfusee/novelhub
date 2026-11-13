import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import {
  AlertTriangle,
  BookOpen,
  Check,
  Headphones,
  Info,
  ListMusic,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  SkipBack,
  SkipForward,
  UserRound,
  Volume2,
  X,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
} from '../../components/ui'
import { ReaderRange } from '../../components/reader/ReaderSettings'
import { ReadListenSwitch } from '../../components/reader/ReadListenSwitch'
import { chapterLabel } from '../../components/reader/chapterLabel'
import { paragraphAtTime, timeAtParagraph } from '../../components/reader/readingPoint'
import { StoryCover } from '../../components/story/StoryCover'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import {
  NARRATION_POLL_MS,
  fetchNarration,
  narrationSource,
  saveListenProgress,
  startNarration,
} from '../../api/narration'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const SKIP_SECONDS = 15
const SPEEDS = [1, 1.25, 1.5, 2]
/* Listening progress is saved at most every few seconds while playing, and on every stop. */
const SAVE_INTERVAL = 5000
const NO_CHAPTERS = Object.freeze([])
const formatTime = seconds => {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
const tenths = value => Math.round(value * 10) / 10
const finiteDuration = audio =>
  Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0

/* Chapter API error → page state (same mapping as the reading canvas). */
const chapterFailure = error =>
  error?.status === 401
    ? 'login'
    : error?.status === 403 && error.code === 'chapter_locked'
      ? 'locked'
      : error?.status === 404 || error?.status === 400
        ? 'missing'
        : 'error'
/*
 * Narration API error → player state. The provider not being configured arrives as HTTP 503
 * (5xx codes are masked by the server), so the status alone selects the "not ready" notice.
 */
const narrationFailure = error =>
  error?.status === 503 ? { status: 'unavailable' } : { status: 'error', message: error?.message }

/* GET /catalog/stories/:story/chapters/:chapter: canonical ids, title, story and prev/next. */
function useChapter(storyId, chapterId) {
  const key = `${storyId}/${chapterId}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, attempt: -1, status: 'loading', chapter: null })
  useEffect(() => {
    const controller = new AbortController()
    apiRequest(
      `/catalog/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}`,
      { signal: controller.signal },
    )
      .then(({ chapter }) => {
        if (!controller.signal.aborted) setState({ key, attempt, status: 'ready', chapter })
      })
      .catch(error => {
        if (!controller.signal.aborted)
          setState({ key, attempt, status: chapterFailure(error), chapter: null })
      })
    return () => controller.abort()
  }, [key, storyId, chapterId, attempt])
  const retry = useCallback(() => setAttempt(value => value + 1), [])
  const current =
    state.key === key && state.attempt === attempt ? state : { status: 'loading', chapter: null }
  return { status: current.status, chapter: current.chapter, retry }
}

export function FullAudioPlayerPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const { storyId, chapterId } = useParams()
  const { status, chapter, retry } = useChapter(storyId, chapterId)
  /* Story context: cover, author and the chapter queue (with lock state). */
  const detail = useBackendDocument(`/catalog/stories/${encodeURIComponent(storyId)}`, null)
  const story = detail.data?.story ?? chapter?.story ?? null
  const chapters = detail.data?.chapters ?? NO_CHAPTERS
  const canonicalStoryId = chapter?.story?.id ?? detail.data?.story?.id ?? null
  const [prefs, setPrefs] = useState({ speed: 1, volume: 100, muted: false, autoContinue: true })
  const [toast, setToast] = useState('')
  /* Saved point of this story (`resume` of GET /reader/progress/:story), read or listened. */
  const [progress, setProgress] = useState({ storyId: null, resume: null })
  const [resumeUsed, setResumeUsed] = useState(null)
  const [updatedDismissed, setUpdatedDismissed] = useState(false)

  useEffect(() => {
    if (!canonicalStoryId) return undefined
    const controller = new AbortController()
    apiRequest(`/reader/progress/${encodeURIComponent(canonicalStoryId)}`, {
      signal: controller.signal,
    })
      .then(response => {
        if (!controller.signal.aborted)
          setProgress({ storyId: canonicalStoryId, resume: response?.resume ?? null })
      })
      .catch(() => {
        if (!controller.signal.aborted) setProgress({ storyId: canonicalStoryId, resume: null })
      })
    return () => controller.abort()
  }, [canonicalStoryId])
  useEffect(() => {
    if (!toast) return undefined
    const hide = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(hide)
  }, [toast])

  /* undefined while the saved point loads; null when there is nothing to resume here. */
  const saved = progress.storyId === canonicalStoryId ? progress.resume : undefined
  const savedHere = chapter && saved?.chapterId === chapter.id ? saved : null
  const resume =
    saved === undefined ? undefined : savedHere && resumeUsed !== chapter.id ? savedHere : null
  const showUpdated = Boolean(savedHere?.contentUpdated) && !updatedDismissed

  const goToChapter = useCallback(
    (link, autoplay = false) => {
      if (!link || link.locked) return
      navigate(ROUTES.listen(storyId, link.id), autoplay ? { state: { autoplay: true } } : {})
    },
    [navigate, storyId],
  )
  const markResumeUsed = useCallback(id => setResumeUsed(id), [])
  const saveFailed = useCallback(() => setToast(t('listen.progressError')), [t])
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: story?.title, url: window.location.href })
      else {
        await navigator.clipboard?.writeText(window.location.href)
        setToast(t('listen.linkCopied'))
      }
    } catch {
      /* The share sheet was dismissed. */
    }
  }
  const activeId = chapter?.id ?? chapterId
  const total = chapters.length || null

  return (
    <ReaderLayout>
      <div className="page-reader py-6 sm:py-8">
        <div className="nh-grid-12 grid gap-6 nh-layout-xl-7-5">
          <Card className="p-4 sm:p-7">
            <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:gap-4">
              <nav aria-label={t('listen.breadcrumb')} className="min-w-0 sm:flex-1">
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
                  <li>{t('listen.room')}</li>
                  <li aria-hidden="true">/</li>
                  <li className="min-w-0">
                    {story ? (
                      <Link to={ROUTES.story(storyId)} className="hover:text-brand-strong">
                        {story.title}
                      </Link>
                    ) : (
                      <Skeleton className="inline-block h-3 w-28" />
                    )}
                  </li>
                  {chapter && (
                    <>
                      <li aria-hidden="true">/</li>
                      <li aria-current="page" className="font-semibold text-ink">
                        {chapterLabel(t, chapter)}
                      </li>
                    </>
                  )}
                </ol>
              </nav>
              <div className="flex items-center gap-2">
                <ReadListenSwitch storyId={storyId} chapterId={activeId} mode="listen" />
                <IconButton label={t('listen.share')} size="sm" shape="circle" onClick={share}>
                  <Share2 size={15} />
                </IconButton>
              </div>
            </div>
            {status === 'ready' ? (
              <NarrationPlayer
                key={chapter.id}
                storyId={chapter.story?.id ?? canonicalStoryId ?? storyId}
                chapter={chapter}
                story={story}
                total={total}
                resume={resume}
                onResumeApplied={markResumeUsed}
                notice={
                  showUpdated && (
                    <div
                      role="status"
                      className="mt-6 flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink"
                    >
                      <Info
                        size={16}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-brand-strong"
                      />
                      <p className="min-w-0 flex-1 leading-6">{t('listen.contentUpdated')}</p>
                      <IconButton
                        label={t('listen.dismiss')}
                        shape="circle"
                        size="sm"
                        onClick={() => setUpdatedDismissed(true)}
                      >
                        <X size={14} />
                      </IconButton>
                    </div>
                  )
                }
                autoplay={Boolean(location.state?.autoplay)}
                prefs={prefs}
                setPrefs={setPrefs}
                onNavigate={goToChapter}
                onSaveError={saveFailed}
                t={t}
              />
            ) : status === 'loading' ? (
              <PlayerSkeleton t={t} />
            ) : (
              <ChapterNotice
                status={status}
                storyId={storyId}
                chapterId={chapterId}
                onRetry={retry}
                t={t}
              />
            )}
          </Card>
          <aside>
            <ChapterQueue
              detail={detail}
              chapters={chapters}
              activeId={activeId}
              onSelect={goToChapter}
              t={t}
            />
          </aside>
        </div>
        {toast && (
          <div
            role="status"
            className="nh-fade-enter fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-page shadow-float"
          >
            <Check size={14} aria-hidden="true" />
            {toast}
          </div>
        )}
      </div>
    </ReaderLayout>
  )
}

/*
 * One chapter's narration, keyed by the canonical chapter id so every chapter starts fresh:
 * GET status → (Play) POST → poll every 3 s while processing → <audio> once available.
 * Listening progress is PUT in audio mode while playing (≤ every 5 s), on pause, seek end,
 * pagehide and unmount; `completed` when the track ends.
 */
function NarrationPlayer({
  storyId,
  chapter,
  story,
  total,
  resume,
  onResumeApplied,
  notice,
  autoplay,
  prefs,
  setPrefs,
  onNavigate,
  onSaveError,
  t,
}) {
  const chapterId = chapter.id
  const audioRef = useRef(null)
  const aliveRef = useRef(true)
  const wantPlayRef = useRef(autoplay)
  const autoStartRef = useRef(autoplay)
  const primedRef = useRef(false)
  const resumeRef = useRef(resume)
  const saverRef = useRef({ touched: false, lastAt: 0, sent: null, snapshot: null })
  const latest = useRef({ prefs, next: chapter.next })
  const [narration, setNarration] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ended, setEnded] = useState(false)
  const [audioFailed, setAudioFailed] = useState(false)
  const phase = audioFailed ? 'error' : narration.status
  const available = phase === 'available'
  const ready = available && duration > 0
  const { prev, next } = chapter

  useEffect(() => {
    latest.current = { prefs, next }
  })
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  /* Status on arrival (and on "Thử lại" after a load error). */
  useEffect(() => {
    const controller = new AbortController()
    fetchNarration(storyId, chapterId, { signal: controller.signal })
      .then(view => {
        if (!controller.signal.aborted) setNarration(view)
      })
      .catch(error => {
        if (!controller.signal.aborted) setNarration(narrationFailure(error))
      })
    return () => controller.abort()
  }, [storyId, chapterId, attempt])
  /* While processing: re-read the status every 3 s; stops on status change or unmount. */
  useEffect(() => {
    if (narration.status !== 'processing') return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchNarration(storyId, chapterId, { signal: controller.signal })
        .then(view => {
          if (!controller.signal.aborted) setNarration(view)
        })
        .catch(error => {
          if (!controller.signal.aborted) setNarration(narrationFailure(error))
        })
    }, NARRATION_POLL_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [narration, storyId, chapterId])

  /* POST: first play generates the audio; after `failed` it retries. Playback follows. */
  const start = useCallback(() => {
    wantPlayRef.current = true
    setBusy(true)
    startNarration(storyId, chapterId)
      .then(view => {
        if (aliveRef.current) setNarration(view)
      })
      .catch(error => {
        if (aliveRef.current) setNarration(narrationFailure(error))
      })
      .finally(() => {
        if (aliveRef.current) setBusy(false)
      })
  }, [storyId, chapterId])
  /* Auto-continue from the previous chapter: generate on arrival when needed. */
  useEffect(() => {
    if (narration.status !== 'none' || !autoStartRef.current) return
    autoStartRef.current = false
    start()
  }, [narration.status, start])
  const reload = () => {
    setAudioFailed(false)
    setNarration({ status: 'loading' })
    setAttempt(value => value + 1)
  }

  const save = useCallback(() => {
    const saver = saverRef.current
    const entry = saver.snapshot
    if (!saver.touched || !entry) return
    const sent = saver.sent
    if (sent && sent.audioSeconds === entry.audioSeconds && sent.completed === entry.completed)
      return
    saver.sent = entry
    saver.lastAt = Date.now()
    saveListenProgress({ storyId, chapterId, ...entry }).catch(() => onSaveError())
  }, [storyId, chapterId, onSaveError])
  useEffect(() => {
    const onPageHide = () => save()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save()
    }
    addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      save()
    }
  }, [save])
  /* Playback second, plus the paragraph it falls in so reading can continue from there. */
  const capture = audio => {
    const length = finiteDuration(audio)
    saverRef.current.snapshot = {
      paragraph: paragraphAtTime(chapter.blocks, audio.currentTime, length),
      paragraphCount: chapter.blocks.length,
      audioSeconds: tenths(audio.currentTime),
      duration: length ? tenths(length) : null,
      completed: audio.ended,
    }
  }

  const play = useCallback(audio => {
    const result = audio.play()
    result?.catch?.(() => {
      if (aliveRef.current) setPlaying(false)
    })
  }, [])
  /*
   * Once metadata and the saved point are known: seek to it once, then honour a pending Play.
   * The exact second when this chapter was last listened to, else where the saved paragraph starts.
   */
  const prime = useCallback(() => {
    const audio = audioRef.current
    const saved = resumeRef.current
    if (primedRef.current || !audio || audio.readyState < 1 || saved === undefined) return
    primedRef.current = true
    if (saved) {
      const length = finiteDuration(audio)
      const target = saved.contentUpdated
        ? 0
        : (saved.audioSeconds ?? timeAtParagraph(chapter.blocks, saved.paragraph, length))
      if (target > 0 && (!length || target < length - 1)) audio.currentTime = target
      onResumeApplied(chapterId)
    }
    if (wantPlayRef.current) {
      wantPlayRef.current = false
      play(audio)
    }
  }, [chapter.blocks, chapterId, onResumeApplied, play])
  useEffect(() => {
    resumeRef.current = resume
    prime()
  }, [resume, prime])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.defaultPlaybackRate = prefs.speed
    audio.playbackRate = prefs.speed
    audio.volume = prefs.volume / 100
    audio.muted = prefs.muted
  }, [prefs.speed, prefs.volume, prefs.muted, available])

  const togglePlay = () => {
    if (phase === 'none') {
      start()
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    if (!primedRef.current) {
      wantPlayRef.current = true
      return
    }
    setEnded(false)
    if (audio.ended) audio.currentTime = 0
    play(audio)
  }
  const seek = seconds => {
    const audio = audioRef.current
    if (!audio || !ready) return
    const target = Math.min(duration, Math.max(0, seconds))
    saverRef.current.touched = true
    audio.currentTime = target
    setTime(target)
    setEnded(false)
  }
  const audioEvents = {
    onLoadedMetadata: event => {
      const audio = event.currentTarget
      audio.defaultPlaybackRate = latest.current.prefs.speed
      audio.playbackRate = latest.current.prefs.speed
      setDuration(finiteDuration(audio))
      prime()
    },
    onDurationChange: event => setDuration(finiteDuration(event.currentTarget)),
    onTimeUpdate: event => {
      const audio = event.currentTarget
      setTime(audio.currentTime)
      capture(audio)
      if (!audio.paused && Date.now() - saverRef.current.lastAt >= SAVE_INTERVAL) save()
    },
    onPlay: () => {
      saverRef.current.touched = true
      setPlaying(true)
      setEnded(false)
    },
    onPause: event => {
      setPlaying(false)
      capture(event.currentTarget)
      save()
    },
    onSeeked: event => {
      setTime(event.currentTarget.currentTime)
      capture(event.currentTarget)
      save()
    },
    onEnded: event => {
      capture(event.currentTarget)
      save()
      setPlaying(false)
      setEnded(true)
      const { prefs: current, next: following } = latest.current
      if (current.autoContinue && following && !following.locked) onNavigate(following, true)
    },
    onError: () => {
      setPlaying(false)
      setAudioFailed(true)
    },
  }

  const phaseLabel = {
    loading: t('listen.loadingStatus'),
    none: t('listen.ready'),
    processing: t('listen.generating'),
    available: playing ? t('listen.playing') : t('listen.paused'),
    failed: t('listen.failedTitle'),
    unavailable: t('listen.unavailableTitle'),
    error: t('listen.errorTitle'),
  }[phase]
  const label = chapterLabel(t, chapter)
  const generating = phase === 'processing' || busy
  const canPlay = !generating && (phase === 'none' || available)
  const playLabel = playing ? t('listen.pause') : t('listen.play')
  const genre = story?.genres?.[0] ?? story?.genre

  return (
    <>
      {/*
       * Phones: small cover beside the title and the now-playing card full width below
       * (the right column dissolves into the grid), so the transport stays near the fold.
       */}
      <section className="nh-grid-12 mt-7 grid gap-x-4 gap-y-5 nh-layout-md-4-8 sm:gap-6">
        <StoryCover
          eager
          story={story ?? { title: chapter.story?.title, author: chapter.story?.author }}
          className="aspect-[3/4] w-full rounded-3xl shadow-soft max-md:col-span-4 max-md:rounded-2xl"
        />
        <div className="flex min-w-0 flex-col justify-center max-md:contents">
          <div className="min-w-0 max-md:col-span-8 max-md:self-center">
            <div className="flex flex-wrap gap-2">
              {genre && <Badge tone="orange">{genre}</Badge>}
              {chapter.orderKey && total ? (
                <Badge>{t('reader.chapterOfTotal', { number: chapter.orderKey, total })}</Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-h2 sm:mt-4 md:text-h1">
              {story?.title ?? chapter.story?.title}
            </h1>
            <p className="mt-1 text-base font-semibold text-brand-strong sm:mt-2 md:text-h3">
              {story?.author ?? chapter.story?.author}
            </p>
            <p className="mt-3 hidden max-w-prose text-sm leading-6 text-muted sm:block">
              {t('listen.voiceNote')}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-hairline bg-elevated p-4 max-md:col-span-12 md:mt-5">
            <p role="status" className="flex items-center gap-2 text-caption text-ink/70">
              {generating && <Spinner />}
              {busy && phase === 'none' ? t('listen.generating') : phaseLabel}
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <strong className="min-w-0 text-base">{label}</strong>
              {duration > 0 && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-orange-strong">
                  {formatTime(duration)}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
      {notice}
      <section
        aria-label={t('listen.controls')}
        aria-busy={phase === 'loading' || generating || undefined}
        className="mt-6 sm:mt-8"
      >
        {available && (
          <audio
            ref={audioRef}
            src={narrationSource(narration.audioUrl)}
            preload="metadata"
            aria-label={t('listen.audioLabel', { chapter: label })}
            {...audioEvents}
          />
        )}
        <PlayerStatus
          phase={phase}
          narration={narration}
          busy={busy}
          ready={ready}
          time={time}
          duration={duration}
          playing={playing}
          seek={seek}
          onRetry={start}
          onReload={reload}
          readHref={ROUTES.read(storyId, chapterId)}
          t={t}
        />
        <div className="mt-6 flex items-center justify-center gap-1 min-[360px]:gap-2 sm:gap-4">
          <TransportButton
            label={t(prev?.locked ? 'listen.previousLocked' : 'listen.previous')}
            disabled={!prev || prev.locked}
            onClick={() => onNavigate(prev, playing)}
          >
            <SkipBack size={21} />
          </TransportButton>
          <IconButton
            label={t('listen.skipBack', { seconds: SKIP_SECONDS })}
            shape="circle"
            disabled={!ready}
            onClick={() => seek(time - SKIP_SECONDS)}
          >
            <RotateCcw size={20} />
          </IconButton>
          <button
            type="button"
            aria-label={playLabel}
            title={phase === 'none' ? t('listen.firstPlayHint') : playLabel}
            disabled={!canPlay}
            onClick={togglePlay}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-orange text-on-orange shadow-[0_14px_30px_-14px_var(--accent-orange)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 min-[360px]:size-16"
          >
            {playing ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}
          </button>
          <IconButton
            label={t('listen.skipForward', { seconds: SKIP_SECONDS })}
            shape="circle"
            disabled={!ready}
            onClick={() => seek(time + SKIP_SECONDS)}
          >
            <RotateCw size={20} />
          </IconButton>
          <TransportButton
            label={t(next?.locked ? 'listen.nextLocked' : 'listen.next')}
            disabled={!next || next.locked}
            onClick={() => onNavigate(next, playing)}
          >
            <SkipForward size={21} />
          </TransportButton>
        </div>
        {ended && !(prefs.autoContinue && next && !next.locked) && (
          <div
            role="status"
            className="mt-5 flex flex-col items-center gap-3 rounded-2xl bg-elevated px-4 py-3 text-center text-sm text-muted sm:flex-row sm:justify-between sm:text-left"
          >
            <span>
              {!next
                ? t('listen.storyEnd')
                : next.locked
                  ? t('listen.nextLockedNote', { chapter: chapterLabel(t, next) })
                  : t('listen.chapterEnded')}
            </span>
            {next && !next.locked && (
              <Button size="sm" onClick={() => onNavigate(next, true)}>
                <Headphones size={15} aria-hidden="true" />
                {t('listen.listenNext')}
              </Button>
            )}
          </div>
        )}
        <div className="mt-8 space-y-3 border-t border-hairline pt-6">
          <ControlPills
            label={t('listen.speed')}
            options={SPEEDS.map(value => [`${value}x`, value])}
            value={prefs.speed}
            onChange={speed => setPrefs(current => ({ ...current, speed }))}
          />
          <div className="flex items-center gap-3 rounded-full bg-elevated py-1 pl-1.5 pr-4">
            <TransportButton
              small
              label={prefs.muted ? t('listen.unmute') : t('listen.mute')}
              pressed={prefs.muted}
              onClick={() => setPrefs(current => ({ ...current, muted: !current.muted }))}
            >
              <Volume2 size={17} />
            </TransportButton>
            <ReaderRange
              label={t('listen.volume')}
              min={0}
              max={100}
              value={prefs.muted ? 0 : prefs.volume}
              valueText={`${prefs.muted ? 0 : prefs.volume}%`}
              onChange={volume =>
                setPrefs(current => ({ ...current, volume, muted: volume === 0 }))
              }
            />
            <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
              {prefs.muted ? 0 : prefs.volume}%
            </span>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-full bg-elevated py-1.5 pl-4 pr-2 text-xs font-semibold text-ink/80">
            {t('listen.autoContinue')}
            <input
              type="checkbox"
              role="switch"
              checked={prefs.autoContinue}
              onChange={event =>
                setPrefs(current => ({ ...current, autoContinue: event.target.checked }))
              }
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 shrink-0 rounded-full bg-ink/15 transition-colors peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/30 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-surface after:shadow-whisper after:transition-transform peer-checked:after:translate-x-4"
            />
          </label>
        </div>
      </section>
    </>
  )
}

/* Seek bar / generation / failure area above the transport, per narration phase. */
function PlayerStatus({
  phase,
  narration,
  busy,
  ready,
  time,
  duration,
  playing,
  seek,
  onRetry,
  onReload,
  readHref,
  t,
}) {
  if (phase === 'failed')
    return (
      <EmptyState
        tone="rose"
        icon={AlertTriangle}
        headingAs="h2"
        title={t('listen.failedTitle')}
        description={narration.failure?.message || t('listen.failedDescription')}
        action={
          narration.failure?.retryable !== false && (
            <Button variant="secondary" disabled={busy} onClick={onRetry}>
              {t('listen.retry')}
            </Button>
          )
        }
        className="py-6"
      />
    )
  if (phase === 'unavailable')
    return (
      <EmptyState
        icon={Headphones}
        title={t('listen.unavailableTitle')}
        description={t('listen.unavailableDescription')}
        action={
          <ButtonLink variant="secondary" to={readHref}>
            <BookOpen size={16} aria-hidden="true" />
            {t('listen.readInstead')}
          </ButtonLink>
        }
        className="py-6"
      />
    )
  if (phase === 'error')
    return (
      <EmptyState
        tone="rose"
        icon={AlertTriangle}
        title={t('listen.errorTitle')}
        description={narration.message || t('listen.errorDescription')}
        action={
          <Button variant="secondary" onClick={onReload}>
            {t('listen.retry')}
          </Button>
        }
        className="py-6"
      />
    )
  if (phase === 'none' || phase === 'processing')
    return (
      <p className="flex min-h-[3.75rem] items-center justify-center rounded-2xl bg-elevated px-4 text-center text-sm leading-6 text-muted">
        {phase === 'processing' || busy ? t('listen.generatingHint') : t('listen.firstPlayHint')}
      </p>
    )
  if (phase === 'available' && ready)
    return (
      <>
        <div className="flex items-center justify-between gap-3 text-xs tabular-nums">
          <strong className="text-ink">{formatTime(time)}</strong>
          <span className="flex min-w-0 items-center gap-1.5 text-ink/70">
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${playing ? 'bg-brand' : 'bg-ink/30'}`}
            />
            <span className="truncate">{t('listen.voice')}</span>
          </span>
          <span className="text-ink/70">−{formatTime(duration - time)}</span>
        </div>
        <ReaderRange
          label={t('listen.progress')}
          tone="orange"
          min={0}
          max={duration}
          value={Math.min(time, duration)}
          valueText={t('listen.position', {
            current: formatTime(time),
            total: formatTime(duration),
          })}
          onChange={seek}
          className="mt-2"
        />
      </>
    )
  return (
    <div aria-hidden="true">
      <span className="flex h-4 items-center justify-between gap-3">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-10" />
      </span>
      <span className="mt-2 flex h-7 items-center px-2">
        <Skeleton className="h-1.5 w-full" />
      </span>
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  )
}

/* Cover, title and transport placeholders while the chapter loads. */
function PlayerSkeleton({ t }) {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        {t('listen.loadingChapter')}
      </span>
      <div
        aria-hidden="true"
        className="nh-grid-12 mt-7 grid gap-x-4 gap-y-5 nh-layout-md-4-8 sm:gap-6"
      >
        <Skeleton className="aspect-[3/4] w-full rounded-3xl max-md:col-span-4 max-md:rounded-2xl" />
        <div className="flex min-w-0 flex-col justify-center gap-3 max-md:col-span-8">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
      <div aria-hidden="true" className="mt-8 space-y-4">
        <Skeleton className="h-1.5 w-full" />
        <span className="flex justify-center">
          <Skeleton className="size-16 rounded-full" />
        </span>
      </div>
    </div>
  )
}

/* Signed-out, locked, missing or failed chapter: what the listener can do next. */
function ChapterNotice({ status, storyId, chapterId, onRetry, t }) {
  const location = useLocation()
  const storyLink = (
    <ButtonLink variant="secondary" size="sm" to={ROUTES.story(storyId)}>
      {t('listen.backToStory')}
    </ButtonLink>
  )
  const notices = {
    login: {
      icon: UserRound,
      title: t('listen.loginTitle'),
      description: t('listen.loginDescription'),
      action: (
        <ButtonLink size="sm" to={ROUTES.login} state={{ from: location.pathname }}>
          {t('listen.login')}
        </ButtonLink>
      ),
    },
    locked: {
      icon: LockKeyhole,
      title: t('listen.lockedTitle'),
      description: t('listen.lockedDescription'),
      action: (
        <>
          <ButtonLink size="sm" to={ROUTES.read(storyId, chapterId)}>
            {t('listen.unlockInReader')}
          </ButtonLink>
          {storyLink}
        </>
      ),
    },
    missing: {
      icon: BookOpen,
      title: t('listen.missingTitle'),
      description: t('listen.missingDescription'),
      action: storyLink,
    },
    error: {
      icon: AlertTriangle,
      tone: 'rose',
      title: t('listen.chapterErrorTitle'),
      description: t('listen.errorDescription'),
      action: (
        <Button variant="secondary" onClick={onRetry}>
          {t('listen.retry')}
        </Button>
      ),
    },
  }
  const notice = notices[status] ?? notices.error
  return (
    <EmptyState
      tone={notice.tone}
      icon={notice.icon}
      title={notice.title}
      description={notice.description}
      action={notice.action}
      className="py-12"
    />
  )
}

/* The story's chapter list as the listening queue; locked chapters are shown but not playable. */
function ChapterQueue({ detail, chapters, activeId, onSelect, t }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h3">{t('listen.queue')}</h2>
          {chapters.length > 0 && (
            <p className="mt-0.5 text-caption text-muted">
              {t('listen.queueCount', { count: chapters.length })}
            </p>
          )}
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
          <ListMusic size={18} aria-hidden="true" />
        </span>
      </div>
      {detail.status === 'loading' ? (
        <ul aria-hidden="true" className="mt-5 space-y-3">
          {[0, 1, 2, 3].map(item => (
            <li key={item} className="flex items-center gap-3 p-3">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </li>
          ))}
        </ul>
      ) : detail.status === 'error' ? (
        <div className="mt-5 flex flex-col items-start gap-3 text-sm text-muted">
          <p role="alert">{t('listen.queueError')}</p>
          <Button variant="secondary" size="sm" onClick={detail.retry}>
            {t('listen.retry')}
          </Button>
        </div>
      ) : (
        <ol className="-mx-1 mt-5 max-h-[540px] space-y-1 overflow-y-auto overscroll-contain px-1">
          {chapters.map(item => {
            const active = item.id === activeId
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  disabled={item.locked}
                  onClick={() => !active && onSelect(item)}
                  className={`relative flex w-full items-center gap-3 whitespace-normal rounded-2xl p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-orange/14' : 'hover:bg-ink/5'}`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-3 left-0 w-1 rounded-full bg-orange"
                    />
                  )}
                  {item.locked ? (
                    <LockKeyhole size={18} aria-hidden="true" className="shrink-0 text-muted" />
                  ) : active ? (
                    <Volume2 size={18} aria-hidden="true" className="shrink-0 text-orange-strong" />
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-xs tabular-nums">
                      {item.orderKey}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <strong
                      className={`line-clamp-2 block text-sm ${active ? 'text-orange-strong' : 'text-ink'}`}
                    >
                      {chapterLabel(t, item)}
                    </strong>
                    <span className="text-xs text-muted">
                      {item.locked
                        ? t('listen.queueLocked')
                        : active
                          ? t('listen.queueCurrent')
                          : t('listen.queueReady')}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

function TransportButton({ label, pressed, small = false, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`grid shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35 ${small ? 'size-9 pointer-coarse:size-11' : 'size-11'} ${pressed ? 'bg-brand/12 text-brand-strong' : 'text-ink/75 hover:bg-ink/6 hover:text-ink'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function ControlPills({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="rounded-3xl bg-elevated p-2 sm:flex sm:items-center sm:gap-1 sm:rounded-full sm:px-2 sm:py-1.5"
    >
      <span
        aria-hidden="true"
        className="mb-1.5 block pl-2 text-xs font-semibold text-ink/70 sm:mb-0 sm:mr-1"
      >
        {label}
      </span>
      <div
        className={`grid gap-1.5 sm:flex sm:flex-wrap sm:gap-1 ${options.length > 4 ? 'grid-cols-3' : 'grid-cols-4'}`}
      >
        {options.map(([text, optionValue]) => (
          <button
            type="button"
            key={text}
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={`min-h-10 rounded-full px-3 text-xs font-semibold tabular-nums transition-colors sm:min-h-8 ${value === optionValue ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-ink/6 hover:text-ink'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
