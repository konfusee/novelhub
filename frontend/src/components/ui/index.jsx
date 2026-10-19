import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { ArrowUp, Check, ChevronDown, Sparkles, X } from '../icons';
import { useLocale } from '../../context/LocaleContext';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/*
 * Tailwind orders same-property utilities by value, not by class order, so a caller's `p-4` can
 * never beat a default `p-6`. Defaults are therefore emitted only when the caller's className
 * does not set that (unprefixed) utility itself.
 */
const PADDING = /(^|\s)p-/;
const RADIUS = /(^|\s)rounded-(none|sm|md|lg|xl|2xl|3xl|full|\[)/;
const SIZE = /(^|\s)size-/;
const DISPLAY =
  /(^|\s)(hidden|block|flex|grid|inline|inline-block|inline-flex|inline-grid|contents)(?=\s|$)/;
const BACKGROUND =
  /(^|\s)bg-(?!clip|origin|fixed|local|scroll|repeat|no-repeat|cover|contain|center|top|bottom|left|right|none|linear|radial|conic|gradient)/;
const BORDER_COLOR =
  /(^|\s)border-(brand|orange|purple|rose|transparent|ink|hairline|elevated|surface|\[)/;
const unless = (className, pattern, fallback) => (pattern.test(className || '') ? '' : fallback);
const buttonSizeParts = (className, parts) =>
  parts
    .filter(([pattern]) => !pattern.test(className || ''))
    .map(([, value]) => value)
    .join(' ');

const renderIcon = (icon, size) =>
  isValidElement(icon) ? icon : createElement(icon, { size, 'aria-hidden': true });

/* Escape-to-close plus focus hand-off/restore for overlay primitives. */
function useOverlayFocus(open, onClose, panelRef) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}

const buttonVariants = {
  primary:
    'border-brand bg-brand text-on-brand shadow-[0_10px_24px_-14px_var(--primary)] hover:border-brand-strong hover:bg-brand-strong',
  secondary: 'border-line bg-surface text-ink shadow-whisper hover:border-brand',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-elevated',
  outline: 'border-brand/60 bg-transparent text-brand-strong hover:border-brand hover:bg-brand/8',
  accent:
    'border-orange bg-orange text-on-orange shadow-[0_10px_24px_-14px_var(--accent-orange)] hover:bg-orange/88',
  tertiary:
    'border-purple bg-purple text-on-purple shadow-[0_10px_24px_-14px_var(--accent-purple)] hover:bg-purple/88',
  danger: 'border-rose/40 bg-rose/12 text-rose-strong hover:border-rose hover:bg-rose/18',
};

const MIN_HEIGHT = /(^|\s)min-h-/;
const PADDING_X = /(^|\s)(p|px)-/;
const PADDING_Y = /(^|\s)(p|py)-/;
const FONT_SIZE = /(^|\s)text-(xs|sm|base|lg|xl|\d|\[\d)/;
const GAP = /(^|\s)gap-/;

// [layout parts, trailing-icon right padding, trailing circle size, trailing icon px]
const buttonSizes = {
  sm: [
    [
      [MIN_HEIGHT, 'min-h-9 pointer-coarse:min-h-11'],
      [GAP, 'gap-1.5'],
      [PADDING_X, 'px-4'],
      [PADDING_Y, 'py-1.5'],
      [FONT_SIZE, 'text-xs'],
    ],
    'pr-1',
    'size-7',
    14,
  ],
  md: [
    [
      [MIN_HEIGHT, 'min-h-11'],
      [GAP, 'gap-2'],
      [PADDING_X, 'px-5'],
      [PADDING_Y, 'py-2.5'],
      [FONT_SIZE, 'text-sm'],
    ],
    'pr-1.5',
    'size-8',
    16,
  ],
  lg: [
    [
      [MIN_HEIGHT, 'min-h-12'],
      [GAP, 'gap-2.5'],
      [PADDING_X, 'px-6'],
      [PADDING_Y, 'py-3'],
      [FONT_SIZE, 'text-[15px]'],
    ],
    'pr-2',
    'size-9',
    18,
  ],
};

const trailingTones = {
  primary: 'bg-on-brand/15',
  accent: 'bg-on-orange/10',
  tertiary: 'bg-on-purple/15',
  danger: 'bg-rose/15',
};

function buttonClassName({ variant = 'primary', size = 'md', trailingIcon, className }) {
  const [sizeParts, trailingPad] = buttonSizes[size] || buttonSizes.md;
  return cn(
    'group/btn max-w-full select-none items-center justify-center border font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-spring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    unless(className, DISPLAY, 'inline-flex'),
    unless(className, RADIUS, 'rounded-full'),
    buttonSizeParts(className, sizeParts),
    trailingIcon && trailingPad,
    buttonVariants[variant] || buttonVariants.primary,
    className,
  );
}

function ButtonContent({ variant, size, trailingIcon, children }) {
  if (!trailingIcon) return children;
  const [, , circle, iconSize] = buttonSizes[size] || buttonSizes.md;
  return (
    <>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'ml-1 grid shrink-0 place-items-center rounded-full transition-transform duration-[420ms] ease-spring group-hover/btn:-translate-y-px group-hover/btn:translate-x-0.5 group-hover/btn:scale-105',
          circle,
          trailingTones[variant] || 'bg-brand/10 text-brand-strong',
        )}
      >
        {renderIcon(trailingIcon, iconSize)}
      </span>
    </>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  trailingIcon,
  className,
  children,
  ...props
}) {
  return (
    <button className={buttonClassName({ variant, size, trailingIcon, className })} {...props}>
      <ButtonContent variant={variant} size={size} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </button>
  );
}

/* Same look as Button for router navigation (Link semantics, no nested <button>). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  trailingIcon,
  className,
  children,
  ...props
}) {
  return (
    <Link className={buttonClassName({ variant, size, trailingIcon, className })} {...props}>
      <ButtonContent variant={variant} size={size} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}

const iconButtonTones = {
  neutral: 'border-line bg-surface text-ink hover:border-brand hover:text-brand',
  brand: 'border-transparent bg-brand/12 text-brand-strong hover:bg-brand/20',
  orange: 'border-transparent bg-orange/16 text-orange-strong hover:bg-orange/24',
  purple: 'border-transparent bg-purple/12 text-purple-strong hover:bg-purple/20',
  rose: 'border-transparent bg-rose/14 text-rose-strong hover:bg-rose/22',
};

// Small icon buttons keep a 36px look on fine pointers but get a full 44px square on touch.
const iconButtonSizes = { sm: 'size-9 pointer-coarse:size-11', md: 'size-11', lg: 'size-12' };

export function IconButton({
  label,
  tone = 'neutral',
  shape = 'square',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'shrink-0 place-items-center border transition-[background-color,border-color,color,transform] duration-200 ease-spring active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50',
        unless(className, DISPLAY, 'inline-grid'),
        unless(className, SIZE, iconButtonSizes[size] || iconButtonSizes.md),
        unless(className, RADIUS, shape === 'circle' ? 'rounded-full' : 'rounded-2xl'),
        iconButtonTones[tone] || iconButtonTones.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  as: Tag = 'section',
  bezel = false,
  interactive = false,
  className,
  innerClassName,
  children,
  ...props
}) {
  const lift =
    interactive &&
    'transition-[transform,box-shadow,border-color] duration-[420ms] ease-spring hover:-translate-y-0.5 hover:shadow-lift';
  if (bezel) {
    return (
      <Tag className={cn('nh-bezel', lift, className)} {...props}>
        <div
          className={cn(
            'nh-bezel-core h-full',
            unless(innerClassName, PADDING, 'p-6'),
            innerClassName,
          )}
        >
          {children}
        </div>
      </Tag>
    );
  }
  return (
    <Tag
      className={cn(
        'border shadow-whisper',
        unless(className, RADIUS, 'rounded-3xl'),
        unless(className, PADDING, 'p-6'),
        unless(className, BACKGROUND, 'bg-surface'),
        unless(className, BORDER_COLOR, 'border-line'),
        lift,
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

const badgeTones = {
  neutral: 'bg-ink/5 text-ink/75 ring-line/70',
  green: 'bg-brand/12 text-brand-strong ring-brand/20',
  orange: 'bg-orange/16 text-orange-strong ring-orange/28',
  red: 'bg-rose/14 text-rose-strong ring-rose/25',
  purple: 'bg-purple/12 text-purple-strong ring-purple/22',
  blue: 'bg-ink/7 text-ink ring-ink/12',
};
badgeTones.brand = badgeTones.green;
badgeTones.rose = badgeTones.red;
badgeTones.slate = badgeTones.blue;

export function Badge({ tone = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
        unless(className, DISPLAY, 'inline-flex'),
        badgeTones[tone] || badgeTones.neutral,
        className,
      )}
      {...props}
    />
  );
}

/*
 * Change indicator for mock/API strings such as '↑ 14%', '↓ 1 hạng', 'MỚI' or '—'.
 * Text arrows are replaced by Folio SVG arrows; the direction is also announced in text.
 */
const TREND = {
  up: { tone: 'green', icon: ArrowUp, sr: 'Tăng ' },
  down: { tone: 'rose', icon: ArrowUp, flip: true, sr: 'Giảm ' },
  new: { tone: 'purple', icon: Sparkles, sr: '' },
  flat: { tone: 'neutral', icon: null, sr: 'Không đổi' },
};
// eslint-disable-next-line react-refresh/only-export-components
export function parseTrend(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^([↑↓▲▼])\s*(.*)$/u);
  if (match) return { direction: /[↑▲]/u.test(match[1]) ? 'up' : 'down', label: match[2] };
  if (/^(mới|new)$/iu.test(text)) return { direction: 'new', label: text };
  if (!text || /^[—–-]$/u.test(text)) return { direction: 'flat', label: '' };
  return { direction: 'flat', label: text };
}
export function Trend({ value, variant = 'badge', className }) {
  const { direction, label } = parseTrend(value);
  const { tone, icon: Icon, flip, sr } = TREND[direction];
  const content = (
    <>
      {Icon ? (
        <Icon size={12} strokeWidth={2.25} className={cn('shrink-0', flip && 'rotate-180')} />
      ) : (
        !label && <span aria-hidden="true" className="h-0.5 w-2.5 rounded-full bg-current" />
      )}
      <span className="sr-only">{sr}</span>
      {label}
    </>
  );
  if (variant === 'inline') {
    const color = {
      up: 'text-brand-strong',
      down: 'text-rose-strong',
      new: 'text-purple-strong',
      flat: 'text-ink/70',
    }[direction];
    return (
      <span
        className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', color, className)}
      >
        {content}
      </span>
    );
  }
  return (
    <Badge tone={tone} className={cn('gap-1 tabular-nums', className)}>
      {content}
    </Badge>
  );
}

export function Input({ icon: Icon, trailing, className, ...props }) {
  return (
    <label
      data-input-shell
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2.5 rounded-full border border-line bg-surface pl-4',
        trailing ? 'pr-1.5' : 'pr-4',
        className,
      )}
    >
      {Icon && <Icon size={18} className="text-muted" />}
      <input
        className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none sm:text-sm"
        {...props}
      />
      {trailing}
    </label>
  );
}

/* Select: native-<select>-compatible API rendered as a WAI-ARIA select-only combobox. */
const LISTBOX_GAP = 6;
const LISTBOX_EDGE = 8;
const LISTBOX_MAX_HEIGHT = 320;
const LISTBOX_MAX_WIDTH = 352;
const TYPEAHEAD_RESET_MS = 500;

// Diacritics-insensitive comparison so "tieng" matches "Tiếng" and "d" matches "đ".
const foldText = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

const nodeText = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  return isValidElement(node) ? nodeText(node.props.children) : '';
};

/* Flattens <option>/<optgroup>/fragment children into items the way a native select reads them. */
function collectOptions(children, group = null, items = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const { props } = child;
    if (child.type === Fragment) {
      collectOptions(props.children, group, items);
    } else if (child.type === 'optgroup') {
      collectOptions(
        props.children,
        { label: props.label, disabled: Boolean(props.disabled) },
        items,
      );
    } else if (child.type === 'option') {
      const text = nodeText(props.children).replace(/\s+/g, ' ').trim();
      items.push({
        value: String(props.value ?? text),
        label: props.label ?? text,
        disabled: Boolean(props.disabled || group?.disabled),
        group,
      });
    }
  });
  return items;
}

/* Moves `count` enabled options from `from` in `direction`, stopping at the last enabled one. */
function moveIndex(items, from, direction, count = 1) {
  let index = from;
  let remaining = count;
  for (let i = from + direction; i >= 0 && i < items.length && remaining > 0; i += direction) {
    if (!items[i].disabled) {
      index = i;
      remaining -= 1;
    }
  }
  return index;
}

/*
 * Positions the fixed layer under the trigger (or above it when there is more room there),
 * clamps it inside the viewport and compensates for any containing block (e.g. a dialog
 * scrim with backdrop-filter). The layer itself never animates, so its rect is exact.
 */
function placeListbox(trigger, layer, list) {
  if (!trigger || !layer || !list) return;
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = viewportWidth - LISTBOX_EDGE * 2;
  list.style.minWidth = `${Math.min(rect.width, maxWidth)}px`;
  list.style.maxWidth = `${Math.min(maxWidth, Math.max(rect.width, LISTBOX_MAX_WIDTH))}px`;
  list.style.maxHeight = 'none';
  const below = viewportHeight - rect.bottom - LISTBOX_GAP - LISTBOX_EDGE;
  const above = rect.top - LISTBOX_GAP - LISTBOX_EDGE;
  const flip = Math.min(list.offsetHeight, LISTBOX_MAX_HEIGHT) > below && above > below;
  list.style.maxHeight = `${Math.max(Math.min(LISTBOX_MAX_HEIGHT, flip ? above : below), 0)}px`;
  list.dataset.side = flip ? 'top' : 'bottom';
  const top = flip ? rect.top - LISTBOX_GAP - list.offsetHeight : rect.bottom + LISTBOX_GAP;
  const left = Math.max(
    LISTBOX_EDGE,
    Math.min(rect.left, viewportWidth - list.offsetWidth - LISTBOX_EDGE),
  );
  layer.style.left = '0px';
  layer.style.top = '0px';
  const origin = layer.getBoundingClientRect();
  layer.style.left = `${left - origin.left}px`;
  layer.style.top = `${top - origin.top}px`;
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  onClick,
  onKeyDown,
  onBlur,
  name,
  required,
  disabled,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (index) => `${baseId}-option-${index}`;
  const triggerRef = useRef(null);
  const layerRef = useRef(null);
  const listRef = useRef(null);
  const optionRefs = useRef([]);
  const typeaheadRef = useRef({ buffer: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [host, setHost] = useState(null);
  const [listLabel, setListLabel] = useState('');
  const [innerValue, setInnerValue] = useState(defaultValue);

  const items = collectOptions(children);
  const current = String((value !== undefined ? value : innerValue) ?? '');
  const matched = items.findIndex((item) => item.value === current);
  // Like a native select, an unmatched value displays the first enabled option.
  const selectedIndex = matched >= 0 ? matched : moveIndex(items, -1, 1);
  const selected = items[selectedIndex];

  const openList = (index = selectedIndex) => {
    if (disabled || !items.length) return;
    const trigger = triggerRef.current;
    // Inside a dialog the list stays in the dialog's subtree so aria-modal does not hide it.
    setHost(trigger.closest('[role="dialog"]') ?? document.body);
    setListLabel(
      ariaLabel ?? Array.from(trigger.labels ?? [], (label) => label.textContent.trim()).join(' '),
    );
    setActive(index);
    setOpen(true);
  };

  const commit = (index) => {
    setOpen(false);
    const item = items[index];
    if (!item || item.disabled || item.value === current) return;
    if (value === undefined) setInnerValue(item.value);
    const target = { value: item.value, name, id };
    onChange?.({
      type: 'change',
      target,
      currentTarget: target,
      preventDefault() {},
      stopPropagation() {},
    });
  };

  const findTypeahead = (key, from) => {
    const typeahead = typeaheadRef.current;
    window.clearTimeout(typeahead.timer);
    typeahead.buffer += foldText(key);
    typeahead.timer = window.setTimeout(() => {
      typeahead.buffer = '';
    }, TYPEAHEAD_RESET_MS);
    const { buffer } = typeahead;
    // Repeating one letter cycles through options starting with it; a word keeps the current match.
    const repeated = [...buffer].every((char) => char === buffer[0]);
    const query = repeated ? buffer[0] : buffer;
    const start = Math.max(from, 0) + (repeated ? 1 : 0);
    for (let step = 0; step < items.length; step += 1) {
      const index = (start + step) % items.length;
      if (!items[index].disabled && foldText(items[index].label).startsWith(query)) return index;
    }
    return -1;
  };

  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    const { key, altKey, ctrlKey, metaKey } = event;
    const typing = typeaheadRef.current.buffer !== '';
    const printable =
      key.length === 1 &&
      !ctrlKey &&
      !metaKey &&
      !altKey &&
      !event.nativeEvent.isComposing &&
      (key !== ' ' || typing);
    if (!open) {
      if (printable) {
        event.preventDefault();
        const match = findTypeahead(key, selectedIndex);
        openList(match >= 0 ? match : selectedIndex);
      } else if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        openList();
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault();
        openList(key === 'Home' ? moveIndex(items, -1, 1) : moveIndex(items, items.length, -1));
      }
      return;
    }
    const moves = {
      ArrowDown: () => moveIndex(items, active, 1),
      ArrowUp: () => moveIndex(items, active, -1),
      Home: () => moveIndex(items, -1, 1),
      End: () => moveIndex(items, items.length, -1),
      PageDown: () => moveIndex(items, active, 1, 10),
      PageUp: () => moveIndex(items, active, -1, 10),
    };
    if (printable) {
      event.preventDefault();
      const match = findTypeahead(key, active);
      if (match >= 0) setActive(match);
    } else if (key === 'Enter' || key === ' ' || (key === 'ArrowUp' && altKey)) {
      event.preventDefault();
      commit(active);
    } else if (key === 'Escape') {
      // Keep the Escape from also closing an enclosing Modal/Drawer.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (key === 'Tab') {
      commit(active);
    } else if (moves[key]) {
      event.preventDefault();
      setActive(moves[key]());
    }
  };

  useLayoutEffect(() => {
    if (!open || !host) return undefined;
    const place = () => placeListbox(triggerRef.current, layerRef.current, listRef.current);
    place();
    const inside = (target) =>
      triggerRef.current?.contains(target) || layerRef.current?.contains(target);
    const onPointerDown = (event) => {
      if (!inside(event.target)) setOpen(false);
    };
    // A fixed list would detach from a scrolled trigger, so any outside scroll closes it.
    const onScroll = (event) => {
      if (!inside(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', place);
    };
  }, [open, host]);

  // Keep the active option visible inside the list without scrolling the page.
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = optionRefs.current[active];
    if (!open || !list || !option) return;
    const top = option.offsetTop - LISTBOX_GAP;
    const bottom = option.offsetTop + option.offsetHeight + LISTBOX_GAP;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [open, active]);

  useEffect(() => {
    const typeahead = typeaheadRef.current;
    return () => window.clearTimeout(typeahead.timer);
  }, []);

  const sections = [];
  items.forEach((item, index) => {
    const last = sections[sections.length - 1];
    if (last && last.group === item.group) last.entries.push(index);
    else sections.push({ group: item.group, entries: [index] });
  });

  const renderOption = (index) => {
    const item = items[index];
    const isSelected = index === selectedIndex;
    return (
      <div
        key={index}
        ref={(node) => {
          optionRefs.current[index] = node;
        }}
        id={optionId(index)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={item.disabled || undefined}
        data-active={index === active || undefined}
        onPointerMove={() => {
          if (!item.disabled && index !== active) setActive(index);
        }}
        onClick={() => {
          if (item.disabled) return;
          commit(index);
          triggerRef.current?.focus({ preventScroll: true });
        }}
        className={cn(
          'flex min-h-10 select-none items-center gap-3 rounded-xl px-3 py-2 text-sm pointer-coarse:min-h-11',
          item.disabled
            ? 'cursor-not-allowed text-muted opacity-60'
            : 'cursor-pointer data-[active]:bg-elevated',
          isSelected ? 'font-semibold text-brand-strong' : !item.disabled && 'text-ink',
        )}
      >
        <span className="min-w-0 flex-1">{item.label}</span>
        <Check
          size={16}
          strokeWidth={2.25}
          className={cn('shrink-0', !isSelected && 'invisible')}
        />
      </div>
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-required={required || undefined}
        disabled={disabled}
        title={items[selectedIndex]?.label || undefined}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={handleKeyDown}
        // Space activates buttons on keyup; the keydown handler already toggled the list.
        onKeyUp={(event) => {
          if (event.key === ' ') event.preventDefault();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          setOpen(false);
        }}
        className={cn(
          'inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-full border border-line bg-surface pl-4 pr-3 text-left text-sm text-ink outline-none transition-colors hover:border-[var(--color-rule-strong)] focus:border-brand disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-brand',
          className,
        )}
        {...props}
      >
        {/* Every label shares one grid cell so the pill is as wide as its longest option. */}
        <span className="grid min-w-0 flex-auto">
          {items.length ? (
            items.map((item, index) => (
              <span
                key={index}
                className={cn(
                  'col-start-1 row-start-1 truncate',
                  index !== selectedIndex && 'invisible',
                )}
              >
                {item.label}
              </span>
            ))
          ) : (
            <span>{'\u00a0'}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-muted transition-transform duration-200 ease-spring',
            open && 'rotate-180',
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={selected?.value ?? ''} />}
      {open &&
        host &&
        createPortal(
          <div ref={layerRef} className="fixed left-0 top-0 z-[110]">
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabelledby ? undefined : listLabel || undefined}
              aria-labelledby={ariaLabelledby}
              // Keeps focus (and aria-activedescendant) on the trigger for clicks and scrollbar drags.
              onMouseDown={(event) => event.preventDefault()}
              className="nh-listbox w-max overflow-y-auto overscroll-contain rounded-2xl border border-hairline bg-surface p-1.5 shadow-float"
            >
              {sections.map(({ group, entries }, sectionIndex) =>
                group ? (
                  <div
                    key={sectionIndex}
                    role="group"
                    aria-labelledby={`${baseId}-group-${sectionIndex}`}
                  >
                    <div
                      id={`${baseId}-group-${sectionIndex}`}
                      className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted"
                    >
                      {group.label}
                    </div>
                    {entries.map(renderOption)}
                  </div>
                ) : (
                  <Fragment key={sectionIndex}>{entries.map(renderOption)}</Fragment>
                ),
              )}
            </div>
          </div>,
          host,
        )}
    </>
  );
}

export function Tabs({ items, value, onChange, label, singleRow = false, className }) {
  const railRef = useRef(null);
  useEffect(() => {
    // Keep the active tab visible inside a horizontally scrolling single-row rail.
    const rail = railRef.current;
    if (!singleRow || !rail) return;
    const active = rail.querySelector('[aria-pressed="true"]');
    if (!active) return;
    const left = active.offsetLeft - rail.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < rail.scrollLeft) rail.scrollLeft = left - 4;
    else if (right > rail.scrollLeft + rail.clientWidth)
      rail.scrollLeft = right - rail.clientWidth + 4;
  }, [value, singleRow]);
  return (
    <div
      ref={railRef}
      role="group"
      aria-label={label}
      className={cn(
        'nh-tab-rail inline-flex max-w-full gap-1 rounded-[1.375rem] border border-hairline bg-elevated p-1',
        singleRow ? 'flex-nowrap overflow-x-auto' : 'flex-wrap',
        className,
      )}
    >
      {items.map((item) => {
        const active = value === item.value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-spring pointer-coarse:min-h-11',
              active
                ? 'bg-brand text-on-brand shadow-[0_6px_16px_-10px_var(--primary)]'
                : 'text-ink/70 hover:bg-surface/80 hover:text-ink',
            )}
          >
            {Icon && <Icon size={16} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ name = 'Người dùng NovelHub', src, className }) {
  return src ? (
    <img
      className={cn('rounded-full object-cover', unless(className, SIZE, 'size-10'), className)}
      src={src}
      alt={name}
    />
  ) : (
    <span
      aria-label={name}
      className={cn(
        'inline-grid place-items-center rounded-full bg-brand font-semibold text-on-brand',
        unless(className, SIZE, 'size-10'),
        className,
      )}
    >
      {name[0]}
    </span>
  );
}

/* Locks page scrolling while an overlay is open; nested overlays restore in order. */
function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);
}

export function Modal({ open, title, onClose, className, children }) {
  const { t } = useLocale();
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayFocus(open, onClose, panelRef);
  useScrollLock(open);
  if (!open) return null;
  // Portaled to <body> so page stacking contexts (isolation, transforms) can't trap the dialog.
  return createPortal(
    <div
      className="nh-fade-enter fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-scrim p-4 backdrop-blur-sm"
      // Tapping the backdrop (not the panel) closes, which phones rely on.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'nh-dialog-enter max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-3xl border border-line bg-elevated p-6 shadow-float outline-none',
          unless(className, /(^|\s)max-w-/, 'max-w-lg'),
          className,
        )}
      >
        {/* Title row stays visible while long dialog content scrolls. */}
        <div className="sticky -top-6 z-10 -mx-6 -mt-6 mb-4 flex items-center justify-between gap-4 bg-elevated px-6 pb-3 pt-6">
          <h2 id={titleId} className="text-h3">
            {title}
          </h2>
          <IconButton label={t('common.close')} onClick={onClose} size="sm" shape="circle">
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, title, onClose, children, docked = false }) {
  const { t } = useLocale();
  const panelRef = useRef(null);
  const titleId = useId();
  useOverlayFocus(open, onClose, panelRef);
  useScrollLock(open && !docked);
  return createPortal(
    <>
      {open && !docked && (
        // The drawer owns its backdrop so it always dims the whole app, header included.
        <button
          type="button"
          tabIndex={-1}
          aria-label={t('common.close')}
          className="nh-fade-enter fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal={open && !docked ? true : undefined}
        tabIndex={-1}
        aria-labelledby={titleId}
        className={cn(
          docked
            ? 'fixed right-0 top-[var(--app-header-h)] bottom-0 z-40 w-96 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-l-2xl border-l border-line bg-surface p-6 shadow-float outline-none transition-transform duration-[420ms] ease-spring motion-reduce:transition-none'
            : 'fixed inset-x-0 bottom-0 z-50 max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-elevated p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-float outline-none transition-transform duration-[420ms] ease-spring sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-sm sm:rounded-tr-none sm:rounded-l-3xl sm:border-l sm:border-t-0',
          open
            ? 'translate-x-0 translate-y-0'
            : docked
              ? 'translate-x-full'
              : 'translate-y-full sm:translate-x-full sm:translate-y-0',
        )}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-h3">
            {title}
          </h2>
          <IconButton label={t('common.close')} onClick={onClose} size="sm" shape="circle">
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </aside>
    </>,
    document.body,
  );
}

export function PageContainer({ className, ...props }) {
  return (
    <main
      className={cn('mx-auto w-full max-w-[1360px] px-5 py-8 md:px-8 lg:px-12', className)}
      {...props}
    />
  );
}

export function SectionHeader({ title, description, action, eyebrow }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="nh-eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-h3 md:text-h2">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink/70">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* Fade-up + blur entry when scrolled into view. Reduced motion shows content immediately. */
export function Reveal({ as: Tag = 'div', delay = 0, className, style, children, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      node.dataset.visible = 'true';
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        node.dataset.visible = 'true';
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={cn('nh-reveal', className)}
      style={delay ? { ...style, '--reveal-delay': `${delay}ms` } : style}
      {...props}
    >
      {children}
    </Tag>
  );
}

const progressTones = {
  brand: 'bg-brand',
  orange: 'bg-orange',
  purple: 'bg-purple',
  rose: 'bg-rose',
};
const progressSizes = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

export function ProgressBar({
  value = 0,
  max = 100,
  tone = 'brand',
  size = 'md',
  label,
  className,
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        'w-full overflow-hidden rounded-full bg-ink/8',
        progressSizes[size] || progressSizes.md,
        className,
      )}
    >
      <div
        className={cn(
          'h-full w-full rounded-full transition-[transform,opacity] duration-[800ms] ease-spring',
          percent === 0 && 'opacity-0',
          progressTones[tone] || progressTones.brand,
        )}
        style={{ transform: `translateX(${percent - 100}%)` }}
      />
    </div>
  );
}

/*
 * Skeleton placeholders: a token-tinted block with a transform-only shimmer (static under reduced
 * motion). Shape them like the final content; wrap groups in an element with aria-busy.
 */
export function Skeleton({ as: Tag = 'span', className }) {
  return (
    <Tag
      aria-hidden="true"
      className={cn('nh-skeleton block', unless(className, RADIUS, 'rounded-full'), className)}
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <span aria-hidden="true" className={cn('block space-y-2.5', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </span>
  );
}

/* Card-shaped placeholder for grid/list loading states. */
export function SkeletonCard({ media = false, lines = 2, className }) {
  return (
    <Card as="div" aria-hidden="true" className={cn('space-y-4', className)}>
      {media && <Skeleton className="aspect-[16/10] w-full rounded-2xl" />}
      <Skeleton className="h-5 w-2/3" />
      <SkeletonText lines={lines} />
    </Card>
  );
}

const emptyTones = {
  brand: 'bg-brand/10 text-brand-strong',
  rose: 'bg-rose/14 text-rose-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
};

/* `tone="rose"` marks an error state: rose icon tile and role=alert so it is announced. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingAs = 'h2',
  tone = 'brand',
  className,
}) {
  const Heading = headingAs;
  return (
    <div
      role={tone === 'rose' ? 'alert' : undefined}
      className={cn('flex flex-col items-center px-6 py-14 text-center', className)}
    >
      {Icon && (
        <span
          className={cn(
            'grid size-14 place-items-center rounded-2xl',
            emptyTones[tone] || emptyTones.brand,
          )}
        >
          <Icon size={24} />
        </span>
      )}
      <Heading className="mt-4 text-base font-semibold text-ink">{title}</Heading>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
