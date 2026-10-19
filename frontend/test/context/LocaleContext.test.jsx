import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { LocaleProvider, useLocale } from '../../src/context/LocaleContext';
import { localeContext } from '../../src/context/localeContextValue';
afterEach(cleanup);
function Consumer() {
  const locale = useLocale();
  return (
    <>
      <p>{locale.t('policyHistory.title')}</p>
      <p>{locale.t('policyHistory.coinRange', { min: 300, max: 900 })}</p>
      <p>{locale.formatNumber(150000)}</p>
      <p>{locale.formatDate('2026-01-01T00:00:00Z')}</p>
    </>
  );
}
it('uses the independently owned context identity so refreshed hooks still read an existing provider', () => {
  const external = {
    t: (key) => (key === 'policyHistory.title' ? 'Shared context identity' : key),
    formatNumber: String,
    formatDate: String,
  };
  render(
    <localeContext.Provider value={external}>
      <Consumer />
    </localeContext.Provider>,
  );
  expect(screen.getByText('Shared context identity')).toBeTruthy();
});
it('keeps real Vietnamese translation, interpolation and formatting through the public provider API', () => {
  render(
    <LocaleProvider>
      <Consumer />
    </LocaleProvider>,
  );
  expect(screen.getByText('Lịch sử chính sách')).toBeTruthy();
  expect(screen.getByText('300–900 xu')).toBeTruthy();
  expect(screen.getByText('150.000')).toBeTruthy();
  expect(screen.getByText('1 thg 1, 2026')).toBeTruthy();
});
