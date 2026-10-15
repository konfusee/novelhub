/* Hallmark · component: input · genre: editorial · theme: Studio
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */
import { Mail } from '../icons';
import { Input } from './index';

const states = [
  ['Mặc định', {}],
  ['Di chuột', { className: 'border-[var(--color-rule-strong)]' }],
  ['Tập trung', { className: 'border-brand outline outline-2 outline-[var(--color-focus)]' }],
  ['Đang nhập', { defaultValue: 'reader@novelhub.vn' }],
  ['Vô hiệu hóa', { disabled: true }],
  ['Đang tải', { 'data-state': 'loading', readOnly: true }],
  ['Lỗi', { 'aria-invalid': true }],
  ['Hợp lệ', { 'data-state': 'success', defaultValue: 'reader@novelhub.vn' }],
];

export function InputPreview() {
  return (
    <section className="mx-auto grid max-w-2xl gap-4 p-6">
      <h1 className="text-2xl">Input — 8 trạng thái</h1>
      {states.map(([label, props]) => (
        <label className="grid gap-2" key={label}>
          <span className="text-xs font-semibold text-muted">{label}</span>
          <Input icon={Mail} placeholder="Địa chỉ email" {...props} />
        </label>
      ))}
    </section>
  );
}
