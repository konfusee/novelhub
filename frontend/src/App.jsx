import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
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
import { SiteFooter } from './components/shared/SiteFooter'
import { ReaderLayout } from './layouts'

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
        <Route path="/stories/:storyId" element={<StoryDetailPage />} />
        <Route path="/story/:storyId" element={<StoryDetailPage />} />
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
        <Route path="/reader/wallet" element={role('reader', <WalletPage />)} />
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
        <Route path="/moderator" element={role('moderator', <ModeratorOverviewPage />)} />
        <Route path="/moderator/submissions" element={role('moderator', <SubmissionQueuePage />)} />
        <Route
          path="/moderator/submissions/:submissionId"
          element={role('moderator', <ContentReviewDetailPage />)}
        />
        <Route path="/moderator/reports" element={role('moderator', <ReportsQueuePage />)} />
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
  const { isAuthenticated } = useAuth()
  const pagesByName = {
    home: GuestHomePage,
    categories: CategoriesPage,
    search: SearchResultsPage,
    rankings: RankingsPage,
  }
  const Page = pagesByName[page]

  if (!isAuthenticated) return <Page />

  return (
    <ReaderLayout>
      <Page embedded />
    </ReaderLayout>
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
