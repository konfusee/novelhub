# Backend architecture

NovelHub backend follows a small MVC boundary for each HTTP feature:

- `src/routes/` maps HTTP methods and paths, applies authentication and role guards, and delegates to a controller.
- `src/controllers/` validates request input and serializes the response. Controllers do not own database business rules.
- `src/services/` contains transaction, ownership, lifecycle and query rules. Services are the application layer called by controllers for a feature.
- `src/models/` contains Mongoose entities, schema validation, immutable fields and indexes.
- `src/middleware/` contains cross-cutting request concerns such as authentication, CSRF and error handling.
- `src/config/`, `src/db/`, `src/auth/` and `src/email/` provide infrastructure adapters and configuration.

Author finance is the reference MVC slice:

`GET /api/author/finance` provides the combined finance view. The existing
`GET /api/author/earnings`, bank-details and paginated payout-history endpoints
retain their contracts for the Coins & Payouts screens. The MVC payment-details
update endpoint remains available at `PUT /api/author/earnings/payment-details`.

```text
routes/author-finance.routes.js
  -> controllers/author/finance.controller.js
    -> services/author/finance.service.js
      -> models/identity and models/finance
```

Existing field modules under `src/modules/` remain service modules while the rest of the application is migrated. New Author screens should add a controller and service under the same feature boundary instead of putting business logic in a route handler.

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
