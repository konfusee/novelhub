import { useId } from 'react';
import { AlignJustify, AlignLeft, Check, ChevronDown, SkipForward, Smartphone } from '../icons';
import { Badge, Button, Select } from '../ui';
import {
  DEFAULT_CHAPTER_MODE,
  READER_CHAPTER_MODES,
  READER_FONTS,
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  READER_PARAGRAPH_GAPS,
  READER_WIDTH,
} from './readerOptions';

const chapterModeIcons = { continuous: ChevronDown, swipe: Smartphone, button: SkipForward };

const rangeFills = { brand: 'bg-brand', orange: 'bg-orange', purple: 'bg-purple', rose: 'bg-rose' };
const rangeRings = {
  brand: 'group-has-[:focus-visible]:ring-brand/30',
  orange: 'group-has-[:focus-visible]:ring-orange/35',
  purple: 'group-has-[:focus-visible]:ring-purple/30',
  rose: 'group-has-[:focus-visible]:ring-rose/30',
};

/*
 * Token-styled slider shared by the reading canvas, the audio player and reading preferences.
 * The native range input stays on top (transparent) so keyboard, pointer and screen-reader
 * behaviour are untouched; the painted track/thumb only mirror its value.
 */
export function ReaderRange({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  valueText,
  tone = 'brand',
  className = '',
  ...props
}) {
  const ratio = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const fill = rangeFills[tone] || rangeFills.brand;
  return (
    <span
      className={`group relative flex h-7 min-w-0 items-center ${/(^|\s)w-/.test(className) ? '' : 'w-full'} ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 h-1.5 overflow-hidden rounded-full bg-ink/10"
      >
        <span
          className={`block h-full w-full origin-left rounded-full ${fill}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-whisper ring-0 transition-[transform,box-shadow] duration-200 group-hover:scale-110 group-has-[:focus-visible]:ring-4 ${fill} ${rangeRings[tone] || rangeRings.brand}`}
        style={{ left: `calc(0.5rem + (100% - 1rem) * ${ratio})` }}
      />
      <input
        type="range"
        aria-label={label}
        aria-valuetext={valueText}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
        {...props}
      />
    </span>
  );
}

function SettingLabel({ id, children, value }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span id={id} className="text-sm font-semibold text-ink">
        {children}
      </span>
      {value !== undefined && (
        <span className="text-caption font-semibold tabular-nums text-brand-strong">{value}</span>
      )}
    </div>
  );
}

function Segmented({ labelledBy, columns, children }) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className={`grid gap-2 ${columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      {children}
    </div>
  );
}

/* Radio cards for how the reader moves between chapters (native radios: arrow keys work). */
function ChapterModePicker({ value, onChange }) {
  const id = useId();
  const current = value || DEFAULT_CHAPTER_MODE;
  return (
    <div>
      <SettingLabel id={`${id}-label`}>Cách chuyển chương</SettingLabel>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="space-y-2">
        {READER_CHAPTER_MODES.map((mode) => {
          const Icon = chapterModeIcons[mode.value];
          const checked = current === mode.value;
          return (
            <label
              key={mode.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-[background-color,border-color,box-shadow] duration-200 ease-spring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/35 ${checked ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand/50'}`}
            >
              <input
                type="radio"
                name={`${id}-mode`}
                value={mode.value}
                checked={checked}
                onChange={() => onChange(mode.value)}
                aria-describedby={`${id}-${mode.value}`}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`grid size-10 shrink-0 place-items-center rounded-2xl transition-colors duration-200 ${checked ? 'bg-brand text-on-brand' : 'bg-elevated text-ink/70'}`}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-ink">{mode.label}</span>
                  {mode.recommended && <Badge tone="green">Khuyên dùng</Badge>}
                </span>
                <span id={`${id}-${mode.value}`} className="mt-1 block text-caption text-ink/70">
                  {mode.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${checked ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}
              >
                {checked && <Check size={12} />}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* Reading-canvas preferences rendered inside the full chapter reader's settings drawer. */
export function ReaderSettings({ settings, update, t }) {
  const id = useId();
  return (
    <div className="space-y-6">
      <ChapterModePicker
        value={settings.chapterMode}
        onChange={(value) => update('chapterMode', value)}
      />
      <div>
        <SettingLabel id={`${id}-size`} value={`${settings.fontSize}px`}>
          {t('reader.fontSize')}
        </SettingLabel>
        <ReaderRange
          aria-labelledby={`${id}-size`}
          min={READER_FONT_SIZES[0]}
          max={READER_FONT_SIZES.at(-1)}
          step={2}
          value={settings.fontSize}
          valueText={`${settings.fontSize}px`}
          onChange={(value) => update('fontSize', value)}
        />
      </div>
      {/* Below sm the column already fills the screen, so the width control has no effect. */}
      <div className="hidden sm:block">
        <SettingLabel id={`${id}-width`} value={`${settings.width}px`}>
          {t('reader.contentWidth')}
        </SettingLabel>
        <ReaderRange
          aria-labelledby={`${id}-width`}
          min={READER_WIDTH.min}
          max={READER_WIDTH.max}
          step={READER_WIDTH.step}
          value={settings.width}
          valueText={`${settings.width}px`}
          onChange={(value) => update('width', value)}
        />
      </div>
      <div>
        <SettingLabel id={`${id}-line`}>{t('reader.lineHeight')}</SettingLabel>
        <Segmented labelledBy={`${id}-line`} columns={4}>
          {READER_LINE_HEIGHTS.map((value) => (
            <Button
              key={value}
              size="sm"
              aria-pressed={settings.lineHeight === value}
              variant={settings.lineHeight === value ? 'primary' : 'secondary'}
              className="min-h-11 px-2 tabular-nums sm:min-h-9"
              onClick={() => update('lineHeight', value)}
            >
              {value}
            </Button>
          ))}
        </Segmented>
      </div>
      <div>
        <SettingLabel id={`${id}-gap`}>{t('reader.paragraphSpacing')}</SettingLabel>
        <Segmented labelledBy={`${id}-gap`} columns={3}>
          {READER_PARAGRAPH_GAPS.map(([key, value]) => (
            <Button
              key={key}
              size="sm"
              aria-pressed={settings.paragraphGap === value}
              variant={settings.paragraphGap === value ? 'primary' : 'secondary'}
              className="min-h-11 px-2 sm:min-h-9"
              onClick={() => update('paragraphGap', value)}
            >
              {t(`reader.${key}`)}
            </Button>
          ))}
        </Segmented>
      </div>
      <div>
        <SettingLabel id={`${id}-align`}>{t('reader.alignment')}</SettingLabel>
        <Segmented labelledBy={`${id}-align`} columns={2}>
          {[
            ['left', AlignLeft],
            ['justify', AlignJustify],
          ].map(([value, Icon]) => (
            <Button
              key={value}
              size="sm"
              aria-pressed={settings.align === value}
              variant={settings.align === value ? 'primary' : 'secondary'}
              className="min-h-11 sm:min-h-9"
              onClick={() => update('align', value)}
            >
              <Icon size={15} aria-hidden="true" />
              {t(`reader.${value}`)}
            </Button>
          ))}
        </Segmented>
      </div>
      <div>
        <label htmlFor={`${id}-font`} className="mb-2 block text-sm font-semibold text-ink">
          Phông chữ
        </label>
        <Select
          id={`${id}-font`}
          value={settings.fontFamily}
          onChange={(event) => update('fontFamily', event.target.value)}
          className="w-full"
        >
          {READER_FONTS.map(([label, value]) => (
            <option value={value} key={label}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
