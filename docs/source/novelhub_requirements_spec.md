> Archived finance wording: manual withdrawal/approval/provider settlement in this source is superseded by the owner-confirmed 2026-11-12 finance amendment in [requirements-baseline](../requirements-baseline.md). A-UC-13.1 manual real-transfer result recording is removed from the current project/demo scope. Monthly payouts are automatic simulations; Admin views results and may auditably correct failed destinations.

# NovelHub Requirements Specification

**Project:** NovelHub – AI-Assisted Multimedia Novel Publishing & Reading Platform  
**Document status:** Draft  
**Audience:** Product owner, development team, QA, Moderator and Admin stakeholders  
**Language:** English requirements with domain terms preserved from the project proposal

---

## 1. Purpose and product vision

NovelHub is a platform for the complete lifecycle of multimedia novels:

```text
Create → Edit → Submit → Review → Publish → Discover → Read/Listen → Interact
```

The platform combines authoring, publishing, public discovery, authenticated reading, multimedia content, AI assistance, content moderation and a coin-based early-access model in one system.

NovelHub is not intended to make legal copyright judgments or replace authors and Moderators with AI. AI produces suggestions, metadata, similarity signals and review assistance. Human users retain control over content, publication and moderation decisions.

## 2. Product objectives

NovelHub shall:

1. Give Authors a structured workspace for stories, chapters, drafts, multimedia and formatted content.
2. Give Guests a meaningful public discovery experience before authentication.
3. Give Readers a complete reading/listening and interaction experience with saved personal progress.
4. Support accessible reading through Text-to-Speech integration.
5. Provide a review workflow that combines automatic AI-assisted analysis with final human moderation.
6. Reduce content-management risk through rights declarations, similarity warnings, reports and moderation history.
7. Support paid early access through coins while maintaining transparent Author/System revenue allocation.
8. Provide Admins with platform, wallet, transaction and withdrawal governance.

## 3. Scope

### 3.1 In scope

- Public story discovery and search.
- Guest registration, authentication and public preview reading.
- Reader profiles, reading, listening, progress, follows, ratings, comments and reports.
- Author applications, story/chapter authoring, drafts, templates, rich formatting and multimedia.
- Text-layer PDF import into editable drafts.
- AI writing and metadata assistance using OpenAI LLM.
- Automatic AI-assisted review when an Author submits content.
- Semantic embedding generation using OpenAI Embedding Service.
- Similarity warnings for Moderator review.
- Text-to-Speech through an external TTS Service.
- Media and document storage through VPSTTT Object Storage.
- Email delivery through Gmail SMTP Service.
- Google OAuth authentication.
- Coin top-up, early chapter unlock and transaction history.
- Author earnings, withdrawal requests and Admin approval/rejection.
- Payment Gateway integration for top-up and approved payout requests.
- User, role, category, content, finance and audit management by Admin.

### 3.2 Out of scope or conditional scope

The following are not required for the core release unless schedule and technical feasibility allow them:

- OCR for scanned/image-only PDFs.
- Guaranteed conversion of arbitrary PDF layouts into perfect chapters.
- Advanced video processing or video streaming features.
- Recommendation or personalization algorithms.
- A legally conclusive plagiarism or copyright infringement verdict.
- Automatic publication or automatic rejection by AI.
- Author payout without Admin approval.
- Direct bank-transfer workflow beyond the selected Payment Gateway contract.

## 4. System boundary

NovelHub owns the following responsibilities internally:

- Users, roles and permissions.
- Stories, chapters, metadata, formatting and publication state.
- Drafts, submissions, review state and moderation history.
- Rights declarations and media metadata.
- Reading progress, follows and interactions.
- Coin balances, top-up records, unlock entitlements and transaction ledger.
- Early-access expiry and free-access transition.
- Author earnings, the 70/30 allocation and the system wallet.
- Withdrawal requests, approval state and payout records.
- AI review orchestration and presentation of results to Moderators.
- Audit records and administrative reporting.

The following systems are outside the NovelHub boundary:

| External system | Responsibility |
|---|---|
| Authentication Provider (Google OAuth) | Authentication and identity claims |
| Payment Gateway | Top-up and approved payout processing |
| OpenAI LLM Service | Writing, summary, metadata and moderation suggestions |
| OpenAI Embedding Service | Text embedding generation |
| TTS Service | Text-to-speech generation |
| VPSTTT Object Storage | Storage and retrieval of media/PDF objects |
| Gmail SMTP Service | Outgoing email delivery and SMTP status |

External systems return results; NovelHub remains responsible for its own business rules, permissions and records.

## 5. Actors and responsibilities

### 5.1 Guest

A Guest is an unauthenticated visitor. Guest capabilities are the public subset of Reader capabilities plus onboarding:

- Browse the published catalog.
- Search and filter published stories.
- View public story and chapter information.
- Read or listen to limited public story content/audio where access is allowed.
- Register and authenticate.

A Guest cannot create personal reading state or authenticated interactions such as saved progress, follows, ratings, comments, reports or coin spending.

### 5.2 Reader

A Reader is an authenticated user who can:

- Perform all public discovery and reading capabilities available to a Guest.
- Manage profile data.
- Read/listen to accessible story content.
- Save and resume reading/listening progress.
- Follow or unfollow stories.
- Rate and comment on stories.
- Report content.
- Top up coins and request early chapter unlocks.
- View coin balance, top-up status and unlock results.

### 5.3 Author

An Author can:

- Apply for Author access.
- Create and edit stories and chapters.
- Use the required story/chapter formatting template.
- Save and manage drafts.
- Import supported text-layer PDFs.
- Upload and manage multimedia.
- Declare rights or licenses for submitted content.
- Use AI assistance for writing, summaries and metadata.
- Configure an early-access window and coin price.
- Submit content for review.
- View publication status, feedback, statistics and earnings.
- Request withdrawal of eligible earnings.

### 5.4 Moderator

A Moderator manages content quality and publication decisions:

- View pending submissions.
- View reported content.
- View similarity findings.
- View automatic AI review results and risk flags.
- Approve or reject, with actionable feedback for rejection.
- Resolve reports and apply content actions.
- View moderation history.

The Moderator is the final decision-maker for routine content review. AI results are advisory.

### 5.5 Admin

An Admin manages platform and financial governance:

- Manage users.
- Manage roles and permissions.
- Manage categories and platform content.
- View administrative records, statistics and audit logs.
- Manage coin rate and revenue policy.
- View pending withdrawal requests.
- Approve or reject withdrawal requests.
- Apply authorized wallet or transaction controls.
- View finance and wallet reports.
- Monitor the system wallet and its 30% share.

Admin does not replace the Moderator in routine story-content decisions.

## 6. Functional requirements

Priority values:

- **MUST:** required for the core system.
- **SHOULD:** important, but may be reduced if the implementation constraint is documented.
- **COULD:** optional/stretch scope.

### 6.1 Account and authentication

| ID | Priority | Requirement |
|---|---|---|
| FR-AUTH-01 | MUST | The system shall allow a Guest to register an account. |
| FR-AUTH-02 | MUST | The system shall allow a user to authenticate through the supported authentication flow. |
| FR-AUTH-03 | MUST | The system shall support Google OAuth through the Authentication Provider. |
| FR-AUTH-04 | MUST | The system shall associate a verified Google identity with a NovelHub account without allowing the provider to assign NovelHub roles. |
| FR-AUTH-05 | MUST | The system shall enforce NovelHub roles and permissions independently of authentication-provider identity claims. |
| FR-AUTH-06 | MUST | The system shall allow an authenticated user to view and update permitted profile data. |
| FR-AUTH-07 | MUST | The system shall reject unauthorized access to Reader, Author, Moderator and Admin operations. |

### 6.2 Public discovery and Guest access

| ID | Priority | Requirement |
|---|---|---|
| FR-GUEST-01 | MUST | The system shall allow a Guest to browse published stories. |
| FR-GUEST-02 | MUST | The system shall allow a Guest to search and filter published stories. |
| FR-GUEST-03 | MUST | The system shall return search results consistent with the submitted criteria. |
| FR-GUEST-04 | MUST | The system shall display public story details, chapter information and permitted metadata to a Guest. |
| FR-GUEST-05 | MUST | The system shall allow a Guest to read or listen to permitted limited story content/audio. |
| FR-GUEST-06 | MUST | The system shall distinguish limited public access from authenticated Reader access and paid early access. |
| FR-GUEST-07 | MUST | The system shall direct a Guest to authentication when an operation requires account identity, personal state or coin spending. |

### 6.3 Reader experience

| ID | Priority | Requirement |
|---|---|---|
| FR-READ-01 | MUST | A Reader shall retain all permitted Guest discovery, search and public reading capabilities. |
| FR-READ-02 | MUST | The system shall allow a Reader to request story or chapter content according to publication and access rules. |
| FR-READ-03 | MUST | The system shall allow a Reader to read available chapter content. |
| FR-READ-04 | MUST | The system shall allow a Reader to request audio narration through the TTS Service. |
| FR-READ-05 | MUST | The system shall save reading/listening position for an authenticated Reader. |
| FR-READ-06 | MUST | The system shall restore a Reader's saved progress when the Reader resumes a story or chapter. |
| FR-READ-07 | MUST | The system shall allow a Reader to follow or unfollow a story. |
| FR-READ-08 | MUST | The system shall allow a Reader to rate a permitted story. |
| FR-READ-09 | MUST | The system shall allow a Reader to create and view comments subject to content rules. |
| FR-READ-10 | MUST | The system shall allow a Reader to report suspected violating content. |
| FR-READ-11 | MUST | The system shall provide permitted notifications to the Reader through the configured email/notification flow. |

### 6.4 Authoring and formatting

| ID | Priority | Requirement |
|---|---|---|
| FR-AUTHOR-01 | MUST | The system shall allow an eligible user to apply for Author access. |
| FR-AUTHOR-02 | MUST | The system shall allow an Author to create and edit a story. |
| FR-AUTHOR-03 | MUST | The system shall allow an Author to create, edit, reorder and manage chapters. |
| FR-AUTHOR-04 | MUST | The system shall provide a story/chapter formatting template with required structure and formatting rules. |
| FR-AUTHOR-05 | MUST | The system shall validate or provide feedback on formatted story/chapter content before submission. |
| FR-AUTHOR-06 | MUST | The system shall allow an Author to save incomplete work as a draft. |
| FR-AUTHOR-07 | MUST | The system shall support rich chapter content containing text and permitted image/audio media. |
| FR-AUTHOR-08 | COULD | The system may support video media when implementation scope permits. |
| FR-AUTHOR-09 | MUST | The system shall allow an Author to upload media and supported PDF files. |
| FR-AUTHOR-10 | MUST | For a supported text-layer PDF, the system shall extract text and create an editable draft for Author review. |
| FR-AUTHOR-11 | MUST | The system shall require the Author to review and correct imported content before submission. |
| FR-AUTHOR-12 | COULD | OCR may be added for scanned/image-only PDFs as stretch scope. |
| FR-AUTHOR-13 | MUST | The system shall collect a rights or license declaration for submitted text and media. |
| FR-AUTHOR-14 | MUST | The rights declaration shall distinguish at least self-owned/original, licensed, public-domain and other authorized sources. |
| FR-AUTHOR-15 | MUST | The system shall allow an Author to submit a story/chapter for review. |
| FR-AUTHOR-16 | MUST | The system shall show the Author submission status and Moderator feedback. |
| FR-AUTHOR-17 | SHOULD | The system should provide story statistics to the Author for published content. |

### 6.5 Author AI assistance

| ID | Priority | Requirement |
|---|---|---|
| FR-AI-AUTHOR-01 | MUST | The system shall allow an Author to request writing assistance from the OpenAI LLM Service. |
| FR-AI-AUTHOR-02 | MUST | The system shall support suggestions such as wording/style improvement, chapter summary, story summary, title, tags and metadata. |
| FR-AI-AUTHOR-03 | MUST | The system shall present AI output as suggestions that the Author can accept, reject or edit. |
| FR-AI-AUTHOR-04 | MUST | AI shall not automatically publish or silently replace Author content. |
| FR-AI-AUTHOR-05 | MUST | The system shall preserve the Author's control over final submitted content. |

### 6.6 Automatic review and moderation

| ID | Priority | Requirement |
|---|---|---|
| FR-MOD-01 | MUST | When an Author submits content, the system shall automatically start the configured AI-assisted review flow. |
| FR-MOD-02 | MUST | The system shall send relevant submitted content and review criteria to the OpenAI LLM Service. |
| FR-MOD-03 | MUST | The system shall generate or request embeddings through the OpenAI Embedding Service when semantic similarity analysis is enabled. |
| FR-MOD-04 | MUST | The system shall compare content using the configured similarity process and produce findings or risk signals. |
| FR-MOD-05 | MUST | The system shall attach AI review results, similarity findings and risk flags to the pending submission. |
| FR-MOD-06 | MUST | The Moderator shall be able to view AI review results without manually requesting the review. |
| FR-MOD-07 | MUST | The Moderator shall be able to approve or reject after reviewing the available evidence; rejection shall include actionable feedback, and a rejected Author may revise and resubmit as a new revision and review cycle. |
| FR-MOD-08 | MUST | AI shall not make the final publication decision. |
| FR-MOD-09 | MUST | The system shall allow a Moderator to review reports and apply permitted content actions. |
| FR-MOD-10 | MUST | The system shall retain moderation history for submitted decisions and content actions. |
| FR-MOD-11 | MUST | Similarity results shall be warnings/signals for investigation, not legal conclusions of plagiarism or copyright infringement. |

### 6.7 Multimedia and external storage

| ID | Priority | Requirement |
|---|---|---|
| FR-MEDIA-01 | MUST | The system shall store media/PDF objects through VPSTTT Object Storage rather than storing large binary files directly in the application database. |
| FR-MEDIA-02 | MUST | The system shall retain metadata linking each stored object to its story/chapter and uploader. |
| FR-MEDIA-03 | MUST | The system shall support retrieval of permitted media content for Author, Moderator and Reader operations. |
| FR-MEDIA-04 | MUST | The system shall send chapter text and voice settings to the TTS Service when narration is requested. |
| FR-MEDIA-05 | MUST | The system shall store or reference the generated narration returned by the TTS Service. |

### 6.8 Coin, early access and unlocks

| ID | Priority | Requirement |
|---|---|---|
| FR-COIN-01 | MUST | The system shall maintain an authenticated Reader coin balance. |
| FR-COIN-02 | MUST | The system shall allow a Reader to initiate a coin top-up through the Payment Gateway. |
| FR-COIN-03 | MUST | The system shall update the Reader balance only after a valid payment result is confirmed. |
| FR-COIN-04 | MUST | The system shall record top-up status and transaction history. |
| FR-COIN-05 | MUST | The system shall allow an Author to configure an early-access duration in days for eligible chapters. |
| FR-COIN-06 | MUST | The system shall allow an Author to configure a coin price for early access. |
| FR-COIN-07 | MUST | During the configured early-access window, the system shall require an eligible Reader to spend the configured coin amount to unlock the chapter. |
| FR-COIN-08 | MUST | After the early-access window expires, the chapter shall become available without the early-unlock payment, subject to normal publication and access rules. |
| FR-COIN-09 | MUST | The system shall record an unlock entitlement so a successful Reader unlock can be reused according to the product policy. |
| FR-COIN-10 | MUST | The system shall return a clear unlock result and the permitted chapter access after a successful unlock. |
| FR-COIN-11 | MUST | The system shall prevent an unlock when the Reader has insufficient balance or the chapter is not eligible for early access. |
| FR-COIN-12 | MUST | The example conversion shall support 300 VND = 300 coins, subject to the configured coin-rate policy. |
| FR-COIN-13 | MUST | For each paid early unlock, the system shall allocate 70% of the unlock revenue to Author earnings and 30% to the system wallet. |
| FR-COIN-14 | MUST | The system shall keep an auditable ledger for top-ups, unlocks, revenue allocation, adjustments and payouts. |

### 6.9 Author earnings and withdrawals

| ID | Priority | Requirement |
|---|---|---|
| FR-PAYOUT-01 | MUST | The system shall display an Author earnings balance that identifies the Author's 70% share of eligible paid unlock revenue. |
| FR-PAYOUT-02 | MUST | The system shall allow an Author to view eligible earnings and payout history. |
| FR-PAYOUT-03 | MUST | The system shall allow an Author to submit a withdrawal request for eligible earnings. |
| FR-PAYOUT-04 | MUST | A withdrawal request shall have a review status such as pending, approved, rejected or processed. |
| FR-PAYOUT-05 | MUST | The system shall present pending withdrawal requests to Admin. |
| FR-PAYOUT-06 | MUST | Admin shall be able to approve or reject a withdrawal request with an auditable decision. |
| FR-PAYOUT-07 | MUST | The system shall not send a payout request to the Payment Gateway before the required Admin approval. |
| FR-PAYOUT-08 | MUST | After approval, the system shall send the payout request to the Payment Gateway and record the result. |
| FR-PAYOUT-09 | MUST | The system shall return withdrawal status and payout records to the Author. |
| FR-PAYOUT-10 | MUST | Rejected or failed withdrawals shall not silently reduce the Author's eligible earnings. |
| FR-PAYOUT-11 | MUST | Admin shall be able to perform authorized wallet or transaction controls, with a reason and audit record. |

### 6.10 Admin and platform governance

| ID | Priority | Requirement |
|---|---|---|
| FR-ADMIN-01 | MUST | Admin shall be able to manage user accounts. |
| FR-ADMIN-02 | MUST | Admin shall be able to manage roles and permissions. |
| FR-ADMIN-03 | MUST | Admin shall be able to manage categories and platform content. |
| FR-ADMIN-04 | MUST | Admin shall be able to view administrative records, system statistics and audit logs. |
| FR-ADMIN-05 | MUST | Admin shall be able to manage the configured coin rate and revenue policy. |
| FR-ADMIN-06 | MUST | Admin shall be able to view finance and wallet reports covering top-ups, unlocks, earnings, withdrawals and the system wallet. |
| FR-ADMIN-07 | MUST | Admin shall be able to monitor the system's 30% share from eligible paid unlocks. |
| FR-ADMIN-08 | MUST | Financial controls shall be permission-restricted and auditable. |

### 6.11 Email and notifications

| ID | Priority | Requirement |
|---|---|---|
| FR-NOTIFY-01 | MUST | The system shall send permitted outgoing email messages through Gmail SMTP Service. |
| FR-NOTIFY-02 | MUST | The system shall handle SMTP acceptance and error responses. |
| FR-NOTIFY-03 | SHOULD | The system should notify relevant users about authentication, moderation, publication, withdrawal and payout status changes. |
| FR-NOTIFY-04 | MUST | Email delivery failure shall not erase the underlying NovelHub transaction or moderation record. |

## 7. Business rules

| ID | Rule |
|---|---|
| BR-01 | Guest is the public subset of Reader plus registration/authentication onboarding. |
| BR-02 | Only published and permitted content is available through Guest public discovery. |
| BR-03 | Reader-only personal state includes progress, follows, ratings, comments, reports and coin operations. |
| BR-04 | Author sets the early-access duration and coin price for eligible chapters. |
| BR-05 | The early-access window is measured from chapter publication under the system's publication timestamp. |
| BR-06 | A chapter becomes free after its configured early-access window expires, unless another publication restriction applies. |
| BR-07 | The example rate is 1 VND = 1 coin; the effective rate is controlled by Admin policy. |
| BR-08 | The 70/30 split applies to eligible paid early-unlock revenue: 70% Author earnings and 30% system wallet. |
| BR-09 | A top-up increases a Reader balance only after confirmed payment. Top-up money is not itself Author revenue. |
| BR-10 | Admin approval is required before an Author withdrawal is sent for payout processing. |
| BR-11 | OpenAI outputs are advisory. Author controls writing suggestions; Moderator controls publication decisions. |
| BR-12 | Similarity findings and rights declarations support review but do not establish a legal copyright verdict. |
| BR-13 | AI-assisted review starts automatically when content is submitted; Moderator does not need to trigger it manually. |
| BR-14 | NovelHub roles and permissions are authoritative after Google OAuth authentication. |

## 8. Data and record requirements

NovelHub shall retain enough information to support the following records:

### 8.1 Story and content

- Story identity, title, description, cover and category.
- Chapter identity, order, content, publication status and publication timestamp.
- Formatting/template validation state.
- Draft and submission state.
- Media object metadata and storage reference.
- Rights/license declaration and source type.

### 8.2 Reading and interaction

- Reader, story and chapter relationship.
- Reading/listening position and last-read time.
- Follow, rating, comment and report records.
- Guest/public access versus authenticated/paid access state.

### 8.3 Review and moderation

- Submission status and timestamps.
- AI review results and risk flags.
- Similarity findings and embedding-analysis reference.
- Moderator decisions, reasons and content actions.
- Moderation history.

### 8.4 Finance

- Reader coin balance.
- Top-up request, provider result and transaction reference.
- Early-unlock request and entitlement.
- Revenue allocation record identifying the 70% Author share and 30% system share.
- Author earnings balance and withdrawal request.
- Admin approval/rejection decision and reason.
- Payment/payout result and payout record.
- System wallet and finance report data.

Financial records shall be append-only or otherwise auditable; corrections shall create an adjustment record instead of silently overwriting historical transactions.

## 9. Integration requirements

### 9.1 Google OAuth

- NovelHub shall send an authentication request to the Authentication Provider.
- NovelHub shall validate the returned authentication result and identity claims.
- Google OAuth shall authenticate identity only; it shall not grant Author, Moderator or Admin privileges.

### 9.2 Payment Gateway

- NovelHub shall send top-up requests and receive payment results.
- NovelHub shall send payout requests only after the required Admin approval.
- Provider references, status and failure information shall be recorded with the related transaction.

### 9.3 OpenAI LLM Service

- NovelHub shall send Author prompts/content for writing, summary and metadata tasks.
- NovelHub shall send submitted content and review criteria for automatic moderation assistance.
- NovelHub shall store or associate returned suggestions/risk flags with the relevant context.
- NovelHub shall not treat an LLM response as a final publication decision.

### 9.4 OpenAI Embedding Service

- NovelHub shall send the configured text segments for embedding.
- NovelHub shall receive embedding vectors.
- NovelHub shall use the vectors as input to similarity analysis; the service response shall not be labeled as a legal plagiarism verdict.

### 9.5 VPSTTT Object Storage

- NovelHub shall send storage/retrieval requests for media and supported documents.
- NovelHub shall retain object references and metadata needed to authorize retrieval.

### 9.6 Gmail SMTP Service

- NovelHub shall send recipient and message content through Gmail SMTP.
- NovelHub shall process SMTP acceptance or error responses.

### 9.7 TTS Service

- NovelHub shall send chapter text and speech settings.
- NovelHub shall receive generated narration audio or an audio reference.
- NovelHub shall expose narration only under the applicable content-access rules.

## 10. Non-functional requirements

### 10.1 Security and access control

- NFR-SEC-01: Every protected operation shall enforce the user's NovelHub role and resource permissions.
- NFR-SEC-02: Financial operations shall require appropriate authorization and produce audit records.
- NFR-SEC-03: Authentication tokens, provider credentials and payment credentials shall not be stored in source code or exposed in application logs.
- NFR-SEC-04: Users shall not access another user's progress, wallet, earnings or withdrawal data without authorization.
- NFR-SEC-05: Uploaded media and documents shall be served only through authorized references.

### 10.2 Reliability and consistency

- NFR-REL-01: A confirmed top-up shall not be applied more than once for the same provider transaction.
- NFR-REL-02: A successful unlock shall not deduct coins more than once for the same entitlement.
- NFR-REL-03: Revenue allocation, balance deduction and unlock entitlement shall be recorded consistently.
- NFR-REL-04: External-service failure shall produce a visible status and preserve retry/audit information without silently losing the business record.
- NFR-REL-05: Moderation decisions shall remain available even if an external AI service is temporarily unavailable after the review result has been stored.

### 10.3 Usability and accessibility

- NFR-UX-01: The public discovery flow shall be usable without authentication.
- NFR-UX-02: A Guest shall receive a clear explanation when an operation requires authentication or coin payment.
- NFR-UX-03: The reading experience shall clearly distinguish free, limited-preview and early-access content.
- NFR-UX-04: TTS controls and generated audio state shall be understandable to users who rely on listening rather than visual reading.
- NFR-UX-05: Financial screens shall display amounts, coin units, transaction status and withdrawal status clearly.

### 10.4 Maintainability and scope control

- NFR-MAIN-01: External integrations shall be isolated behind explicit service boundaries.
- NFR-MAIN-02: Provider failures and business-rule decisions shall be observable through status and audit information.
- NFR-MAIN-03: Core publication, discovery, reading, moderation and finance rules shall not depend on an AI response being available.
- NFR-MAIN-04: The implementation shall prioritize the core release and keep OCR, advanced video, recommendations and legal plagiarism claims outside the core boundary.

## 11. Acceptance criteria

### 11.1 Guest and Reader

- A Guest can browse, search/filter, view a story/chapter and access permitted limited content without signing in.
- A Guest is prompted to authenticate for personal state, interaction or coin operations.
- A Reader can perform the Guest discovery flow using the same domain concepts.
- A Reader can save/resume progress and use interaction features after authentication.
- A Reader can top up coins, see confirmed balance/status and request an eligible early unlock.

### 11.2 Author

- An Author can create a formatted story/chapter draft using the required template.
- An Author can declare content rights/license information before submission.
- An Author can configure an X-day lock and coin price for an eligible chapter.
- An Author can see AI suggestions without losing control of the final content.
- An Author submission automatically receives AI review results when the configured service is available.
- An Author can see earnings, submit a withdrawal request and track its status.

### 11.3 Moderation

- A submitted story appears in the pending review workflow.
- AI review results and similarity findings are visible to the Moderator automatically.
- The Moderator can approve or reject without asking the AI to make the decision.
- A rights declaration, report and similarity result remain review evidence rather than legal conclusions.

### 11.4 Finance and Admin

- A confirmed top-up changes the Reader coin balance exactly once.
- A paid early unlock creates an access entitlement and records the configured coin deduction.
- The unlock revenue ledger records a 70% Author share and a 30% system share.
- An Author withdrawal remains pending until Admin approves or rejects it.
- Only an approved withdrawal can be sent to the Payment Gateway for payout processing.
- Admin can view the pending request, make a decision, manage authorized controls and inspect finance reports.

### 11.5 External services

- Google OAuth returns a validated identity result without assigning application roles.
- OpenAI LLM results are stored/presented as suggestions or review assistance.
- OpenAI Embedding returns vectors used by the similarity process.
- VPSTTT Object Storage stores/retrieves permitted objects.
- Gmail SMTP returns an acceptance/error status for outgoing mail.
- TTS Service returns generated narration or a defined failure status.
- Payment Gateway returns a payment/payout status linked to the corresponding transaction.

## 12. Open decisions to confirm before implementation freeze

These do not change the current business boundary but must be finalized in detailed design:

1. The exact Payment Gateway provider and supported payment methods.
2. The exact payout destination and verification requirements for Author withdrawals.
3. Whether gateway fees, taxes or transfer costs are deducted before or after the 70/30 allocation.
4. Rounding rules when a coin price cannot be divided exactly into the 70/30 split.
5. Whether one successful unlock applies to one chapter, one story version or another defined entitlement scope.
6. The maximum/minimum early-access duration and coin price allowed by Admin policy.
7. The exact formatting template fields and validation rules.
8. The exact similarity threshold used to generate a review warning.
9. Retention periods for audit, payment and moderation records.
10. The final TTS provider and supported languages/voices.

Until these decisions are finalized, the requirements above define the observable product boundary without claiming provider-specific implementation details.
