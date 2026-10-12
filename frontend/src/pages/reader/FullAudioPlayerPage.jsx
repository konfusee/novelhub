import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AlertTriangle,
  BookMarked,
  Check,
  CheckCircle2,
  Download,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  RotateCw,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
import { Badge, Button, Card, EmptyState, IconButton, Skeleton } from '../../components/ui';
import { useMockResource } from '../../context/MockDataContext';
import { ReaderRange } from '../../components/reader/ReaderSettings';
import { StoryCover } from '../../components/story/StoryCover';
import { ROUTES } from '../../app/routes';
import { audioPlayerData as audio } from '../../data/mock/reader';

const SKIP_SECONDS = 15;
const SPEEDS = [1, 1.25, 1.5, 2];
const TIMERS = [
  ['Tắt', 0],
  ['15 phút', 15],
  ['30 phút', 30],
  ['45 phút', 45],
  ['Hết chương', 'chapter'],
];
const toSeconds = (time) => time.split(':').reduce((total, part) => total * 60 + Number(part), 0);
const formatTime = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
const queueSeconds = audio.queue.reduce((total, [, time]) => total + toSeconds(time), 0);
const queueTotal = `${Math.floor(queueSeconds / 3600)} giờ ${Math.round((queueSeconds % 3600) / 60)} phút`;
const chapterFrom = (chapterId) => {
  const parsed = Number(chapterId?.match(/\d+/)?.[0]);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= audio.queue.length
    ? parsed
    : audio.chapter;
};
/* The demo resumes the featured chapter at 14:32, as the original mock did. */
const resumeAt = (chapter) => (chapter === audio.chapter ? 872 : 0);

export function FullAudioPlayerPage() {
  const navigate = useNavigate();
  const { storyId = 'demo', chapterId } = useParams();
  const chapter = chapterFrom(chapterId);
  const [title, duration] = [audio.queue[chapter - 1][0], toSeconds(audio.queue[chapter - 1][1])];
  /* Track metadata (title, duration, stream) loads per chapter; playback waits for it. */
  const { status: trackStatus, retry: retryTrack } = useMockResource(
    `audio:${storyId}:${chapter}`,
    audio.queue[chapter - 1],
    { isEmpty: (item) => !item },
  );
  const trackReady = trackStatus === 'ready';
  const [playing, setPlaying] = useState(true);
  const [track, setTrack] = useState(() => ({ chapter, seconds: resumeAt(chapter) }));
  const [speed, setSpeed] = useState(1.25);
  const [timer, setTimer] = useState(30);
  const [volume, setVolume] = useState(78);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');
  const position = track.chapter === chapter ? Math.min(track.seconds, duration) : 0;
  const latest = useRef({ position, duration, chapter, repeat, shuffle, timer, trackReady });

  const seek = (seconds) =>
    setTrack({ chapter, seconds: Math.min(duration, Math.max(0, seconds)) });
  const goToChapter = (number) => {
    setTrack({ chapter: number, seconds: 0 });
    navigate(ROUTES.listen(storyId, `chapter-${number}`), { replace: true });
  };

  useEffect(() => {
    latest.current = { position, duration, chapter, repeat, shuffle, timer, trackReady };
  });
  /* Simulated playback clock: advances at the chosen speed and handles chapter end. */
  useEffect(() => {
    if (!playing) return undefined;
    const tick = setInterval(() => {
      const now = latest.current;
      if (!now.trackReady) return;
      const next = now.position + speed;
      if (next < now.duration) {
        setTrack({ chapter: now.chapter, seconds: next });
      } else if (now.repeat) {
        setTrack({ chapter: now.chapter, seconds: 0 });
      } else if (now.timer === 'chapter' || (!now.shuffle && now.chapter >= audio.queue.length)) {
        setTrack({ chapter: now.chapter, seconds: now.duration });
        setPlaying(false);
      } else {
        const following = now.shuffle
          ? ((now.chapter + Math.floor(Math.random() * (audio.queue.length - 1))) %
              audio.queue.length) +
            1
          : now.chapter + 1;
        setTrack({ chapter: following, seconds: 0 });
        navigate(ROUTES.listen(storyId, `chapter-${following}`), { replace: true });
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [playing, speed, navigate, storyId]);
  /* Sleep timer pauses playback after the chosen number of minutes. */
  useEffect(() => {
    if (!playing || typeof timer !== 'number' || timer === 0) return undefined;
    const sleep = setTimeout(() => setPlaying(false), timer * 60 * 1000);
    return () => clearTimeout(sleep);
  }, [playing, timer]);
  useEffect(() => {
    if (!toast) return undefined;
    const hide = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(hide);
  }, [toast]);

  const toggleSaved = () => {
    setSaved((value) => !value);
    setToast(saved ? 'Đã bỏ khỏi thư viện' : 'Đã thêm vào thư viện');
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: audio.title, url: location.href });
      else {
        await navigator.clipboard?.writeText(location.href);
        setToast('Đã sao chép liên kết truyện âm thanh');
      }
    } catch {
      /* The share sheet was dismissed. */
    }
  };
  const togglePlay = () => {
    if (!playing && position >= duration) seek(0);
    setPlaying((value) => !value);
  };

  return (
    <ReaderLayout>
      <div className="page-reader py-6 sm:py-8">
        <div className="nh-grid-12 grid gap-6 nh-layout-xl-7-5">
          <Card className="p-4 sm:p-7">
            <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:gap-4">
              <nav aria-label="Đường dẫn" className="min-w-0 sm:flex-1">
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
                  <li>Phòng nghe</li>
                  <li aria-hidden="true">/</li>
                  <li>{audio.genre}</li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="font-semibold text-ink">
                    {audio.title}
                  </li>
                </ol>
              </nav>
              <div className="flex items-center gap-2">
                <Button
                  variant={saved ? 'outline' : 'secondary'}
                  size="sm"
                  aria-pressed={saved}
                  onClick={toggleSaved}
                >
                  {saved ? <Check size={15} aria-hidden="true" /> : <BookMarked size={15} />}
                  {saved ? 'Đã có trong thư viện' : 'Thêm vào thư viện'}
                </Button>
                <IconButton
                  label="Tải xuống"
                  size="sm"
                  shape="circle"
                  onClick={() => setToast(`Đã thêm chương ${chapter} vào hàng tải xuống`)}
                >
                  <Download size={15} />
                </IconButton>
                <IconButton label="Chia sẻ" size="sm" shape="circle" onClick={share}>
                  <Share2 size={15} />
                </IconButton>
              </div>
            </div>
            {/*
             * Phones: small cover beside the title and the now-playing card full width below
             * (the right column dissolves into the grid), so the transport stays near the fold.
             */}
            <section className="nh-grid-12 mt-7 grid gap-x-4 gap-y-5 nh-layout-md-4-8 sm:gap-6">
              <StoryCover
                eager
                story={{ title: audio.title, author: audio.author, color: audio.color }}
                className="aspect-[3/4] w-full rounded-3xl shadow-soft max-md:col-span-4 max-md:rounded-2xl"
                badge={
                  <span className="absolute inset-x-3 bottom-3 hidden flex-wrap gap-1.5 md:flex">
                    <span className="rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-whisper">
                      Bản thu phòng thu
                    </span>
                    <span className="rounded-full bg-orange px-2.5 py-1 text-xs font-semibold text-on-orange shadow-whisper">
                      Không suy hao
                    </span>
                  </span>
                }
              />
              <div className="flex min-w-0 flex-col justify-center max-md:contents">
                <div className="min-w-0 max-md:col-span-8 max-md:self-center">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="orange">{audio.genre}</Badge>
                    <Badge>Phần 1 / 3</Badge>
                  </div>
                  <h1 className="mt-3 text-h2 sm:mt-4 md:text-h1">{audio.title}</h1>
                  <p className="mt-1 text-base font-semibold text-brand-strong sm:mt-2 md:text-h3">
                    {audio.author}
                  </p>
                  <p className="mt-3 hidden max-w-prose text-sm leading-6 text-muted sm:block">
                    Được truyền tải đầy cảm xúc bởi <strong className="text-ink">Liam Vance</strong>{' '}
                    &amp; <strong className="text-ink">Maya Chen</strong>
                  </p>
                </div>
                <div
                  aria-busy={trackStatus === 'loading' || undefined}
                  className="min-w-0 rounded-2xl border border-hairline bg-elevated p-4 max-md:col-span-12 md:mt-5"
                >
                  {trackReady ? (
                    <>
                      <p className="text-caption text-ink/70">
                        {playing ? 'Đang phát' : 'Tạm dừng'}
                      </p>
                      <div className="mt-1 flex items-end justify-between gap-3">
                        <strong className="min-w-0 text-base">
                          Chương {chapter}: {title}
                        </strong>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-orange-strong">
                          {audio.queue[chapter - 1][1]}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="sr-only" role="status">
                        Đang tải âm thanh chương {chapter}…
                      </span>
                      <Skeleton className="h-4 w-20" />
                      {/* Chapter titles usually wrap to two lines in the narrow phone column. */}
                      <Skeleton className="mt-2.5 h-5 w-4/5 sm:hidden" />
                      <span className="mt-2.5 flex items-center justify-between gap-3">
                        <Skeleton className="h-5 w-3/5" />
                        <Skeleton className="h-4 w-12" />
                      </span>
                    </>
                  )}
                </div>
              </div>
            </section>
            <section
              aria-label="Điều khiển phát"
              aria-busy={trackStatus === 'loading' || undefined}
              className="mt-6 sm:mt-8"
            >
              {trackStatus === 'error' || trackStatus === 'empty' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title={`Không tải được âm thanh chương ${chapter}`}
                  description="Luồng phát chưa sẵn sàng. Thử tải lại hoặc chọn chương khác trong hàng đợi."
                  action={
                    <Button variant="secondary" onClick={retryTrack}>
                      Thử lại
                    </Button>
                  }
                  className="py-6"
                />
              ) : trackReady ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-xs tabular-nums">
                    <strong className="text-ink">{formatTime(position)}</strong>
                    <span className="flex min-w-0 items-center gap-1.5 text-ink/70">
                      <span
                        aria-hidden="true"
                        className={`size-1.5 shrink-0 rounded-full ${playing ? 'bg-brand' : 'bg-ink/30'}`}
                      />
                      <span className="truncate">Phát trực tuyến 320kbps</span>
                    </span>
                    <span className="text-ink/70">−{formatTime(duration - position)}</span>
                  </div>
                  <ReaderRange
                    label="Tiến độ âm thanh"
                    tone="orange"
                    min={0}
                    max={duration}
                    value={position}
                    valueText={`${formatTime(position)} / ${formatTime(duration)}`}
                    onChange={seek}
                    className="mt-2"
                  />
                </>
              ) : (
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
              )}
              <div className="mt-6 flex items-center justify-center gap-1 min-[360px]:gap-2 sm:gap-4">
                <TransportButton
                  label="Phát ngẫu nhiên"
                  pressed={shuffle}
                  onClick={() => setShuffle((value) => !value)}
                  className="max-sm:hidden"
                >
                  <Shuffle size={19} />
                </TransportButton>
                <TransportButton
                  label="Chương trước"
                  disabled={chapter <= 1}
                  onClick={() => goToChapter(chapter - 1)}
                >
                  <SkipBack size={21} />
                </TransportButton>
                <IconButton
                  label={`Lùi ${SKIP_SECONDS} giây`}
                  shape="circle"
                  onClick={() => seek(position - SKIP_SECONDS)}
                >
                  <RotateCcw size={20} />
                </IconButton>
                <button
                  type="button"
                  aria-label={playing ? 'Tạm dừng' : 'Phát'}
                  disabled={!trackReady}
                  onClick={togglePlay}
                  className="grid size-14 shrink-0 place-items-center rounded-full bg-orange text-on-orange shadow-[0_14px_30px_-14px_var(--accent-orange)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 min-[360px]:size-16"
                >
                  {playing ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}
                </button>
                <IconButton
                  label={`Tiến ${SKIP_SECONDS} giây`}
                  shape="circle"
                  onClick={() => seek(position + SKIP_SECONDS)}
                >
                  <RotateCw size={20} />
                </IconButton>
                <TransportButton
                  label="Chương tiếp theo"
                  disabled={chapter >= audio.queue.length}
                  onClick={() => goToChapter(chapter + 1)}
                >
                  <SkipForward size={21} />
                </TransportButton>
                <TransportButton
                  label="Lặp lại chương"
                  pressed={repeat}
                  onClick={() => setRepeat((value) => !value)}
                  className="max-sm:hidden"
                >
                  <Repeat2 size={19} />
                </TransportButton>
              </div>
              <div className="mt-4 flex justify-center gap-2 sm:hidden">
                <Button
                  size="sm"
                  variant={shuffle ? 'outline' : 'ghost'}
                  aria-pressed={shuffle}
                  onClick={() => setShuffle((value) => !value)}
                >
                  <Shuffle size={15} />
                  Ngẫu nhiên
                </Button>
                <Button
                  size="sm"
                  variant={repeat ? 'outline' : 'ghost'}
                  aria-pressed={repeat}
                  onClick={() => setRepeat((value) => !value)}
                >
                  <Repeat2 size={15} />
                  Lặp lại
                </Button>
              </div>
              <div className="mt-8 space-y-3 border-t border-hairline pt-6">
                <ControlPills
                  label="Tốc độ"
                  options={SPEEDS.map((value) => [`${value}x`, value])}
                  value={speed}
                  onChange={setSpeed}
                />
                <ControlPills label="Hẹn giờ" options={TIMERS} value={timer} onChange={setTimer} />
                <div className="flex items-center gap-3 rounded-full bg-elevated py-1 pl-1.5 pr-4">
                  <TransportButton
                    small
                    label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
                    pressed={muted}
                    onClick={() => setMuted((value) => !value)}
                  >
                    <Volume2 size={17} />
                  </TransportButton>
                  <ReaderRange
                    label="Âm lượng"
                    min={0}
                    max={100}
                    value={muted ? 0 : volume}
                    valueText={`${muted ? 0 : volume}%`}
                    onChange={(value) => {
                      setVolume(value);
                      setMuted(value === 0);
                    }}
                  />
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
                    {muted ? 0 : volume}%
                  </span>
                </div>
              </div>
            </section>
          </Card>
          <aside className="space-y-5">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-h3">Hàng đợi âm thanh</h2>
                  <p className="mt-0.5 text-caption text-muted">
                    {audio.queue.length} bản · tổng {queueTotal}
                  </p>
                </div>
                <span className="grid size-10 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                  <ListMusic size={18} aria-hidden="true" />
                </span>
              </div>
              <ol className="-mx-1 mt-5 max-h-[540px] space-y-1 overflow-y-auto overscroll-contain px-1">
                {audio.queue.map(([itemTitle, time], index) => {
                  const number = index + 1;
                  const active = number === chapter;
                  const done = number < chapter;
                  return (
                    <li key={itemTitle}>
                      <button
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => goToChapter(number)}
                        className={`relative flex w-full items-center gap-3 whitespace-normal rounded-2xl p-3 text-left transition-colors ${active ? 'bg-orange/14' : 'hover:bg-ink/5'}`}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-3 left-0 w-1 rounded-full bg-orange"
                          />
                        )}
                        {done ? (
                          <CheckCircle2 size={18} className="shrink-0 text-brand" />
                        ) : active ? (
                          <Volume2 size={18} className="shrink-0 text-orange-strong" />
                        ) : (
                          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-xs tabular-nums">
                            {number}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <strong
                            className={`line-clamp-2 block text-sm ${active ? 'text-orange-strong' : 'text-ink'}`}
                          >
                            {number}. {itemTitle}
                          </strong>
                          <span className="text-xs text-muted">
                            {done
                              ? 'Đã hoàn thành'
                              : active
                                ? playing
                                  ? 'Đang phát'
                                  : 'Tạm dừng'
                                : 'Trong hàng đợi'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{time}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>
            <Card>
              <h2 className="text-h3">Lồng tiếng &amp; Sản xuất</h2>
              <ul className="mt-4 space-y-4">
                {audio.cast.map(([name, role]) => (
                  <li className="flex items-center gap-3" key={name}>
                    <span
                      aria-hidden="true"
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-purple/12 text-sm font-semibold text-purple-strong"
                    >
                      {name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')}
                    </span>
                    <div className="min-w-0">
                      <strong className="text-sm">{name}</strong>
                      <p className="text-caption text-muted">{role}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-2xl bg-elevated p-4 text-sm italic leading-6 text-ink/80">
                “Được thu tại SoundForge Studios với phần nhạc nền analog được thiết kế riêng.”
              </p>
            </Card>
            <Card className="flex items-center justify-between gap-4">
              <div>
                <p className="text-caption text-muted">Bạn yêu thích truyện âm thanh này?</p>
                <strong className="text-sm">Lưu để nghe sau</strong>
              </div>
              <IconButton
                label={saved ? 'Bỏ yêu thích' : 'Yêu thích'}
                tone="rose"
                shape="circle"
                aria-pressed={saved}
                onClick={toggleSaved}
              >
                <Heart size={20} className={saved ? 'fill-current' : ''} />
              </IconButton>
            </Card>
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
  );
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
  );
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
  );
}
