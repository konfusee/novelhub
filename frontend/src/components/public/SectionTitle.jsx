import { ArrowRight } from '../icons'
import { Link } from 'react-router'
import { useLocale } from '../../context/LocaleContext'

export function SectionTitle({ children, to = '/search', actionLabel }) {
  const { t } = useLocale()
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-h3 md:text-h2">{children}</h2>
      {to && (
        <Link
          to={to}
          className="group/see -my-1 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-brand-strong hover:bg-brand/8 pointer-coarse:min-h-11"
        >
          {actionLabel ?? t('common.seeAll')}
          <ArrowRight
            size={14}
            className="transition-transform duration-200 ease-spring group-hover/see:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  )
}
