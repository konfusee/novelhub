import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  Copy,
  History,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { managedChapters } from '../../data/mock/author'
import { useMockResource } from '../../context/MockDataContext'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
} from '../../components/ui'

const modules = [
  ['Động não và nút thắt cốt truyện', 'Nhánh kể chuyện và tình tiết hé lộ', BrainCircuit],
  ['Thế giới nhân vật và tính nhất quán', 'Đồng bộ giọng văn và dòng thời gian', BookOpen],
  ['Mở rộng cảnh và chi tiết cảm giác', 'Làm giàu bầu không khí', Sparkles],
  ['Điều hòa giọng điệu và phong cách', 'Kiểm tra nhịp chậm u buồn', WandSparkles],
  ['Trau chuốt hội thoại', 'Hàm ý và nhịp điệu', MessageSquare],
  ['Nhịp độ và điểm rời bỏ của độc giả', 'Mô hình hóa đường cong căng thẳng', History],
]
const baseSuggestions = [
  {
    title: 'Sensory Subtlety: Bioluminescent Pollen & Resonating Heartbeat',
    tag: 'Recommended',
    tone: '98%',
    body: 'Between the arching iron bark, pale cerulean spores drifted upward like inverted snowfall. With each breath Lyra drew, the peat beneath her boots vibrated in sync with the hollow wood. It was not an earthquake, but the heavy, measured sigh of an organism that had waited four centuries to be disturbed.',
  },
  {
    title: 'Mythological Dialogue: The Guardian Whispers through the Ironwood Bark',
    tag: 'Subtle Dialogue',
    tone: '91%',
    body: '“The wardens of elder days do not slumber lightly, wanderer,” murmured a voice not from the air, but from the grain of the saplings themselves. The trunk furrowed, rings of aged wood shifting like the slow opening of an unblinking eye.',
  },
  {
    title: 'Tactile Encounter: Amber Resin Awakening',
    tag: 'Slow Pacing',
    tone: '94%',
    body: 'She reached out with a trembling gloved hand. As her fingers brushed the trunk, warm golden amber welled from a hairline fissure. It did not cool; instead, it spread in intricate tendrils along the moss, framing the slumbering silhouette of the horn-crowned guardian entwined in rootwood.',
  },
]
const baseLore = [
  ['Eldoria Tree Spirits', 'Bound to elder ironwood. Cannot cross moving salt water.'],
  [
    'Forbidden Runes of Kael',
    'Carved during the First Eclipse. React violently to iron ore weapons.',
  ],
  ["Lyra's Vow & Scars", 'Carries silver pendant from the Ashen Valley raid.'],
]
const suggestionTagLabels = {
  Recommended: 'Đề xuất',
  'Subtle Dialogue': 'Hội thoại tinh tế',
  'Slow Pacing': 'Nhịp chậm',
}
const suggestionTones = ['green', 'orange', 'neutral']
const draftHistory = [
  'Hé lộ hộ vệ · Hiện tại',
  'Biến thể hội thoại · 12 phút trước',
  'Kiểm tra nhịp độ · Hôm qua',
]

export function AiWritingAssistantPage() {
  const promptRef = useRef(null)
  const timerRef = useRef(null)
  const [module, setModule] = useState(modules[0][0])
  const [prompt, setPrompt] = useState(
    'Generate 3 atmospheric ways to reveal the ancient guardian hidden beneath the elder tree roots without breaking the melancholic slow-burn tone.',
  )
  const [tone, setTone] = useState(85)
  const [pacing, setPacing] = useState(60)
  const [ambience, setAmbience] = useState(92)
  const [suggestions, setSuggestions] = useState(baseSuggestions)
  const [generating, setGenerating] = useState(false)
  const [inserted, setInserted] = useState(null)
  const [copied, setCopied] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [chapterOpen, setChapterOpen] = useState(false)
  const [chapter, setChapter] = useState(
    managedChapters.find(item => item.number === 16) ?? managedChapters[0],
  )
  const [lore, setLore] = useState(baseLore)
  const [loreOpen, setLoreOpen] = useState(false)
  const [loreName, setLoreName] = useState('')
  const [loreNote, setLoreNote] = useState('')
  const [saved, setSaved] = useState(false)
  const chapters = useMockResource('author:ai:chapters', managedChapters)
  const suggestionsResource = useMockResource('author:ai:suggestions', suggestions)
  const loreResource = useMockResource('author:ai:lore', lore)
  const history = useMockResource('author:ai:history', draftHistory)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const regenerate = () => {
    setGenerating(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setSuggestions(current => [...current.slice(1), current[0]])
      setInserted(null)
      setGenerating(false)
    }, 700)
  }
  const copy = async suggestion => {
    try {
      await navigator.clipboard?.writeText(suggestion.body)
    } catch {
      // Clipboard may be blocked; the passage stays visible for manual copy.
    }
    setCopied(suggestion.title)
  }
  const refine = suggestion => {
    setPrompt(`Refine option “${suggestion.title}”: keep the slow-burn tone, tighten the imagery.`)
    promptRef.current?.focus()
    promptRef.current?.scrollIntoView({ block: 'center' })
  }
  const closeLore = () => {
    setLoreOpen(false)
    setLoreName('')
    setLoreNote('')
  }

  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <Badge tone="purple">
              <Sparkles size={12} aria-hidden="true" />
              Đồng hành cùng Studio sáng tạo
            </Badge>
            <h1 className="mt-3 text-h2 sm:text-h1">Trợ lý sáng tác AI và Phòng biên tập</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">
              Công cụ AI hỗ trợ xây dựng thế giới, phân tích nhịp kể, tinh chỉnh giọng điệu và duy
              trì tính nhất quán của nhân vật.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              <History size={16} aria-hidden="true" />
              Lịch sử bản nháp
            </Button>
            <Button onClick={() => setSaved(true)}>
              {saved ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Save size={16} aria-hidden="true" />
              )}
              {saved ? 'Đã lưu bản thảo' : 'Lưu bản thảo'}
            </Button>
          </div>
        </header>

        <div className="mt-6 flex gap-3 rounded-2xl border border-purple/25 bg-purple/8 p-4 text-sm leading-6">
          <ShieldCheck
            className="mt-0.5 shrink-0 text-purple-strong"
            size={18}
            aria-hidden="true"
          />
          <p>
            <strong>Cam kết quyền làm chủ của tác giả:</strong> Gợi ý AI chỉ mang tính hỗ trợ và cần
            được tác giả xem xét. Bạn giữ 100% quyền sở hữu bản thảo và tài sản trí tuệ phái sinh.
          </p>
        </div>

        <div className="nh-grid-12 mt-6 grid items-start gap-5 nh-layout-xl-3-6-3">
          <aside className="space-y-5">
            <Card className="p-4">
              <h2 className="px-1 text-sm font-semibold">Mô-đun biên tập</h2>
              <div className="mt-3 grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
                {modules.map(([title, note, Icon]) => {
                  const active = module === title
                  return (
                    <button
                      key={title}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setModule(title)}
                      className={`flex w-full gap-3 whitespace-normal rounded-2xl p-3 text-left transition-[background-color,color] duration-200 ${active ? 'bg-purple/12 text-purple-strong' : 'hover:bg-elevated'}`}
                    >
                      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <strong className="block text-[13px] leading-5">{title}</strong>
                        <small className="mt-0.5 block text-xs leading-4 text-muted">{note}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Điều chỉnh sắc thái</h2>
              <ToneSlider label="Giọng điệu: U buồn" value={tone} setValue={setTone} />
              <ToneSlider
                label="Nhịp độ: Chậm rãi"
                value={pacing}
                setValue={setPacing}
                color="orange"
              />
              <ToneSlider
                label="Không khí thần thoại"
                value={ambience}
                setValue={setAmbience}
                color="purple"
              />
            </Card>
          </aside>

          <section
            className="min-w-0 space-y-5 max-xl:order-first"
            aria-label="Không gian biên tập"
          >
            {chapters.status === 'loading' ? (
              <div aria-busy="true" aria-label="Đang tải bản thảo" className="space-y-5">
                <ManuscriptSkeleton />
              </div>
            ) : chapters.status === 'error' ? (
              <Card className="p-0">
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được bản thảo"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={chapters.retry} />}
                />
              </Card>
            ) : chapters.status === 'empty' ? (
              <Card className="p-0">
                <EmptyState
                  icon={BookOpen}
                  title="Chưa có chương để biên tập"
                  description="Trợ lý AI cần ít nhất một chương làm ngữ cảnh. Hãy thêm chương trong trình quản lý truyện."
                  action={
                    <ButtonLink to="/author/stories/demo" size="sm">
                      <Plus size={14} aria-hidden="true" />
                      Quản lý chương
                    </ButtonLink>
                  }
                />
              </Card>
            ) : (
              <div className="nh-fade-enter space-y-5">
                <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                      <BookOpen size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Bản thảo đang xử lý</p>
                      <strong className="block text-sm">The Silent Forest</strong>
                      <span className="block truncate text-xs font-medium text-brand-strong">
                        Chương {chapter.number}: {chapter.title}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setChapterOpen(true)}
                    variant="secondary"
                    size="sm"
                    className="self-start sm:self-auto"
                  >
                    Đổi chương
                  </Button>
                </Card>

                <Card className="bg-elevated p-5">
                  <p className="flex items-center gap-2 text-xs font-semibold text-orange-strong">
                    <span className="size-1.5 rounded-full bg-orange" aria-hidden="true" />
                    Đoạn trích tham chiếu (dòng 42–58)
                  </p>
                  <blockquote className="mt-3 rounded-2xl bg-surface p-4 text-sm italic leading-7 sm:p-5">
                    “The damp mist clung to Lyra&apos;s woolen cloak like cold spiderwebs. Ahead,
                    the roots of the Ironwood matriarch rose from the peat, black as obsidian and
                    older than the names of the lost gods. She paused at the verge of the grove,
                    sensing that something beneath the soil was keeping rhythm with her own pulse.”
                  </blockquote>
                </Card>
              </div>
            )}

            <Card className="border-purple/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ai-prompt"
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <Sparkles className="text-purple" size={16} aria-hidden="true" />
                  Định hướng biên tập và câu lệnh AI
                </label>
                <Badge tone="purple">Mô hình: NovelCraft 4.2 Pro</Badge>
              </div>
              <textarea
                id="ai-prompt"
                ref={promptRef}
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                className="mt-3 min-h-28 w-full resize-y rounded-2xl border border-line bg-surface p-4 text-base leading-6 outline-none transition-[border-color] duration-200 focus:border-purple sm:text-sm"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge>#SlowBurn</Badge>
                <Badge>#Folklore</Badge>
                <Badge>#HighSensory</Badge>
                <Button
                  onClick={regenerate}
                  disabled={generating || !prompt.trim()}
                  variant="tertiary"
                  size="sm"
                  className="ml-auto"
                >
                  <RefreshCw
                    size={14}
                    aria-hidden="true"
                    className={generating ? 'animate-spin' : ''}
                  />
                  {generating ? 'Đang tạo…' : 'Tạo lại phương án'}
                </Button>
              </div>
            </Card>

            <div className="flex items-center justify-between gap-3 pt-1">
              <h2 className="text-h3">Gợi ý đã tạo</h2>
              {suggestionsResource.status === 'ready' ? (
                <Badge tone="purple">{suggestionsResource.data.length} phương án</Badge>
              ) : suggestionsResource.status === 'loading' ? (
                <Skeleton className="h-6 w-28" />
              ) : null}
            </div>
            {suggestionsResource.status === 'loading' ? (
              <div aria-busy="true" aria-label="Đang tải gợi ý" className="space-y-4">
                {suggestionSkeletons.map((lines, index) => (
                  <SuggestionSkeleton key={index} lines={lines} />
                ))}
              </div>
            ) : suggestionsResource.status === 'error' ? (
              <Card className="p-0">
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  headingAs="h3"
                  title="Không tải được gợi ý"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={suggestionsResource.retry} />}
                />
              </Card>
            ) : suggestionsResource.status === 'empty' ? (
              <Card className="p-0">
                <EmptyState
                  icon={Sparkles}
                  headingAs="h3"
                  title="Chưa có gợi ý nào"
                  description="Viết định hướng biên tập ở trên rồi tạo phương án để nhận gợi ý đầu tiên."
                  action={
                    <Button size="sm" onClick={() => promptRef.current?.focus()}>
                      <WandSparkles size={14} aria-hidden="true" />
                      Viết câu lệnh AI
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div
                aria-busy={generating}
                aria-live="polite"
                className={`nh-fade-enter space-y-4 transition-opacity duration-200 ${generating ? 'opacity-50' : ''}`}
              >
                {suggestionsResource.data.map((suggestion, index) => (
                  <Suggestion
                    key={suggestion.title}
                    suggestion={suggestion}
                    index={index}
                    inserted={inserted === suggestion.title}
                    copied={copied === suggestion.title}
                    onInsert={() => setInserted(suggestion.title)}
                    onCopy={() => copy(suggestion)}
                    onRefine={() => refine(suggestion)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <Card className="p-5">
              <Badge tone="green">
                <CheckCircle2 size={12} aria-hidden="true" />
                Đồng bộ 100%
              </Badge>
              <h2 className="mt-3 text-sm font-semibold">Cẩm nang thế giới và tính nhất quán</h2>
              <p className="mt-1 text-xs text-muted">Theo dõi thiết lập chính thức của truyện</p>
              {loreResource.status === 'loading' ? (
                <ul
                  className="mt-4 space-y-2.5"
                  aria-busy="true"
                  aria-label="Đang tải cẩm nang thế giới"
                >
                  {loreSkeletons.map((noteLines, index) => (
                    <LoreSkeleton key={index} noteLines={noteLines} />
                  ))}
                </ul>
              ) : loreResource.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  headingAs="h3"
                  title="Không tải được cẩm nang thế giới"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={loreResource.retry} />}
                />
              ) : loreResource.status === 'empty' ? (
                <EmptyState
                  icon={BookOpen}
                  headingAs="h3"
                  title="Chưa ghim thực thể nào"
                  description="Ghim nhân vật, địa danh hoặc quy tắc thế giới để AI giữ đúng thiết lập."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setLoreOpen(true)}>
                      <Plus size={14} aria-hidden="true" />
                      Ghim thực thể
                    </Button>
                  }
                />
              ) : (
                <ul className="nh-fade-enter mt-4 space-y-2.5">
                  {loreResource.data.map(([title, note]) => (
                    <li key={title} className="rounded-2xl bg-elevated p-3.5">
                      <div className="flex items-start gap-2">
                        <strong className="min-w-0 flex-1 text-[13px] leading-5">{title}</strong>
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-brand"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-ink/70">{note}</p>
                      <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-strong">
                        <ShieldCheck size={12} aria-hidden="true" />
                        Đã bảo toàn tính nhất quán
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(loreResource.status === 'ready' || loreResource.status === 'loading') && (
                <button
                  type="button"
                  onClick={() => setLoreOpen(true)}
                  className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-line text-xs font-semibold text-ink/80 transition-[border-color,color] duration-200 hover:border-brand hover:text-brand-strong"
                >
                  <Plus size={14} aria-hidden="true" />
                  Ghim thực thể thế giới mới
                </button>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Phong cách biên tập</h2>
              <div className="mt-3 flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-purple/12 text-purple-strong">
                  <Bot size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <strong className="text-[13px]">Biên tập viên kỳ ảo văn học</strong>
                  <p className="text-xs leading-5 text-muted">
                    Ưu tiên hàm ý, cảm xúc và nhạc tính của văn xuôi
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs">
                Mức độ khắt khe:{' '}
                <strong className="text-purple-strong">Mang tính xây dựng / Cao</strong>
              </p>
            </Card>
          </aside>
        </div>

        <Modal open={historyOpen} title="Lịch sử bản nháp AI" onClose={() => setHistoryOpen(false)}>
          {history.status === 'loading' ? (
            <ul className="space-y-2" aria-busy="true" aria-label="Đang tải lịch sử bản nháp">
              {draftHistory.map((_, index) => (
                <li key={index} className="rounded-2xl bg-elevated px-4 py-3">
                  <Skeleton className="my-0.5 h-4 w-3/5" />
                </li>
              ))}
            </ul>
          ) : history.status === 'error' ? (
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              headingAs="h3"
              title="Không tải được lịch sử bản nháp"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
              action={<RetryButton onClick={history.retry} />}
            />
          ) : history.status === 'empty' ? (
            <EmptyState
              icon={History}
              headingAs="h3"
              title="Chưa có lịch sử bản nháp"
              description="Mỗi lần tạo phương án, trợ lý AI sẽ lưu một phiên bản tại đây để bạn so sánh."
              action={
                <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(false)}>
                  Quay lại biên tập
                </Button>
              }
            />
          ) : (
            <ul className="nh-fade-enter space-y-2">
              {history.data.map(item => (
                <li key={item} className="rounded-2xl bg-elevated px-4 py-3 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Modal>

        <Modal open={chapterOpen} title="Chọn chương" onClose={() => setChapterOpen(false)}>
          <ul className="space-y-2">
            {chapters.data.map(item => {
              const active = item.number === chapter.number
              return (
                <li key={item.number}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setChapter(item)
                      setChapterOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 whitespace-normal rounded-2xl border px-4 py-3 text-left text-sm transition-[background-color,border-color] duration-200 ${active ? 'border-brand bg-brand/8' : 'border-hairline hover:bg-elevated'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate">
                        Chương {item.number}: {item.title}
                      </strong>
                      <span className="block truncate text-xs text-muted">{item.note}</span>
                    </span>
                    {active && (
                      <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </Modal>

        <Modal open={loreOpen} title="Ghim thực thể thế giới" onClose={closeLore}>
          <form
            onSubmit={event => {
              event.preventDefault()
              if (!loreName.trim()) return
              setLore(current => [...current, [loreName.trim(), loreNote.trim()]])
              closeLore()
            }}
          >
            <label htmlFor="lore-name" className="block text-sm font-semibold">
              Tên thực thể
            </label>
            <Input
              id="lore-name"
              className="mt-2"
              value={loreName}
              onChange={event => setLoreName(event.target.value)}
              required
            />
            <label htmlFor="lore-note" className="mt-4 block text-sm font-semibold">
              Ghi chú thiết lập chính thức
            </label>
            <textarea
              id="lore-note"
              value={loreNote}
              onChange={event => setLoreNote(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-base outline-none focus:border-brand sm:text-sm"
            />
            <Button type="submit" disabled={!loreName.trim()} className="mt-5 w-full">
              <Plus size={16} aria-hidden="true" />
              Thêm vào cẩm nang thế giới
            </Button>
          </form>
        </Modal>
      </div>
    </AuthorLayout>
  )
}

const sliderAccents = {
  brand: 'var(--primary)',
  orange: 'var(--accent-orange)',
  purple: 'var(--accent-purple)',
}

function ToneSlider({ label, value, setValue, color = 'brand' }) {
  return (
    <label className="mt-4 block">
      <span className="flex justify-between gap-3 text-xs">
        <span className="text-ink/80">{label}</span>
        <strong className="tabular-nums">{value}%</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={event => setValue(Number(event.target.value))}
        className="mt-2 w-full"
        style={{ accentColor: sliderAccents[color] }}
      />
    </label>
  )
}

function Suggestion({ suggestion, index, inserted, copied, onInsert, onCopy, onRefine }) {
  return (
    <Card as="article" className={`p-5 sm:p-6 ${index === 0 ? 'border-purple/50' : ''}`}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-purple/12 text-sm font-bold text-purple-strong"
        >
          {String.fromCharCode(65 + index)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 max-w-xl text-base font-semibold leading-6">
              {suggestion.title}
            </h3>
            <Badge tone={suggestionTones[index] ?? 'neutral'}>
              {suggestionTagLabels[suggestion.tag] ?? suggestion.tag}
            </Badge>
          </div>
          <p className="mt-3 max-w-[65ch] text-sm leading-7 text-muted">“{suggestion.body}”</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-hairline pt-4 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-brand-strong">
          <CheckCircle2 size={14} aria-hidden="true" />
          Khớp giọng điệu: {suggestion.tone}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex min-h-9 items-center gap-1.5 text-ink/70 transition-colors duration-200 hover:text-ink"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
        <button
          type="button"
          onClick={onRefine}
          className="flex min-h-9 items-center gap-1.5 text-ink/70 transition-colors duration-200 hover:text-ink"
        >
          <WandSparkles size={14} aria-hidden="true" />
          Tinh chỉnh
        </button>
        <Button
          onClick={onInsert}
          size="sm"
          variant={inserted ? 'outline' : 'primary'}
          className="ml-auto"
        >
          {inserted && <Check size={14} aria-hidden="true" />}
          {inserted ? 'Đã chèn' : 'Chèn vào trình soạn thảo'}
        </Button>
      </div>
    </Card>
  )
}

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  )
}

/*
 * Classes for skeleton prose lines given line counts [below sm, sm–lg, xl+]: each line shows only
 * at breakpoints where the real text wraps that far, and the last visible line is shorter.
 */
function lineClasses([base, sm, xl]) {
  return Array.from({ length: Math.max(base, sm, xl) }, (_, index) => {
    const classes = []
    if (index >= base) classes.push('hidden')
    if (index < base !== index < sm) classes.push(index < sm ? 'sm:block' : 'sm:hidden')
    if (index < sm !== index < xl) classes.push(index < xl ? 'xl:block' : 'xl:hidden')
    classes.push(index === base - 1 ? 'w-3/5' : 'w-full')
    if ((index === base - 1) !== (index === sm - 1))
      classes.push(index === sm - 1 ? 'sm:w-3/5' : 'sm:w-full')
    if ((index === sm - 1) !== (index === xl - 1))
      classes.push(index === xl - 1 ? 'xl:w-3/5' : 'xl:w-full')
    return classes.join(' ')
  })
}

/*
 * Line counts [below sm, sm–lg, xl+] of the three mock suggestions. `shortTitle`: the title is
 * narrow enough for the badge to sit beside it once it fits on one line.
 */
const suggestionSkeletons = [
  { title: [3, 1, 2], body: [10, 4, 5] },
  { title: [3, 2, 2], body: [7, 3, 4] },
  { title: [2, 1, 1], body: [9, 4, 5], shortTitle: true },
]
/* Note line counts [below sm, sm–lg, xl+] of the three mock lore entries. */
const loreSkeletons = [
  [2, 1, 2],
  [2, 1, 3],
  [2, 1, 2],
]

function ManuscriptSkeleton() {
  return (
    <>
      <Card
        as="div"
        aria-hidden="true"
        className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-2xl" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Skeleton className="my-0.5 h-3 w-28" />
            <Skeleton className="my-0.5 h-4 w-32" />
            <Skeleton className="my-0.5 h-3 w-48 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 shrink-0 self-start sm:self-auto" />
      </Card>
      <Card as="div" aria-hidden="true" className="flex flex-col bg-elevated p-5">
        <Skeleton className="my-0.5 h-3 w-56 max-w-full" />
        <div className="mt-3 flex flex-col rounded-2xl bg-surface p-4 sm:p-5">
          {lineClasses([9, 4, 5]).map((lineClass, index) => (
            <Skeleton key={index} className={`my-2 h-3 ${lineClass}`} />
          ))}
        </div>
      </Card>
    </>
  )
}

function SuggestionSkeleton({ lines }) {
  return (
    <Card as="div" aria-hidden="true" className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span
              className={`flex flex-col ${lines.shortTitle ? 'w-80 max-w-full' : 'w-full max-w-xl'}`}
            >
              {lineClasses(lines.title).map((lineClass, index) => (
                <Skeleton key={index} className={`my-1 h-4 ${lineClass}`} />
              ))}
            </span>
            <Skeleton className="h-6 w-24" />
          </div>
          <span className="mt-3 flex max-w-[65ch] flex-col text-sm">
            {lineClasses(lines.body).map((lineClass, index) => (
              <Skeleton key={index} className={`my-2 h-3 ${lineClass}`} />
            ))}
          </span>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-hairline pt-4">
        <Skeleton className="my-0.5 h-3 w-36" />
        <span className="flex min-h-9 items-center">
          <Skeleton className="h-3 w-[4.25rem]" />
        </span>
        <span className="flex min-h-9 items-center">
          <Skeleton className="h-3 w-[4.5rem]" />
        </span>
        <Skeleton className="ml-auto h-9 w-[12.5rem]" />
      </div>
    </Card>
  )
}

function LoreSkeleton({ noteLines }) {
  return (
    <li aria-hidden="true" className="flex flex-col rounded-2xl bg-elevated p-3.5">
      <Skeleton className="my-1 h-3 w-3/5" />
      <span className="mt-1 flex flex-col">
        {lineClasses(noteLines).map((lineClass, index) => (
          <Skeleton key={index} className={`my-1 h-3 ${lineClass}`} />
        ))}
      </span>
      <Skeleton className="mb-0.5 mt-2.5 h-3 w-36" />
    </li>
  )
}
