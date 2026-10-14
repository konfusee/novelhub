import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import { PublicHeader } from './PublicHeader';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, hasRole: () => false }),
  getAccountHome: () => '/reader',
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));
vi.mock('../../context/LocaleContext', () => ({
  useLocale: () => ({ t: (key) => key }),
}));

afterEach(cleanup);

function Location() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
}

function setup(path = '/search') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <PublicHeader />
      <Location />
    </MemoryRouter>,
  );
  return screen.queryByRole('searchbox');
}

describe('guest header search', () => {
  it('submits an encoded, trimmed query from the inline input', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: '  moon & stars  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.search' }));
    expect(screen.getByTestId('location').textContent).toBe('/search?q=moon+%26+stars');
    expect(screen.getByRole('searchbox')).toBe(input);
  });

  it('navigates to /search when the magnifier is clicked without a query', () => {
    expect(setup('/')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'common.search' }));
    expect(screen.getByTestId('location').textContent).toBe('/search');
    expect(screen.getByRole('searchbox')).toBeTruthy();
  });

  it('submits through the search form', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'moon' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('location').textContent).toBe('/search?q=moon');
  });
});
