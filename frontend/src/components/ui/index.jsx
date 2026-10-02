import { X } from '../icons'
import { useLocale } from '../../context/LocaleContext'
const cn = (...classes) => classes.filter(Boolean).join(' ')
export function Button({ variant = 'primary', className, ...props }) {
  const styles = {
    primary: 'bg-brand text-white border-brand hover:opacity-90',
    secondary: 'bg-surface text-ink border-line hover:border-brand',
    ghost: 'bg-transparent text-ink border-transparent hover:bg-elevated',
  }
  return (
    <button
      className={cn(
        'inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
export function IconButton({ label, className, children, ...props }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface text-ink hover:border-brand hover:text-brand',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
export function Card({ className, ...props }) {
  return (
    <section
      className={cn('rounded-3xl border border-line bg-surface p-6', className)}
      {...props}
    />
  )
}
export function Badge({ tone = 'neutral', className, ...props }) {
  const tones = {
    neutral: 'bg-elevated text-muted',
    green: 'bg-brand/15 text-brand',
    orange: 'bg-orange/20 text-orange',
    red: 'bg-rose/20 text-rose',
    purple: 'bg-purple/15 text-purple',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
export function Input({ icon: Icon, className, ...props }) {
  return (
    <label
      data-input-shell
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border border-line bg-surface px-3',
        className,
      )}
    >
      {Icon && <Icon size={18} className="text-muted" />}
      <input
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-none"
        {...props}
      />
    </label>
  )
}
export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'min-h-11 min-w-0 max-w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink outline-none focus:border-brand',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
export function Tabs({ items, value, onChange, label, singleRow = false }) {
  return (
    <div role="group" aria-label={label} className={`nh-tab-rail inline-flex max-w-full gap-1 rounded-2xl border border-line bg-elevated p-1 ${singleRow ? 'flex-nowrap overflow-x-auto' : 'flex-wrap'}`}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'shrink-0 rounded-xl px-4 py-2 text-sm font-medium',
            value === item.value ? 'bg-surface text-brand' : 'text-muted',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
export function Avatar({ name = 'Người dùng NovelHub', src, className }) {
  return src ? (
    <img className={cn('size-10 rounded-full object-cover', className)} src={src} alt={name} />
  ) : (
    <span
      aria-label={name}
      className={cn(
        'inline-grid size-10 place-items-center rounded-full bg-brand font-semibold text-white',
        className,
      )}
    >
      {name[0]}
    </span>
  )
}
export function Modal({ open, title, onClose, children }) {
  const { t } = useLocale()
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="w-full max-w-lg bg-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </Card>
    </div>
  )
}
export function Drawer({ open, title, onClose, children }) {
  const { t } = useLocale()
  return (
    <aside
      className={cn(
        'fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-line bg-elevated p-6 transition-transform',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
      aria-hidden={!open}
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <IconButton label={t('common.close')} onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      {children}
    </aside>
  )
}
export function PageContainer({ className, ...props }) {
  return (
    <main
      className={cn('mx-auto w-full max-w-[1360px] px-5 py-8 md:px-8 lg:px-12', className)}
      {...props}
    />
  )
}
export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
