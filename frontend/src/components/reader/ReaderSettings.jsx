import { Headphones, Moon, Sun } from '../icons'

const OptionGroup = ({ label, values, value, onChange }) => (
  <div className="flex items-center gap-1">
    <span className="mr-1 text-[10px] text-muted">{label}</span>
    {values.map(item => (
      <button
        key={item.value}
        onClick={() => onChange(item.value)}
        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${value === item.value ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-ink'}`}
      >
        {item.label}
      </button>
    ))}
  </div>
)

export function ReaderSettings({
  fontSize,
  setFontSize,
  lineHeight,
  setLineHeight,
  width,
  setWidth,
  tone,
  setTone,
  ambient,
  setAmbient,
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-elevated p-2 shadow-sm">
      <strong className="text-[10px] text-brand">Aa Poppins</strong>
      <span className="hidden h-4 w-px bg-line sm:block" />
      <OptionGroup
        label="Size"
        value={fontSize}
        onChange={setFontSize}
        values={[
          { value: 16, label: 'Aa−' },
          { value: 18, label: 'Aa' },
          { value: 21, label: 'Aa+' },
        ]}
      />
      <OptionGroup
        label="Spacing"
        value={lineHeight}
        onChange={setLineHeight}
        values={[
          { value: 1.6, label: '1.5' },
          { value: 1.8, label: '1.8' },
          { value: 2, label: '2.0' },
        ]}
      />
      <OptionGroup
        label="Width"
        value={width}
        onChange={setWidth}
        values={[
          { value: 680, label: 'Narrow' },
          { value: 740, label: 'Standard' },
          { value: 760, label: 'Wide' },
        ]}
      />
      <div className="flex items-center gap-1.5">
        <button
          aria-label="Tông màu giấy cổ"
          onClick={() => setTone('parchment')}
          className={`size-6 rounded-full bg-[#fcf8f2] ${tone === 'parchment' ? 'ring-2 ring-brand' : 'border border-line'}`}
        />
        <button
          aria-label="Tông màu kem"
          onClick={() => setTone('cream')}
          className={`size-6 rounded-full bg-[#fffdf9] ${tone === 'cream' ? 'ring-2 ring-brand' : 'border border-line'}`}
        />
        <button
          aria-label="Tông màu đêm"
          onClick={() => setTone('midnight')}
          className={`grid size-6 place-items-center rounded-full bg-[#081321] text-white ${tone === 'midnight' ? 'ring-2 ring-brand' : 'border border-line'}`}
        >
          {tone === 'midnight' ? <Moon size={11} /> : <Sun size={11} />}
        </button>
      </div>
      <button
        onClick={() => setAmbient(!ambient)}
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${ambient ? 'bg-brand text-white' : 'text-muted'}`}
      >
        <Headphones size={13} /> Forest
      </button>
    </div>
  )
}
