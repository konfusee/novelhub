# NovelHub Use Case List

## 1. Purpose

This document defines the user-goal use cases for the human actors in NovelHub. It translates the actor responsibilities and functional requirements in [`novelhub_requirements_spec.md`](./novelhub_requirements_spec.md) into a stable catalogue for use-case diagrams, detailed use-case specifications, implementation planning and acceptance testing.

External providers are supporting actors. They participate in NovelHub use cases but do not own NovelHub business goals.

## 2. Actor model and boundaries

| Actor | Boundary |
|---|---|
| Guest | Unauthenticated visitor. Can discover published content, access permitted previews and enter the account flow. |
| Reader | Authenticated user. Retains public discovery capabilities and adds personal reading state, interactions and coin operations. |
| Author | Authorized content creator. Retains permitted authenticated-user capabilities and adds authoring, publishing and earnings operations. |
| Moderator | Privileged content reviewer. Makes routine publication and report-resolution decisions; AI remains advisory. |
| Admin | Privileged platform operator. Manages platform governance and finance; does not replace the Moderator in routine content decisions. |

Actor relationships:

- Guest capabilities are the public subset of Reader capabilities plus registration and authentication onboarding.
- Reader can perform the public discovery use cases `UC-GST-01` through `UC-GST-04` without duplicating those use cases in the catalogue.
- Author is an additional authorized role on an authenticated account. Author-specific use cases do not remove permitted Reader capabilities.
- Moderator and Admin operations require explicit NovelHub roles. Google OAuth authenticates identity but does not assign these roles.

## 3. Guest use cases

| ID | Use case | Goal and successful outcome | Requirement references |
|---|---|---|---|
| UC-GST-01 | Browse published catalogue | Browse stories that are published and available for public discovery. | FR-GUEST-01, BR-02 |
| UC-GST-02 | Search and filter stories | Submit search/filter criteria and receive matching published stories. | FR-GUEST-02, FR-GUEST-03 |
| UC-GST-03 | View story and chapter details | View public story metadata, chapter information and access state. | FR-GUEST-04 |
| UC-GST-04 | Access limited story preview | Read or listen to the portion of story content permitted for public access. NovelHub clearly distinguishes preview, authenticated and paid access. | FR-GUEST-05, FR-GUEST-06 |
| UC-GST-05 | Register account | Submit registration data and receive the registration result. | FR-AUTH-01 |
| UC-GST-06 | Authenticate | Sign in through a supported authentication flow, including Google OAuth, and enter the authorized account context. | FR-AUTH-02 through FR-AUTH-05 |

Guest restrictions:

- A Guest cannot save reading progress, follow, rate, comment, report content, manage coins or unlock paid chapters.
- When a Guest attempts a protected operation, NovelHub directs the Guest to authentication instead of creating anonymous personal state.

## 4. Reader use cases

A Reader can also perform `UC-GST-01` through `UC-GST-04`.

| ID | Use case | Goal and successful outcome | Requirement references |
|---|---|---|---|
| UC-RDR-01 | Manage profile | View and update profile fields permitted for the authenticated account. | FR-AUTH-06 |
| UC-RDR-02 | Read or listen to accessible chapter | Access available chapter text or request narration under the applicable publication and entitlement rules. | FR-READ-02 through FR-READ-04, FR-MEDIA-04, FR-MEDIA-05 |
| UC-RDR-03 | Save and resume reading progress | Persist the current reading/listening position and restore it on a later session. | FR-READ-05, FR-READ-06 |
| UC-RDR-04 | Follow or unfollow story | Add or remove a story from the Reader's followed stories. | FR-READ-07 |
| UC-RDR-05 | Rate story | Submit or update an allowed rating for a story. | FR-READ-08 |
| UC-RDR-06 | Participate in comments | View comments and create a permitted comment on a story or chapter. | FR-READ-09 |
| UC-RDR-07 | Report content | Submit a report for suspected violating content and create a reviewable moderation record. | FR-READ-10 |
| UC-RDR-08 | View notifications | Receive and view permitted account, publication, interaction or transaction notifications. | FR-READ-11, FR-NOTIFY-03 |
| UC-RDR-09 | Manage coin balance | View coin balance and transaction status, initiate a top-up and receive the confirmed top-up result. | FR-COIN-01 through FR-COIN-04, FR-COIN-12 |
| UC-RDR-10 | Unlock early-access chapter | Spend the configured coin amount for an eligible chapter, receive an entitlement and access the chapter without duplicate deduction. | FR-COIN-07 through FR-COIN-11, FR-COIN-13, FR-COIN-14 |

## 5. Author use cases

This section follows the latest SRS Author diagram and specifications. The earlier grouped catalogue is superseded by these atomic use cases. Author retains permitted Reader operations.

| ID | Use case | Goal and successful outcome | SRS reference |
|---|---|---|---|
| UC-AUT-02 | View owned story list | Open, search, filter and sort the Author’s stories and inspect status, main category, chapters and review state. | SRS 2.3.1 |
| UC-AUT-02.1 | Create story | Create a draft story with title, description, exactly one active main category, 0–10 optional tags and optional cover/banner. | SRS 2.3.2 |
| UC-AUT-02.2 | Update story | Update editable story metadata, including tags, and cover/banner media. | SRS 2.3.3 |
| UC-AUT-02.3 | Delete story | Delete a never-published story with no open submission. | SRS 2.3.4 |
| UC-AUT-12 | View story statistics | View reading, reader, completion, follower, rating, unlock, earnings and comment metrics. | SRS 2.3.5 |
| UC-AUT-03 | View chapter list | Filter chapters by lifecycle state and inspect release state. | SRS 2.3.6 |
| UC-AUT-03.1 | Create chapter | Create a private draft with text and images. | SRS 2.3.7 |
| UC-AUT-03.2 | Update chapter | Edit an editable draft and its images with version checks. | SRS 2.3.8 |
| UC-AUT-03.3 | Delete chapter | Delete a never-published chapter with no open submission. | SRS 2.3.9 |
| UC-AUT-03.4 | Reorder chapters | Save a new order while all chapters remain drafts and unchanged. | SRS 2.3.10 |
| UC-AUT-08 | Configure early access | Set price and duration for an unreleased chapter within Admin policy limits. | SRS 2.3.11 |
| UC-AUT-05 | Import chapters from PDF | Extract a text-layer PDF, split or merge chapters and save editable drafts. | SRS 2.3.12 |
| UC-AUT-09 | Submit content for review | Validate content, the main category, media and rights, then freeze and submit the package. | SRS 2.3.13 |
| UC-AUT-10 | Track review and publication | Follow submission status, publication state and Moderator feedback. | SRS 2.3.14 |
| UC-AUT-10.1 | Release approved content | Publish an approved story/chapter now or schedule a chapter release. | SRS 2.3.15 |
| UC-AUT-11 | Revise and resubmit content | Create a new editable revision for rejected or approved-but-unreleased content and submit it again. | SRS 2.3.16 |
| UC-AUT-13 | View earnings | View the earnings balance, unlock revenue, earnings ledger and payout status. | SRS 2.3.17 |
| UC-AUT-17 | Update payment details | Add or change the bank account used for future payouts. | SRS 2.3.18 |
| UC-AUT-18 | View payout history | View completed and pending payouts with their stored results. | SRS 2.3.19 |
| UC-AUT-14 | View transaction history | View the append-only transactions that make up Author earnings. | SRS 2.3.20 |

## 6. Moderator use cases

| ID | Use case | Goal and successful outcome | Requirement references |
|---|---|---|---|
| UC-MOD-01 | Manage moderation queue | View, filter and open pending publication submissions and unresolved content reports without changing their outcome. | FR-MOD-05, FR-MOD-06, FR-MOD-09 |
| UC-MOD-02 | Review publication submission | Review the exact submitted revision, rights declaration, media, automatic AI results, similarity findings and risk flags before making a decision. | FR-MOD-02 through FR-MOD-06, FR-MOD-11 |
| UC-MOD-03 | Decide publication submission | Approve or reject with a reasoned, auditable decision for the reviewed revision; rejection requires actionable feedback. AI evidence informs but does not make the final decision. | FR-MOD-07, FR-MOD-08, FR-MOD-10 |
| UC-MOD-04 | Review reported content | Inspect a Reader report, the reported content, available context and related moderation evidence before resolving the report. | FR-MOD-09 |
| UC-MOD-05 | Resolve content report | Dismiss the report or apply a permitted content action with a recorded reason and outcome. | FR-MOD-09, FR-MOD-10 |
| UC-MOD-06 | View moderation history | Review prior submission decisions, report resolutions and content actions without modifying the audit trail. | FR-MOD-10 |

## 7. Admin use cases

| ID | Use case | Goal and successful outcome | Requirement references |
|---|---|---|---|
| UC-ADM-01 | Manage user accounts | View and perform authorized administrative actions on user accounts. | FR-ADMIN-01 |
| UC-ADM-02 | Manage roles and permissions | Assign or revoke NovelHub roles and permissions independently of authentication-provider identity. | FR-ADMIN-02, FR-AUTH-04, FR-AUTH-05 |
| UC-ADM-03 | Manage categories and platform content | Maintain categories and perform authorized platform-level content administration. | FR-ADMIN-03 |
| UC-ADM-04 | View system records and audit information | Inspect administrative records, platform statistics and audit logs. | FR-ADMIN-04 |
| UC-ADM-05 | Configure coin and revenue policy | Manage the supported coin conversion rate and revenue-allocation policy. | FR-ADMIN-05, BR-07 through BR-09 |
| UC-ADM-06 | Process Author withdrawal | View a pending withdrawal request and approve or reject it with an auditable reason. Only approval allows payout processing. | FR-PAYOUT-05 through FR-PAYOUT-08 |
| UC-ADM-07 | Apply wallet or transaction control | Perform an authorized financial adjustment/control with a reason and audit record. | FR-PAYOUT-11, FR-ADMIN-08 |
| UC-ADM-08 | View finance and wallet reports | Inspect top-ups, unlocks, Author earnings, withdrawals, payout results and wallet activity. | FR-ADMIN-06 |
| UC-ADM-09 | Monitor system revenue | Monitor the system wallet and the system's 30% share of eligible paid-unlock revenue. | FR-ADMIN-07, BR-08 |

## 8. Supporting external actors

| External actor | Participating use cases | Responsibility boundary |
|---|---|---|
| Authentication Provider (Google OAuth) | UC-GST-06 | Returns a verified identity result. NovelHub remains responsible for account linking, roles and authorization. |
| Payment Gateway | UC-RDR-09, UC-AUT-13, UC-ADM-06 | Processes top-up payments and approved payouts; returns provider status and references. |
| TTS Service | UC-GST-04, UC-RDR-02 | Generates narration from permitted chapter text and speech settings. |
| OpenAI LLM Service | UC-AUT-09, UC-MOD-02 | Returns advisory review assistance. It does not control Author content or publication decisions. |
| OpenAI Embedding Service | UC-AUT-10, UC-MOD-02 | Returns vectors used by NovelHub's similarity analysis. |
| VPSTTT Object Storage | UC-GST-04, UC-RDR-02, UC-AUT-05, UC-AUT-06, UC-MOD-02 | Stores and retrieves permitted media and documents using NovelHub-controlled references and authorization. |
| Gmail SMTP Service | UC-RDR-08, UC-AUT-11, UC-AUT-13, UC-ADM-06 | Delivers permitted outgoing email and returns SMTP acceptance/error status. |

## 9. Core use-case relationships

| Base use case | Relationship | Related behavior |
|---|---|---|
| UC-GST-04 Access limited story preview | Includes when audio is selected | Request narration from TTS Service under public-access rules. |
| UC-RDR-02 Read or listen to accessible chapter | Includes when audio is selected | Request narration from TTS Service under Reader access rules. |
| UC-RDR-09 Manage coin balance | Includes for top-up | Process top-up through Payment Gateway and apply a confirmed result exactly once. |
| UC-RDR-10 Unlock early-access chapter | Includes | Verify chapter eligibility, entitlement and sufficient balance; deduct coins and allocate revenue atomically. |
| UC-AUT-05 Import PDF as editable draft | Includes | Store the uploaded object and extract text from a supported text-layer PDF. |
| UC-AUT-10 Submit content for review | Includes | Validate submission data and automatically start AI-assisted review/similarity processing. |
| UC-MOD-03 Decide publication submission | Requires | A pending submission and the available review evidence; AI availability does not transfer the final decision. |
| UC-ADM-06 Process Author withdrawal | Includes on approval | Send the approved payout request to Payment Gateway and record the result. |

## 10. Modelling constraints

- Do not model external services as decision-makers for NovelHub business rules.
- Do not model AI review as a manual Moderator-triggered use case; it starts from Author submission (UC-AUT-09).
- Do not model the system wallet as an external actor. It is internal NovelHub financial state.
- Do not merge top-up revenue with Author earnings. Author/System allocation occurs on eligible paid chapter unlocks.
- Do not give Guest any persistent personal state or coin operation.
- Do not give Admin routine publication-review ownership; that responsibility belongs to Moderator.
