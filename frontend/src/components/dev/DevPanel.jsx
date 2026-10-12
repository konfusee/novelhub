import { useId, useState } from 'react';
import { FlaskConical, X } from '../icons';
import { useTheme } from '../../context/ThemeContext';
import { MOCK_LATENCIES, useMockData } from '../../context/MockDataContext';
import { ApiStatus } from '../ApiStatus';
import { Select } from '../ui';
export function DevPanel() {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { data, setSimulation, setLatency, reset } = useMockData();
  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[100] text-ink">
      {open && (
        <div className="nh-dialog-enter mb-2 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-3xl border border-line bg-surface p-4 shadow-float">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">Công cụ kiểm thử NovelHub</strong>
            <button
              type="button"
              aria-label="Đóng công cụ kiểm thử"
              className="grid size-8 place-items-center rounded-full text-muted hover:bg-elevated hover:text-ink"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 text-xs text-muted">
            <ApiStatus />
          </div>
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
            optionLabels={{
              normal: 'Bình thường',
              loading: 'Đang tải',
              empty: 'Trống',
              error: 'Lỗi',
            }}
            onChange={setSimulation}
          />
          <Control
            label="Độ trễ mạng mô phỏng"
            value={String(data.latency ?? 0)}
            options={MOCK_LATENCIES.map(String)}
            optionLabels={{ 0: 'Tức thì', 450: '450 ms', 1200: '1,2 giây', 2500: '2,5 giây' }}
            onChange={setLatency}
          />
          <button
            type="button"
            onClick={reset}
            className="mt-4 w-full rounded-full border border-line px-3 py-2 text-xs font-medium hover:border-brand"
          >
            Đặt lại dữ liệu mô phỏng
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-auto grid size-12 place-items-center rounded-full bg-purple text-on-purple shadow-lift transition-transform duration-200 ease-spring active:scale-[0.96]"
        aria-label="Mở công cụ kiểm thử"
      >
        <FlaskConical size={20} />
      </button>
    </div>
  );
}
function Control({ label, value, options, optionLabels = {}, onChange }) {
  const id = useId();
  return (
    <div className="mt-3">
      <label
        htmlFor={id}
        className="block text-[10px] font-semibold uppercase tracking-wider text-muted"
      >
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {optionLabels[item] ?? item}
          </option>
        ))}
      </Select>
    </div>
  );
}
