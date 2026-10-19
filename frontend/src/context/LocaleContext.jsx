import { useContext, useMemo } from 'react';
import vi from '../locales/vi.json';
import { localeContext } from './localeContextValue';

function resolveMessage(dictionary, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], dictionary);
}

function interpolate(message, variables = {}) {
  return message.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `{{${key}}}`));
}

export function LocaleProvider({ children }) {
  const dictionary = vi;
  const value = useMemo(
    () => ({
      locale: 'vi',
      t: (key, variables) => {
        const message = resolveMessage(dictionary, key);
        if (typeof message !== 'string') {
          if (import.meta.env.DEV) console.warn(`[content] Thiếu nội dung tiếng Việt: ${key}`);
          return key;
        }
        return interpolate(message, variables);
      },
      formatDate: (valueToFormat) =>
        new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(valueToFormat)),
      formatNumber: (valueToFormat) => new Intl.NumberFormat('vi-VN').format(valueToFormat),
    }),
    [dictionary],
  );

  return <localeContext.Provider value={value}>{children}</localeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLocale = () => {
  const value = useContext(localeContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
};
