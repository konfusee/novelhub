# Author paid chapter publication

UC-AUT-08 and UC-AUT-10 (progress workbook numbering): approved chapters can use the existing release and scheduling flows with valid early-access settings. No model/schema changes.

- Release checks the referenced effective or superseded policy, price and duration bounds, approval, rights, parent publication and chapter order. Missing, draft or malformed policies block release.
- First publication starts the early-access window using server release time. Price, duration and policy reference remain the configured values. Replays and later revision publication retain the original expiry.
- Publication performs no wallet mutation. The reader unlock endpoint handles entitlement, debit and revenue allocation atomically. Expired access follows the existing free reading path.
- Invalid legacy paid settings remain blocked; publication never silently converts them to free chapters.
- AI and media extensions remain deferred per project scope.

Validation: chapter release and reader unlock integration suites; frontend locale validation and production build. No browser visual verification performed for this copy-only UI change.

This closes the paid-release blocker; it does not certify all UC-AUT-07–16. Regular monthly payouts for active authors still require separate completion and acceptance.
