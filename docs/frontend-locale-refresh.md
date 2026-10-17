# Stable locale context during development refresh

The Vietnamese dictionary is imported by the locale provider/hook module. Previously that same module created the React Context. Updating the dictionary through Vite HMR could recreate the Context while an already mounted Provider retained the previous identity. Consumers then threw `useLocale must be used inside LocaleProvider`, leaving the settings page blank until a full reload.

The Context identity now lives in `frontend/src/context/localeContextValue.js`, a small module with no dictionary/provider imports. The existing `LocaleContext.jsx` exports remain unchanged for all callers. The provider memo depends on the current dictionary so refreshed text is not trapped in an old memo closure. No page layout, locale key, language choice, theme or application data is changed by this fix.

Unit tests verify that the public hook reads the independent shared Context identity and that Vietnamese translation, interpolation, number/date formatting still work. Browser validation uses the real settings page and an isolated MongoDB fixture; its temporary dictionary edit is restored byte-for-byte after the HMR check. Screenshots are stored outside the repository under `WDP301/outputs/author-progress-01a13e25/locale-refresh`.

## Verification result

- 42 tests across the locale Context, Admin policy/settings/history, Author chapter early access and Story Manager pass. The two locale tests protect the shared identity and the existing public formatting/translation behavior.
- Frontend lint, Vietnamese content validation, target formatting and production build pass.
- On the actual settings page backed by an isolated MongoDB fixture, enter a 350-coin price and a reason without saving. Change only `policyHistory.description` temporarily in the Vietnamese dictionary. The page displays the refreshed description without navigation/reload, retains both fields, and produces no warning/error console entries. Restore the dictionary byte-for-byte: the original description returns, both fields remain intact, and console entries remain empty. No database mutation is needed for this regression check.
- Responsive light/dark checks cover 390, 768, 1024 and 1536 pixels. Theme changes and resizing retain the unsaved form. The temporary fixture server and dictionary backup are removed after verification.
- A broader full frontend test run did not finish in the observed time and was interrupted. It is not reported as passing; the targeted 42-test run completed successfully. No backend tests are required for this frontend-only change.
