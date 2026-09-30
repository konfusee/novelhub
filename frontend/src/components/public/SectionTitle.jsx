import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
export function SectionTitle({ children }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">{children}</h2>
      <Link to="/search" className="flex items-center gap-1 text-xs font-semibold text-brand">
        See all <ArrowRight size={14} />
      </Link>
    </div>
  )
}
