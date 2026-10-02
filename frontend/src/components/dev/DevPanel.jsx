import { useState } from 'react'
import { FlaskConical, X } from '../icons'
import { useNavigate } from 'react-router-dom'
import { getAccountHome, useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useMockData } from '../../context/MockDataContext'
export function DevPanel() {
  const [open, setOpen] = useState(false)
  const { currentUser, switchAccount } = useAuth()
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
            <strong className="text-sm">Công cụ kiểm thử NovelHub</strong>
            <button aria-label="Đóng công cụ kiểm thử" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <Control
            label="Tài khoản"
            value={currentUser?.roles?.at(-1) || 'guest'}
            options={['guest', 'reader', 'author', 'moderator', 'admin']}
            optionLabels={{ guest: 'Khách', reader: 'Độc giả', author: 'Tác giả', moderator: 'Kiểm duyệt viên', admin: 'Quản trị viên' }}
            onChange={changeAccount}
          />
          <Control
            label="Giao diện"
            value={resolvedTheme}
            options={['light', 'dark']}
            optionLabels={{ light: 'Sáng', dark: 'Tối' }}
            onChange={setTheme}
          />
          <Control
            label="Trạng thái"
            value={data.simulation}
            options={['normal', 'loading', 'empty', 'error']}
            optionLabels={{ normal: 'Bình thường', loading: 'Đang tải', empty: 'Trống', error: 'Lỗi' }}
            onChange={setSimulation}
          />
          <button
            onClick={reset}
            className="mt-4 w-full rounded-xl border border-line px-3 py-2 text-xs"
          >
            Đặt lại dữ liệu mô phỏng
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="ml-auto grid size-12 place-items-center rounded-full bg-purple text-white shadow-xl"
        aria-label="Mở công cụ kiểm thử"
      >
        <FlaskConical size={20} />
      </button>
    </div>
  )
}
function Control({ label, value, options, optionLabels = {}, onChange }) {
  return (
    <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-ink"
      >
        {options.map(item => (
          <option key={item} value={item}>{optionLabels[item] ?? item}</option>
        ))}
      </select>
    </label>
  )
}
