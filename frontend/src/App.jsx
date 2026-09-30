import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LocaleProvider } from './context/LocaleContext'
import { MockDataProvider } from './context/MockDataContext'
import { RoleRoute } from './app/RouteGuards'
import { DevPanel } from './components/dev/DevPanel'
import { UIPreviewPage } from './pages/system/UIPreviewPage'
import { GuestHomePage } from './pages/guest/GuestHomePage'
import { CategoriesPage } from './pages/guest/CategoriesPage'
import { SearchResultsPage } from './pages/guest/SearchResultsPage'
import { RankingsPage } from './pages/guest/RankingsPage'
import { StoryDetailPage } from './pages/guest/StoryDetailPage'
import { GuestReaderPreviewPage } from './pages/guest/GuestReaderPreviewPage'
import { JoinPage } from './pages/auth/JoinPage'
import { ReaderHomePage } from './pages/reader/ReaderHomePage'
import { PersonalLibraryPage } from './pages/reader/PersonalLibraryPage'
import { FollowingPage } from './pages/reader/FollowingPage'
import { FullChapterReaderPage } from './pages/reader/FullChapterReaderPage'
import { FullAudioPlayerPage } from './pages/reader/FullAudioPlayerPage'
import { ReadingHistoryPage } from './pages/reader/ReadingHistoryPage'
import { NotificationsPage } from './pages/reader/NotificationsPage'
import { ReaderProfilePage } from './pages/reader/ReaderProfilePage'
import { WalletPage } from './pages/reader/WalletPage'
import { AuthorDashboardPage } from './pages/author/AuthorDashboardPage'
import { CreateStoryPage } from './pages/author/CreateStoryPage'
import { StoryManagerPage } from './pages/author/StoryManagerPage'
import { ChapterEditorPage } from './pages/author/ChapterEditorPage'
import { DraftsPage } from './pages/author/DraftsPage'
import { ImportPdfPage } from './pages/author/ImportPdfPage'
import { MediaLibraryPage } from './pages/author/MediaLibraryPage'
import { AiWritingAssistantPage } from './pages/author/AiWritingAssistantPage'
import { SubmissionReviewPage } from './pages/author/SubmissionReviewPage'
import { AuthorAnalyticsPage } from './pages/author/AuthorAnalyticsPage'
import { ModeratorOverviewPage } from './pages/moderator/ModeratorOverviewPage'
import { SubmissionQueuePage } from './pages/moderator/SubmissionQueuePage'
import { ContentReviewDetailPage } from './pages/moderator/ContentReviewDetailPage'
import { ReportsQueuePage } from './pages/moderator/ReportsQueuePage'
import { SimilarityRiskReviewPage } from './pages/moderator/SimilarityRiskReviewPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { UsersManagementPage } from './pages/admin/UsersManagementPage'
import { RolesPermissionsPage } from './pages/admin/RolesPermissionsPage'
import { CategoriesConfigurationPage } from './pages/admin/CategoriesConfigurationPage'
import { PlatformSettingsPage } from './pages/admin/PlatformSettingsPage'
import { AuthorApplyPage } from './pages/author/AuthorApplyPage'
import { AuthorAgreementPage } from './pages/admin/AuthorAgreementPage'
import { ForbiddenPage, NotFoundPage } from './pages/system/SystemPages'
import { LegalPage } from './pages/system/LegalPage'
import { RoleUtilityPage } from './pages/system/RoleUtilityPage'
import { AccountPage } from './pages/system/AccountPage'
import { SiteFooter } from './components/shared/SiteFooter'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from './layouts'

const pages = [
  GuestHomePage,
  CategoriesPage,
  SearchResultsPage,
  RankingsPage,
  StoryDetailPage,
  GuestReaderPreviewPage,
  JoinPage,
  ReaderHomePage,
  PersonalLibraryPage,
  FollowingPage,
  FullChapterReaderPage,
  FullAudioPlayerPage,
  ReadingHistoryPage,
  NotificationsPage,
  ReaderProfilePage,
  WalletPage,
  AuthorDashboardPage,
  CreateStoryPage,
  StoryManagerPage,
  ChapterEditorPage,
  DraftsPage,
  ImportPdfPage,
  MediaLibraryPage,
  AiWritingAssistantPage,
  SubmissionReviewPage,
  AuthorAnalyticsPage,
  ModeratorOverviewPage,
  SubmissionQueuePage,
  ContentReviewDetailPage,
  ReportsQueuePage,
  SimilarityRiskReviewPage,
  AdminDashboardPage,
  UsersManagementPage,
  RolesPermissionsPage,
  CategoriesConfigurationPage,
  PlatformSettingsPage,
]
const role = (name, element, onboard = false) => (
  <RoleRoute role={name} authorOnboarding={onboard}>
    {element}
  </RoleRoute>
)
function ScrollManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!pathname.startsWith('/read/')) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}
function AppRoutes() {
  const { pathname } = useLocation()
  const { isAuthenticated } = useAuth()
  const publicFooterRoutes = ['/', '/discover', '/browse', '/categories', '/search', '/rankings', '/terms', '/privacy']
  const showPublicFooter =
    !isAuthenticated &&
    (publicFooterRoutes.includes(pathname) ||
      pathname.startsWith('/stories/') ||
      pathname.startsWith('/story/'))
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<AdaptivePublicPage page="home" />} />
        <Route path="/discover" element={<AdaptivePublicPage page="home" />} />
        <Route path="/browse" element={<AdaptivePublicPage page="categories" />} />
        <Route path="/categories" element={<AdaptivePublicPage page="categories" />} />
        <Route path="/search" element={<AdaptivePublicPage page="search" />} />
        <Route path="/rankings" element={<AdaptivePublicPage page="rankings" />} />
        <Route path="/stories/:storyId" element={<AdaptiveStoryPage />} />
        <Route path="/story/:storyId" element={<AdaptiveStoryPage />} />
        <Route path="/stories/:storyId/preview/:chapterId" element={<GuestReaderPreviewPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/login" element={<JoinPage initialMode="login" />} />
        <Route path="/register" element={<JoinPage initialMode="register" />} />
        <Route path="/terms" element={<AdaptiveLegalPage type="terms" />} />
        <Route path="/privacy" element={<AdaptiveLegalPage type="privacy" />} />
        <Route path="/reader" element={role('reader', <ReaderHomePage />)} />
        <Route path="/reader/explore" element={role('reader', <ReaderExplorePage />)} />
        <Route path="/library" element={role('reader', <PersonalLibraryPage />)} />
        <Route path="/reader/library" element={role('reader', <PersonalLibraryPage />)} />
        <Route path="/reader/following" element={role('reader', <FollowingPage />)} />
        <Route path="/reader/history" element={role('reader', <ReadingHistoryPage />)} />
        <Route path="/reader/notifications" element={role('reader', <NotificationsPage />)} />
        <Route path="/reader/profile" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/profile/reading" element={<Navigate to="/reader/settings/reading" replace />} />
        <Route path="/reader/profile/listening" element={<Navigate to="/reader/settings/listening" replace />} />
        <Route path="/reader/profile/appearance" element={<Navigate to="/reader/settings/appearance" replace />} />
        <Route path="/reader/profile/privacy" element={<Navigate to="/reader/settings/privacy" replace />} />
        <Route path="/reader/wallet" element={role('reader', <WalletPage />)} />
        <Route path="/reader/audiobooks" element={role('reader', <RoleUtilityPage role="reader" eyebrow="Listening" title="My Audiobooks" description="Continue listening, manage downloaded audio, and browse your saved narration queue." />)} />
        <Route path="/reader/messages" element={role('reader', <RoleUtilityPage role="reader" eyebrow="Community" title="Messages" description="Keep up with author announcements, reading clubs, and conversations around your favorite stories." />)} />
        <Route path="/reader/settings" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/settings/reading" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/settings/listening" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/settings/appearance" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/settings/privacy" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/settings/security" element={role('reader', <ReaderProfilePage />)} />
        <Route path="/reader/account" element={role('reader', <AccountPage workspace="reader" />)} />
        <Route path="/reader/support" element={role('reader', <RoleUtilityPage role="reader" eyebrow="NovelHub help" title="Help & Support" description="Find product guidance, accessibility help, frequently asked questions, and support channels." />)} />
        <Route
          path="/read/:storyId/:chapterId"
          element={role('reader', <FullChapterReaderPage />)}
        />
        <Route
          path="/listen/:storyId/:chapterId"
          element={role('reader', <FullAudioPlayerPage />)}
        />
        <Route path="/author/apply" element={role('reader', <AuthorApplyPage />)} />
        <Route path="/author" element={role('author', <AuthorDashboardPage />, true)} />
        <Route path="/author/stories/new" element={role('author', <CreateStoryPage />, true)} />
        <Route
          path="/author/stories/:storyId"
          element={role('author', <StoryManagerPage />, true)}
        />
        <Route
          path="/author/stories/:storyId/chapters/:chapterId/edit"
          element={role('author', <ChapterEditorPage />, true)}
        />
        <Route path="/author/drafts" element={role('author', <DraftsPage />, true)} />
        <Route path="/author/import" element={role('author', <ImportPdfPage />, true)} />
        <Route path="/author/media" element={role('author', <MediaLibraryPage />, true)} />
        <Route path="/author/ai" element={role('author', <AiWritingAssistantPage />, true)} />
        <Route
          path="/author/submissions"
          element={role('author', <SubmissionReviewPage />, true)}
        />
        <Route path="/author/analytics" element={role('author', <AuthorAnalyticsPage />, true)} />
        <Route path="/author/earnings" element={role('author', <RoleUtilityPage role="author" eyebrow="Creator finance" title="Earnings & Payouts" description="Track story revenue, royalty statements, payout readiness, and completed creator payments separately from Reader Wallet." />, true)} />
        <Route path="/author/profile" element={role('author', <RoleUtilityPage role="author" eyebrow="Author account" title="Author Profile" description="Manage your public pen name, biography, verification details, and author storefront." />, true)} />
        <Route path="/author/wallet" element={role('author', <RoleUtilityPage role="author" eyebrow="Reader purchases" title="Wallet & Coins" description="Authors can top up coins and purchase stories from other creators; their own published stories remain available without charge." />, true)} />
        <Route path="/author/settings" element={role('author', <ReaderProfilePage workspace="author" />, true)} />
        <Route path="/author/settings/:section" element={role('author', <ReaderProfilePage workspace="author" />, true)} />
        <Route path="/author/account" element={role('author', <AccountPage workspace="author" />, true)} />
        <Route path="/author/support" element={role('author', <RoleUtilityPage role="author" eyebrow="NovelHub help" title="Help & Support" description="Find creator guidance, publishing help, frequently asked questions, and support channels." />, true)} />
        <Route path="/moderator" element={role('moderator', <ModeratorOverviewPage />)} />
        <Route path="/moderator/submissions" element={role('moderator', <SubmissionQueuePage />)} />
        <Route
          path="/moderator/submissions/:submissionId"
          element={role('moderator', <ContentReviewDetailPage />)}
        />
        <Route path="/moderator/reports" element={role('moderator', <ReportsQueuePage />)} />
        <Route path="/moderator/reviews" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="Content safety" title="Content Reviews" description="Review assigned manuscripts, policy signals, age ratings, and publication readiness." />)} />
        <Route path="/moderator/similarity-flags" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="Originality" title="Similarity Flags" description="Inspect automated similarity matches and route high-risk cases for detailed review." />)} />
        <Route path="/moderator/decisions" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="Moderation history" title="Decisions" description="Review completed moderation decisions, reasoning, policy references, and appeal status." />)} />
        <Route path="/moderator/escalations" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="Priority desk" title="Escalations" description="Handle urgent safety, copyright, and policy cases that require senior review." />)} />
        <Route path="/moderator/audit-trail" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="Accountability" title="Audit Trail" description="Trace moderation activity with immutable event details and reviewer attribution." />)} />
        <Route path="/moderator/settings" element={role('moderator', <ReaderProfilePage workspace="moderator" />)} />
        <Route path="/moderator/settings/:section" element={role('moderator', <ReaderProfilePage workspace="moderator" />)} />
        <Route path="/moderator/profile" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="Shared profile" title="Profile" description="Manage your display identity and shared NovelHub profile information." />)} />
        <Route path="/moderator/account" element={role('moderator', <AccountPage workspace="moderator" />)} />
        <Route path="/moderator/support" element={role('moderator', <RoleUtilityPage role="moderator" eyebrow="NovelHub help" title="Help & Support" description="Find moderation guidance, policy references, and support channels." />)} />
        <Route
          path="/moderator/similarity-review/:reviewId"
          element={role('moderator', <SimilarityRiskReviewPage />)}
        />
        <Route path="/admin" element={role('admin', <AdminDashboardPage />)} />
        <Route path="/admin/users" element={role('admin', <UsersManagementPage />)} />
        <Route path="/admin/users/:userId" element={role('admin', <AuthorAgreementPage />)} />
        <Route path="/admin/roles" element={role('admin', <RolesPermissionsPage />)} />
        <Route path="/admin/categories" element={role('admin', <CategoriesConfigurationPage />)} />
        <Route path="/admin/settings" element={role('admin', <PlatformSettingsPage />)} />
        <Route path="/admin/preferences" element={role('admin', <ReaderProfilePage workspace="admin" />)} />
        <Route path="/admin/preferences/:section" element={role('admin', <ReaderProfilePage workspace="admin" />)} />
        <Route path="/admin/profile" element={role('admin', <RoleUtilityPage role="admin" eyebrow="Shared profile" title="Profile" description="Manage your display identity and shared NovelHub profile information." />)} />
        <Route path="/admin/account" element={role('admin', <AccountPage workspace="admin" />)} />
        <Route path="/admin/support" element={role('admin', <RoleUtilityPage role="admin" eyebrow="NovelHub help" title="Help & Support" description="Find administration guidance, operational documentation, and support channels." />)} />
        <Route path="/admin/content" element={role('admin', <RoleUtilityPage role="admin" eyebrow="Content governance" title="Content Configuration" description="Manage publication rules, discovery metadata, content ratings, and platform-wide defaults." />)} />
        <Route path="/admin/services" element={role('admin', <RoleUtilityPage role="admin" eyebrow="Infrastructure" title="Services & Infrastructure" description="Monitor external services, storage, search, audio processing, and operational capacity." />)} />
        <Route path="/admin/audit-logs" element={role('admin', <RoleUtilityPage role="admin" eyebrow="Security" title="Audit Logs" description="Search administrative events, authentication records, configuration changes, and protected actions." />)} />
        <Route path="/admin/moderation" element={role('admin', <RoleUtilityPage role="admin" eyebrow="Governance" title="Moderation Oversight" description="Track policy enforcement, queue health, escalations, appeals, and moderator performance." />)} />
        <Route path="/admin/transactions" element={role('admin', <RoleUtilityPage role="admin" eyebrow="Platform finance" title="Wallet Transactions" description="Review coin top-ups, chapter purchases, refunds, adjustments, and transaction anomalies across the platform." />)} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/ui-preview" element={<UIPreviewPage />} />
        {pages.map((Page, index) => (
          <Route
            key={index}
            path={`/ui-preview/p${String(index + 1).padStart(2, '0')}`}
            element={<Page />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {showPublicFooter && <SiteFooter />}
      <DevPanel />
    </>
  )
}

function ReaderExplorePage() {
  return (
    <ReaderLayout>
      <SearchResultsPage embedded />
    </ReaderLayout>
  )
}

function AdaptivePublicPage({ page }) {
  const { isAuthenticated, hasRole } = useAuth()
  const { search } = useLocation()
  const pagesByName = {
    home: GuestHomePage,
    categories: CategoriesPage,
    search: SearchResultsPage,
    rankings: RankingsPage,
  }
  const Page = pagesByName[page]

  if (!isAuthenticated) return <Page />

  const requestedWorkspace = new URLSearchParams(search).get('workspace')
  const workspace = ['admin', 'moderator', 'author', 'reader'].find(
    roleName => roleName === requestedWorkspace && hasRole(roleName),
  ) || 'reader'
  const Layout = { reader: ReaderLayout, author: AuthorLayout, moderator: ModeratorLayout, admin: AdminLayout }[workspace]
  return (
    <Layout>
      <Page embedded />
    </Layout>
  )
}

function AdaptiveLegalPage({ type }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <LegalPage type={type} />
  return (
    <ReaderLayout>
      <LegalPage type={type} embedded />
    </ReaderLayout>
  )
}

function AdaptiveStoryPage() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <StoryDetailPage />
  return (
    <ReaderLayout>
      <StoryDetailPage embedded />
    </ReaderLayout>
  )
}
export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <MockDataProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </MockDataProvider>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  )
}
