import { useMockData } from '../../context/MockDataContext';

/* Thin indeterminate bar at the top of the viewport while any data request or route chunk loads. */
export function TopProgress({ active = false }) {
  const { pending } = useMockData();
  if (!active && pending === 0) return null;
  return (
    <div
      role="progressbar"
      aria-label="Đang tải"
      aria-busy="true"
      className="nh-top-progress nh-fade-enter"
    />
  );
}
