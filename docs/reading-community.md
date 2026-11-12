# Reading and community

Part 4 of NovelHub: public discovery, chapter reading with saved progress,
follows, ratings, comments, content reports and the Moderator report queue.
Business rules come from `docs/decision-log.md` (decisions 8, 14, 16, 17, 20,
21, 26, 31). TTS is not implemented yet: its provider is still undecided
(decision 29).

## Access rules

| Viewer           | Can read                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest            | Chapter 1 only. While chapter 1 is in early access, only its title and a login/unlock prompt are shown, and no view is counted.                          |
| Signed-in Reader | Every published chapter. Early-access chapters need an active entitlement for the live revision. Unpublished content stays blocked even with an entitlement. |

The shared checks live in `backend/src/modules/reading/access.js`
(`readableChapter`, `publishedChapter`, `publishedStory`). Catalog reads, progress
saves and chapter comments all go through them.

## Endpoints

### Catalog (public; viewer fields appear when signed in)

| Method and path                                     | Purpose                                                                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/catalog/stories`                          | `q` (title, Author name or tag; a leading `#` is ignored), `category`, `tag`, `status=ongoing\|completed`, `sort=newest\|popular\|rating`, `page`, `pageSize`. Popularity is unique daily views over the last 30 days. Cards carry `categoryId`, `genre` (the main category name) and `tags`. |
| `GET /api/catalog/categories`                       | Active categories with published story counts                                                                                                                                           |
| `GET /api/catalog/stories/:storyId`                 | Story, chapter list with early-access price/end, and `viewer` (`following`, `rating`, `resume`)                                                                                         |
| `GET /api/catalog/stories/:storyId/chapters/:chapterId` | Chapter text, previous/next chapter and comment count. Records one view per Reader per chapter per day. Guests get a `novelhub_device` cookie so their chapter-1 views are counted the same way. |

### Reader (signed in)

| Method and path                                     | Purpose                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/reader/progress`                          | Save position (0–1) and completion for a readable chapter                                                                                |
| `GET /api/reader/progress/:storyId`                 | Resume target. After a chapter edit it returns `position: 0` and `contentUpdated: true`, so the Reader starts the same chapter again from the top. |
| `GET /api/reader/library?tab=all\|reading\|following\|completed` | Followed or started stories, with progress, new-chapter counts and per-tab counts                                                       |
| `GET /api/reader/history`, `DELETE /api/reader/history[/:id]` | Reading history; remove one entry or all                                                                                                 |

When a chapter is released for the first time, every active follower except
the Author gets one in-app notification (`story.chapter-released`). These
notices are in-app only.

### Community (lists are public; writes need sign-in)

| Method and path                                                  | Rule                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/community/stories/:storyId/follow`                     | One follow per Reader per story                                                                                       |
| `PUT` / `DELETE /api/community/stories/:storyId/rating`          | One 1–5 rating per Reader per story; the response includes the average                                                |
| `GET` / `POST /api/community/{stories\|chapters}/:id/comments`    | Replies go one level deep. A chapter comment is refused (`comment_locked`) while that chapter is locked for the Reader. |
| `PUT` / `DELETE /api/community/comments/:id`                     | Edit marks the comment "edited". Delete is a soft delete, so the comment stays for reports and audit.                 |
| `PUT /api/community/comments/:id/like`                           | Idempotent like/unlike                                                                                                |
| `POST /api/community/reports`                                    | Report a story, chapter or comment. A copy of the target, its revision and a hash are stored. A second open report on the same target from the same Reader is refused. |

Deleted (anonymized) accounts appear as "Deleted user". Hidden comments never
appear in lists.

### Moderator reports

| Method and path                                          | Purpose                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/moderator/reports?view=queue\|mine&targetType=` | `queue`: open reports without another moderator's live claim; `mine`: my live claims. Oldest first, 20 per page |
| `GET /api/moderator/reports/:reportId`                    | Summary for any Moderator; the claim holder also gets the snapshot, the current target, earlier reports on the target and the allowed actions |
| `POST /api/moderator/reports/:reportId/claim` / `release` | Exclusive claim for the policy's claim hours; `release` needs the `claimToken` returned by the claim |
| `POST /api/moderator/reports/:reportId/resolution`        | `{ action, reason (5–2000), expectedVersion, claimToken }`; the result records whether the content changed |

Allowed actions depend on what was reported:

| Report target | Allowed actions                                               |
| ------------- | ------------------------------------------------------------- |
| Comment       | `dismiss`, `hide-comment`                                     |
| Chapter       | `dismiss`, `unpublish-chapter`, `unpublish-story`, `warn-author` |
| Story         | `dismiss`, `unpublish-story`, `warn-author`                   |

A resolution runs in one transaction. It writes `ReportResolution` (with
`contentChanged`: false for Dismiss, Warn Author and a target that was already
restricted), `ModerationHistory` and `AuditEvent` records, applies the content
change, and sends in-app notices to the reporter and, for Warn Author or a
content change, to the Author or comment owner. There is no escalation, and no
report action suspends an account.

## Tests

Backend: `backend/test/reading-*.test.js`, `backend/test/community-*.test.js`,
`backend/test/moderator-reports.test.js`.

Frontend: `frontend/test/components/community/`,
`frontend/test/pages/guest/StoryDetailPage.test.jsx`,
`frontend/test/pages/reader/FullChapterReaderPage.test.jsx`,
`frontend/test/pages/moderator/ReportsQueuePage.test.jsx`,
`frontend/test/pages/moderator/ReportReviewDetailPage.test.jsx`.
