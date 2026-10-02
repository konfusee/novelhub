import { ArrowRight } from '../icons'
import { Link } from 'react-router-dom'
export function SectionTitle({ children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">{children}</h2>
      <Link to="/search" className="flex items-center gap-1 text-xs font-semibold text-brand">
        Xem tất cả <ArrowRight size={14} />
      </Link>
    </div>
  )
}
