import { Link } from 'react-router'
import { BookOpen, Headphones } from '../icons'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const MODES = [
  ['read', 'reader.modeRead', BookOpen, ROUTES.read],
  ['listen', 'reader.modeListen', Headphones, ROUTES.listen],
]

/* "Đọc | Nghe" segmented switch: the same chapter in the full reader or the audio player. */
export function ReadListenSwitch({ storyId, chapterId, mode, className = '' }) {
  const { t } = useLocale()
  return (
    <nav
      aria-label={t('reader.modeSwitch')}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-hairline bg-surface p-0.5 shadow-whisper ${className}`}
    >
      {MODES.map(([value, label, Icon, route]) => {
        const active = value === mode
        return (
          <Link
            key={value}
            to={route(storyId, chapterId)}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors pointer-coarse:min-h-11 ${active ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-ink/6 hover:text-ink'}`}
          >
            <Icon size={14} aria-hidden="true" />
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}
