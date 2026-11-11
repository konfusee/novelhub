# Backend architecture

NovelHub backend groups each feature under `src/modules/` and keeps HTTP wiring in
`src/routes/`:

- `src/routes/` maps HTTP methods and paths and applies authentication and role guards.
- `src/modules/` contains the feature's request validation, response shaping, transaction, ownership and query rules.
- `src/models/` contains Mongoose entities, schema validation, immutable fields and indexes.
- `src/middleware/` contains cross-cutting request concerns such as authentication, CSRF and error handling.
- `src/config/`, `src/db/`, `src/auth/` and `src/email/` provide infrastructure adapters and configuration.

Author finance lives in `src/modules/coins-payouts/finance/`. The author earnings,
bank-details and paginated payout-history endpoints are wired directly to those
finance modules.

## Module grouping

The module tree follows the five fields in `novelhub.md`. A field is the first
directory; role or technical responsibility is the second directory when that
keeps a large field easy to navigate:

```text
src/modules/
├── accounts-administration/
│   ├── admin/                 # Admin account, policy and audit operations
│   └── author-access/         # Author application, role and revocation flows
├── authoring-publishing/
│   ├── author/                # Author story, chapter, media and submission flows
│   ├── content/               # Shared chapter document and release scheduling helpers
│   ├── imports/               # PDF/document extraction
│   └── submissions/           # Submission digest and immutable package helpers
├── moderation-ai/
│   ├── ai/                    # Evidence, embeddings and LLM provider pipeline
│   ├── moderation/            # Moderator queues, decisions and report resolution
│   └── review-evidence.js     # Shared evidence state helpers
├── reading-community/
│   ├── catalog/               # Published catalogue queries and presentation
│   ├── reading/               # Access, progress, library and view tracking
│   └── community/             # Follows, ratings, comments and reports
└── coins-payouts/
    └── finance/               # Wallets, top-ups, unlocks, revenue and SePay
```

Routes import modules through these field paths. The grouping is organizational
only: the public service functions and database contracts remain unchanged.
