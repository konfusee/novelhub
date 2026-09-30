import { useState } from 'react'
import {
  BookOpen,
  Bot,
  BrainCircuit,
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
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal } from '../../components/ui'

const modules = [
  ['Brainstorm & Plot Twists', 'Narrative forks & reveals', BrainCircuit],
  ['Character Lore & Continuity', 'Voice lock & timeline sync', BookOpen],
  ['Scene Expansion & Sensory Detail', 'Atmospheric enrichment', Sparkles],
  ['Tone & Style Harmonizer', 'Melancholic slow-burn check', WandSparkles],
  ['Dialogue Polish', 'Subtext & cadence', MessageSquare],
  ['Pacing & Reader Drop-off', 'Tension curve modeling', History],
]
const baseSuggestions = [
  {
    title: 'Sensory Subtlety — Bioluminescent Pollen & Resonating Heartbeat',
    tag: 'Recommended',
    tone: '98%',
    body: 'Between the arching iron bark, pale cerulean spores drifted upward like inverted snowfall. With each breath Lyra drew, the peat beneath her boots vibrated in sync with the hollow wood. It was not an earthquake, but the heavy, measured sigh of an organism that had waited four centuries to be disturbed.',
  },
  {
    title: 'Mythological Dialogue — The Guardian Whispers through the Ironwood Bark',
    tag: 'Subtle Dialogue',
    tone: '91%',
    body: '“The wardens of elder days do not slumber lightly, wanderer,” murmured a voice not from the air, but from the grain of the saplings themselves. The trunk furrowed, rings of aged wood shifting like the slow opening of an unblinking eye.',
  },
  {
    title: 'Tactile Encounter — Amber Resin Awakening',
    tag: 'Slow Pacing',
    tone: '94%',
    body: 'She reached out with a trembling gloved hand. As her fingers brushed the trunk, warm golden amber welled from a hairline fissure. It did not cool; instead, it spread in intricate tendrils along the moss, framing the slumbering silhouette of the horn-crowned guardian entwined in rootwood.',
  },
]
const lore = [
  ['Eldoria Tree Spirits', 'Bound to elder ironwood. Cannot cross moving salt water.'],
  [
    'Forbidden Runes of Kael',
    'Carved during the First Eclipse. React violently to iron ore weapons.',
  ],
  ["Lyra's Vow & Scars", 'Carries silver pendant from the Ashen Valley raid.'],
]

export function AiWritingAssistantPage() {
  const [module, setModule] = useState(modules[0][0])
  const [prompt, setPrompt] = useState(
    'Generate 3 atmospheric ways to reveal the ancient guardian hidden beneath the elder tree roots without breaking the melancholic slow-burn tone.',
  )
  const [tone, setTone] = useState(85)
  const [pacing, setPacing] = useState(60)
  const [ambience, setAmbience] = useState(92)
  const [suggestions, setSuggestions] = useState(baseSuggestions)
  const [inserted, setInserted] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loreOpen, setLoreOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const regenerate = () => setSuggestions(current => [...current.slice(1), current[0]])
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              AI Writing Assistant &amp; Editorial Lab
            </h1>
            <Badge tone="purple" className="mt-2 gap-1">
              <Sparkles size={12} />
              Creative Studio Co-pilot
            </Badge>
            <p className="mt-2 max-w-2xl text-xs text-muted">
              Collaborative AI mock tools to brainstorm lore, analyze narrative pacing, refine tone,
              and maintain character continuity.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              <History size={15} />
              Draft History
            </Button>
            <Button onClick={() => setSaved(true)}>
              <Save size={15} />
              {saved ? 'Manuscript Saved' : 'Commit Manuscript'}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex gap-3 rounded-2xl border border-purple/25 bg-purple/10 p-4 text-xs">
          <ShieldCheck className="shrink-0 text-purple" size={18} />
          <p>
            <strong>Author Sovereignty Guarantee:</strong> AI suggestions are assistive prompts
            requiring author review. You retain 100% ownership of your manuscript and derivative
            intellectual property.
          </p>
        </div>
        <div className="mt-6 grid items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)_250px]">
          <aside className="space-y-5">
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.16em]">
                Editorial Modules
              </p>
              <div className="mt-4 space-y-1">
                {modules.map(([title, note, Icon]) => (
                  <button
                    key={title}
                    onClick={() => setModule(title)}
                    className={`flex w-full gap-3 rounded-2xl p-3 text-left ${module === title ? 'bg-purple/15 text-purple' : 'hover:bg-elevated'}`}
                  >
                    <Icon size={16} className="mt-0.5 shrink-0" />
                    <span>
                      <strong className="block text-[11px]">{title}</strong>
                      <small className="mt-1 block text-[9px] leading-4 text-muted">{note}</small>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h2 className="text-xs font-semibold">Tone Sliders</h2>
              <ToneSlider label="Tone: Melancholic" value={tone} setValue={setTone} />
              <ToneSlider
                label="Pacing: Deliberate"
                value={pacing}
                setValue={setPacing}
                color="orange"
              />
              <ToneSlider
                label="Mythic Ambience"
                value={ambience}
                setValue={setAmbience}
                color="purple"
              />
            </Card>
          </aside>
          <section className="min-w-0 space-y-5">
            <Card className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] text-muted">Current Manuscript Target</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-brand/15 text-brand">
                    <BookOpen size={18} />
                  </span>
                  <div>
                    <strong className="block text-sm">The Silent Forest</strong>
                    <span className="text-[10px] text-brand">Ch. 16: Heart of the Ironwood</span>
                  </div>
                </div>
              </div>
              <Button variant="secondary" className="min-h-9 text-xs">
                Change Chapter
              </Button>
            </Card>
            <Card className="bg-elevated">
              <p className="text-[9px] uppercase tracking-[.16em] text-orange">
                ● Referenced excerpt (lines 42–58)
              </p>
              <p className="mt-4 rounded-3xl bg-surface p-5 text-sm italic leading-7">
                “The damp mist clung to Lyra&apos;s woolen cloak like cold spiderwebs. Ahead, the
                roots of the Ironwood matriarch rose from the peat—black as obsidian and older than
                the names of the lost gods. She paused at the verge of the grove, sensing that
                something beneath the soil was keeping rhythm with her own pulse.”
              </p>
            </Card>
            <Card className="border-purple/40">
              <div className="flex justify-between text-xs">
                <strong className="flex items-center gap-2">
                  <Sparkles className="text-purple" size={16} />
                  Editorial Direction &amp; AI Prompt
                </strong>
                <span className="text-purple">Model: NovelCraft 4.2 Pro</span>
              </div>
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                className="mt-3 min-h-28 w-full rounded-2xl border border-line bg-surface p-4 text-sm outline-none focus:border-purple"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>#SlowBurn</Badge>
                <Badge>#Folklore</Badge>
                <Badge>#HighSensory</Badge>
                <Button
                  onClick={regenerate}
                  className="ml-auto min-h-9 border-purple bg-purple px-3 py-1 text-xs"
                >
                  <RefreshCw size={14} />
                  Regenerate Options
                </Button>
              </div>
            </Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Generated Suggestions</h2>
              <Badge tone="purple">3 Variations</Badge>
            </div>
            {suggestions.map((suggestion, index) => (
              <Suggestion
                key={suggestion.title}
                suggestion={suggestion}
                index={index}
                inserted={inserted === suggestion.title}
                onInsert={() => setInserted(suggestion.title)}
              />
            ))}
          </section>
          <aside className="space-y-5">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xs font-semibold">Lore Bible &amp; Continuity</h2>
                  <p className="mt-1 text-[9px] text-muted">Active Story Canon Tracker</p>
                </div>
                <Badge tone="green">Sync 100%</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {lore.map(([title, note]) => (
                  <div key={title} className="rounded-2xl bg-elevated p-3">
                    <div className="flex items-center">
                      <strong className="text-[10px]">{title}</strong>
                      <CheckCircle2 size={13} className="ml-auto text-brand" />
                    </div>
                    <p className="mt-2 text-[9px] leading-4 text-muted">{note}</p>
                    <span className="mt-2 flex items-center gap-1 text-[9px] text-brand">
                      <ShieldCheck size={11} />
                      Continuity Preserved
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setLoreOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line p-2 text-[10px]"
              >
                <Plus size={13} />
                Pin New Lore Entity
              </button>
            </Card>
            <Card className="p-4">
              <h2 className="text-xs font-semibold">Editorial Persona</h2>
              <div className="mt-3 flex gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-purple/15 text-purple">
                  <Bot />
                </span>
                <div>
                  <strong className="text-[11px]">Literary Fantasy Editor</strong>
                  <p className="text-[9px] text-muted">
                    Prioritizes subtext, mood &amp; prose musicality
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[10px]">
                Critique Strictness: <strong className="text-purple">Constructive / High</strong>
              </p>
            </Card>
          </aside>
        </div>
        <Modal open={historyOpen} title="AI Draft History" onClose={() => setHistoryOpen(false)}>
          <div className="space-y-3">
            {[
              'Guardian reveal · Current',
              'Dialogue variation · 12 min ago',
              'Pacing audit · Yesterday',
            ].map(item => (
              <div key={item} className="rounded-2xl bg-elevated p-4 text-sm">
                {item}
              </div>
            ))}
          </div>
        </Modal>
        <Modal open={loreOpen} title="Pin Lore Entity" onClose={() => setLoreOpen(false)}>
          <Input placeholder="Entity name" />
          <textarea
            className="mt-3 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Canon notes..."
          />
          <Button onClick={() => setLoreOpen(false)} className="mt-4 w-full">
            <Plus size={15} />
            Add to Lore Bible
          </Button>
        </Modal>
      </main>
    </AuthorLayout>
  )
}

function ToneSlider({ label, value, setValue, color = 'brand' }) {
  const accent = { brand: '#2E7D6B', orange: '#F4A261', purple: '#8E5CF7' }[color]
  return (
    <label className="mt-4 block">
      <span className="flex justify-between text-[9px]">
        <span>{label}</span>
        <strong>{value}%</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={event => setValue(Number(event.target.value))}
        className="mt-2 w-full"
        style={{ accentColor: accent }}
      />
    </label>
  )
}
function Suggestion({ suggestion, index, inserted, onInsert }) {
  return (
    <Card className={index === 0 ? 'border-purple/50' : ''}>
      <div className="flex items-start gap-3">
        <Badge tone="purple">{String.fromCharCode(65 + index)}</Badge>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="max-w-xl font-semibold">{suggestion.title}</h3>
            <Badge tone={index === 0 ? 'green' : index === 1 ? 'orange' : 'neutral'}>
              {suggestion.tag}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-7 text-muted">“{suggestion.body}”</p>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-[10px] text-muted">
            <span className="text-brand">✓ Tone Match: {suggestion.tone}</span>
            <button className="flex items-center gap-1">
              <Copy size={12} />
              Copy
            </button>
            <button className="flex items-center gap-1">
              <WandSparkles size={12} />
              Refine
            </button>
            <Button onClick={onInsert} className="ml-auto min-h-8 px-3 py-1 text-[10px]">
              {inserted ? 'Inserted' : 'Insert into Editor'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
