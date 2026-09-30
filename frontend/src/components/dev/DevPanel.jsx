import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getAccountHome, useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { useTheme } from '../../context/ThemeContext'
import { useMockData } from '../../context/MockDataContext'
export function DevPanel() {
  const [open, setOpen] = useState(false)
  const { currentUser, switchAccount } = useAuth()
  const { locale, setLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const { data, setSimulation, reset } = useMockData()
  const navigate = useNavigate()
  const changeAccount = role => {
    const user = switchAccount(role)
    navigate(getAccountHome(user), { replace: true })
  }
  if (!import.meta.env.DEV) return null
  return (
    <div className="fixed bottom-4 right-4 z-[100] text-ink">
      {open && (
        <div className="mb-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <strong className="text-sm">NovelHub test tools</strong>
            <button aria-label="Close test tools" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <Control
            label="Account"
            value={currentUser?.roles?.at(-1) || 'guest'}
            options={['guest', 'reader', 'author', 'moderator', 'admin']}
            onChange={changeAccount}
          />
          <Control label="Language" value={locale} options={['en', 'vi']} onChange={setLocale} />
          <Control
            label="Theme"
            value={resolvedTheme}
            options={['light', 'dark']}
            onChange={setTheme}
          />
          <Control
            label="State"
            value={data.simulation}
            options={['normal', 'loading', 'empty', 'error']}
            onChange={setSimulation}
          />
          <button
            onClick={reset}
            className="mt-4 w-full rounded-xl border border-line px-3 py-2 text-xs"
          >
            Reset mock data
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto grid size-12 place-items-center rounded-full bg-purple text-white shadow-xl"
        aria-label="Open test tools"
      >
        <FlaskConical size={20} />
      </button>
    </div>
  )
}
function Control({ label, value, options, onChange }) {
  return (
    <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-ink"
      >
        {options.map(item => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  )
}
