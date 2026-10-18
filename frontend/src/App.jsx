import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, canAccessPath, getAccountHome, useAuth } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { MockDataProvider } from './context/MockDataContext';
import { authorAgreements } from './data/authorAgreements';
import { ROUTES } from './app/routes';
import { RoleRoute } from './app/RouteGuards';
import { DevPanel } from './components/dev/DevPanel';
import { SiteFooter } from './components/shared/SiteFooter';
import { RouteFallback } from './components/shared/RouteFallback';
import { TopProgress } from './components/shared/TopProgress';
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from './layouts';

// Route pages load on demand; RouteFallback shows a shell skeleton meanwhile.
const UIPreviewPage = lazy(() =>
  import('./pages/system/UIPreviewPage').then((m) => ({ default: m.UIPreviewPage })),
);
const GuestHomePage = lazy(() =>
  import('./pages/guest/GuestHomePage').then((m) => ({ default: m.GuestHomePage })),
);
const CategoriesPage = lazy(() =>
  import('./pages/guest/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);
const SearchResultsPage = lazy(() =>
  import('./pages/guest/SearchResultsPage').then((m) => ({ default: m.SearchResultsPage })),
);
const RankingsPage = lazy(() =>
  import('./pages/guest/RankingsPage').then((m) => ({ default: m.RankingsPage })),
);
const StoryDetailPage = lazy(() =>
  import('./pages/guest/StoryDetailPage').then((m) => ({ default: m.StoryDetailPage })),
);
const GuestReaderPreviewPage = lazy(() =>
  import('./pages/guest/GuestReaderPreviewPage').then((m) => ({
    default: m.GuestReaderPreviewPage,
  })),
);
const JoinPage = lazy(() => import('./pages/auth/JoinPage').then((m) => ({ default: m.JoinPage })));
const AuthRecoveryPage = lazy(() =>
  import('./pages/auth/AuthRecoveryPage').then((m) => ({ default: m.AuthRecoveryPage })),
);
const ReaderHomePage = lazy(() =>
  import('./pages/reader/ReaderHomePage').then((m) => ({ default: m.ReaderHomePage })),
);
const PersonalLibraryPage = lazy(() =>
  import('./pages/reader/PersonalLibraryPage').then((m) => ({ default: m.PersonalLibraryPage })),
);
const FollowingPage = lazy(() =>
  import('./pages/reader/FollowingPage').then((m) => ({ default: m.FollowingPage })),
);
const FullChapterReaderPage = lazy(() =>
  import('./pages/reader/FullChapterReaderPage').then((m) => ({
    default: m.FullChapterReaderPage,
  })),
);
const FullAudioPlayerPage = lazy(() =>
  import('./pages/reader/FullAudioPlayerPage').then((m) => ({ default: m.FullAudioPlayerPage })),
);
const ReadingHistoryPage = lazy(() =>
  import('./pages/reader/ReadingHistoryPage').then((m) => ({ default: m.ReadingHistoryPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/reader/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ReaderProfilePage = lazy(() =>
  import('./pages/reader/ReaderProfilePage').then((m) => ({ default: m.ReaderProfilePage })),
);
const WalletPage = lazy(() =>
  import('./pages/reader/WalletPage').then((m) => ({ default: m.WalletPage })),
);
const AuthorDashboardPage = lazy(() =>
  import('./pages/author/AuthorDashboardPage').then((m) => ({ default: m.AuthorDashboardPage })),
);
const CreateStoryPage = lazy(() =>
  import('./pages/author/CreateStoryPage').then((m) => ({ default: m.CreateStoryPage })),
);
const AuthorWorksPage = lazy(() =>
  import('./pages/author/AuthorWorksPage').then((m) => ({ default: m.AuthorWorksPage })),
);
const StoryManagerPage = lazy(() =>
  import('./pages/author/StoryManagerPage').then((m) => ({ default: m.StoryManagerPage })),
);
const ChapterEditorPage = lazy(() =>
  import('./pages/author/ChapterEditorPage').then((m) => ({ default: m.ChapterEditorPage })),
);
const AuthorPreviewPage = lazy(() =>
  import('./pages/author/AuthorPreviewPage').then((m) => ({ default: m.AuthorPreviewPage })),
);
const SubmittedPackagePage = lazy(() =>
  import('./pages/author/SubmittedPackagePage').then((m) => ({ default: m.SubmittedPackagePage })),
);
const DraftsPage = lazy(() =>
  import('./pages/author/DraftsPage').then((m) => ({ default: m.DraftsPage })),
);
const ImportPdfPage = lazy(() =>
  import('./pages/author/ImportPdfPage').then((m) => ({ default: m.ImportPdfPage })),
);
const MediaLibraryPage = lazy(() =>
  import('./pages/author/MediaLibraryPage').then((m) => ({ default: m.MediaLibraryPage })),
);
const SubmissionReviewPage = lazy(() =>
  import('./pages/author/SubmissionReviewPage').then((m) => ({ default: m.SubmissionReviewPage })),
);
const AuthorAnalyticsPage = lazy(() =>
  import('./pages/author/AuthorAnalyticsPage').then((m) => ({ default: m.AuthorAnalyticsPage })),
);
const AuthorEarningsPage = lazy(() =>
  import('./pages/author/AuthorEarningsPage').then((m) => ({ default: m.AuthorEarningsPage })),
);
const ModeratorOverviewPage = lazy(() =>
  import('./pages/moderator/ModeratorOverviewPage').then((m) => ({
    default: m.ModeratorOverviewPage,
  })),
);
const SubmissionQueuePage = lazy(() =>
  import('./pages/moderator/SubmissionQueuePage').then((m) => ({ default: m.SubmissionQueuePage })),
);
const ContentReviewDetailPage = lazy(() =>
  import('./pages/moderator/ContentReviewDetailPage').then((m) => ({
    default: m.ContentReviewDetailPage,
  })),
);
const ReportsQueuePage = lazy(() =>
  import('./pages/moderator/ReportsQueuePage').then((m) => ({ default: m.ReportsQueuePage })),
);
const SimilarityRiskReviewPage = lazy(() =>
  import('./pages/moderator/SimilarityRiskReviewPage').then((m) => ({
    default: m.SimilarityRiskReviewPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const UsersManagementPage = lazy(() =>
  import('./pages/admin/UsersManagementPage').then((m) => ({ default: m.UsersManagementPage })),
);
const RolesPermissionsPage = lazy(() =>
  import('./pages/admin/RolesPermissionsPage').then((m) => ({ default: m.RolesPermissionsPage })),
);
const CategoriesConfigurationPage = lazy(() =>
  import('./pages/admin/CategoriesConfigurationPage').then((m) => ({
    default: m.CategoriesConfigurationPage,
  })),
);
const PlatformSettingsPage = lazy(() =>
  import('./pages/admin/PlatformSettingsPage').then((m) => ({ default: m.PlatformSettingsPage })),
);
const AuditEventsPage = lazy(() =>
  import('./pages/admin/AuditEventsPage').then((m) => ({ default: m.AuditEventsPage })),
);
const AccountClosuresPage = lazy(() =>
  import('./pages/admin/AccountClosuresPage').then((m) => ({ default: m.AccountClosuresPage })),
);
const BankReceiptsPage = lazy(() =>
  import('./pages/admin/BankReceiptsPage').then((m) => ({ default: m.BankReceiptsPage })),
);
const ReviewClaimsPage = lazy(() =>
  import('./pages/moderator/ReviewClaimsPage').then((m) => ({ default: m.ReviewClaimsPage })),
);
const ManualReviewPage = lazy(() =>
  import('./pages/moderator/ManualReviewPage').then((m) => ({ default: m.ManualReviewPage })),
);
const ReviewHistoryPage = lazy(() =>
  import('./pages/moderator/ReviewHistoryPage').then((m) => ({ default: m.ReviewHistoryPage })),
);
const FinanceReportPage = lazy(() =>
  import('./pages/admin/FinanceReportPage').then((m) => ({ default: m.FinanceReportPage })),
);
const FormerAuthorStoriesPage = lazy(() =>
  import('./pages/admin/FormerAuthorStoriesPage').then((m) => ({
    default: m.FormerAuthorStoriesPage,
  })),
);
const AuthorApplyPage = lazy(() =>
  import('./pages/author/AuthorApplyPage').then((m) => ({ default: m.AuthorApplyPage })),
);
const AuthorAgreementPage = lazy(() =>
  import('./pages/admin/AuthorAgreementPage').then((m) => ({ default: m.AuthorAgreementPage })),
);
const ForbiddenPage = lazy(() =>
  import('./pages/system/SystemPages').then((m) => ({ default: m.ForbiddenPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/system/SystemPages').then((m) => ({ default: m.NotFoundPage })),
);
const LegalPage = lazy(() =>
  import('./pages/system/LegalPage').then((m) => ({ default: m.LegalPage })),
);
const RoleUtilityPage = lazy(() =>
  import('./pages/system/RoleUtilityPage').then((m) => ({ default: m.RoleUtilityPage })),
);
const ProfileAccountPage = lazy(() =>
  import('./pages/system/ProfileAccountPage').then((m) => ({ default: m.ProfileAccountPage })),
);

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
];
const role = (name, element, onboard = false) => (
  <RoleRoute role={name} authorOnboarding={onboard}>
    {element}
  </RoleRoute>
);
function ScrollManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith('/read/')) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
function AppRoutes() {
  const { pathname, search } = useLocation();
  const { isAuthenticated } = useAuth();
  // Public discovery and authentication pages share the footer; workspace pages end with their content.
  const showPublicFooter =
    ['/login', '/register', '/join', '/author/apply', '/terms', '/privacy'].includes(pathname) ||
    (['/categories', '/rankings'].includes(pathname) &&
      !new URLSearchParams(search).has('workspace')) ||
    authorAgreements.some(({ type }) => pathname === ROUTES.authorAgreement(type)) ||
    (!isAuthenticated && ['/', '/discover', '/search'].includes(pathname));
  return (
    <>
      <ScrollManager />
      <TopProgress />
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="/verify-email" element={<AuthRecoveryPage mode="verify" />} />
          <Route path="/forgot-password" element={<AuthRecoveryPage mode="forgot" />} />
          <Route path="/reset-password" element={<AuthRecoveryPage mode="reset" />} />
          <Route path="/auth/google-complete" element={<GoogleAuthComplete />} />
          {authorAgreements.map(({ type }) => (
            <Route
              key={type}
              path={ROUTES.authorAgreement(type)}
              element={<LegalPage type={type} />}
            />
          ))}
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/reader" element={role('reader', <ReaderHomePage />)} />
          <Route path="/reader/explore" element={role('reader', <ReaderExplorePage />)} />
          <Route path="/library" element={role('reader', <PersonalLibraryPage />)} />
          <Route path="/reader/library" element={role('reader', <PersonalLibraryPage />)} />
          <Route path="/reader/following" element={role('reader', <FollowingPage />)} />
          <Route path="/reader/history" element={role('reader', <ReadingHistoryPage />)} />
          <Route path="/reader/notifications" element={role('reader', <NotificationsPage />)} />
          <Route
            path="/reader/profile"
            element={role('reader', <ProfileAccountPage workspace="reader" />)}
          />
          <Route
            path="/reader/profile/reading"
            element={<Navigate to="/reader/settings/reading" replace />}
          />
          <Route
            path="/reader/profile/listening"
            element={<Navigate to="/reader/settings/listening" replace />}
          />
          <Route
            path="/reader/profile/appearance"
            element={<Navigate to="/reader/settings/appearance" replace />}
          />
          <Route
            path="/reader/profile/privacy"
            element={<Navigate to="/reader/settings/privacy" replace />}
          />
          <Route path="/reader/wallet" element={role('reader', <WalletPage />)} />
          <Route
            path="/reader/audiobooks"
            element={role(
              'reader',
              <RoleUtilityPage
                role="reader"
                eyebrow="Nghe truyện"
                title="Sách nói của tôi"
                description="Tiếp tục nghe, quản lý âm thanh đã tải và xem hàng đợi thuyết minh đã lưu."
              />,
            )}
          />
          <Route
            path="/reader/messages"
            element={role(
              'reader',
              <RoleUtilityPage
                role="reader"
                eyebrow="Cộng đồng"
                title="Tin nhắn"
                description="Theo dõi thông báo từ tác giả, câu lạc bộ đọc sách và thảo luận về truyện yêu thích."
              />,
            )}
          />
          <Route path="/reader/settings" element={role('reader', <ReaderProfilePage />)} />
          <Route path="/reader/settings/reading" element={role('reader', <ReaderProfilePage />)} />
          <Route
            path="/reader/settings/listening"
            element={role('reader', <ReaderProfilePage />)}
          />
          <Route
            path="/reader/settings/appearance"
            element={role('reader', <ReaderProfilePage />)}
          />
          <Route path="/reader/settings/privacy" element={role('reader', <ReaderProfilePage />)} />
          <Route path="/reader/settings/security" element={role('reader', <ReaderProfilePage />)} />
          <Route
            path="/reader/account"
            element={role('reader', <Navigate to="/reader/profile?tab=account" replace />)}
          />
          <Route
            path="/reader/support"
            element={role(
              'reader',
              <RoleUtilityPage
                role="reader"
                eyebrow="Trợ giúp NovelHub"
                title="Trợ giúp và hỗ trợ"
                description="Tìm hướng dẫn sản phẩm, hỗ trợ tiếp cận, câu hỏi thường gặp và kênh hỗ trợ."
              />,
            )}
          />
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
          <Route path="/author/stories" element={role('author', <AuthorWorksPage />, true)} />
          <Route path="/author/editor" element={role('author', <AuthorWorksPage editor />, true)} />
          <Route
            path="/author/stories/:storyId"
            element={role('author', <StoryManagerPage />, true)}
          />
          <Route
            path="/author/stories/:storyId/chapters/:chapterId/edit"
            element={role('author', <ChapterEditorPage />, true)}
          />
          <Route path="/author/drafts" element={role('author', <DraftsPage />, true)} />
          <Route
            path="/author/stories/:storyId/preview"
            element={role('author', <AuthorPreviewPage />, true)}
          />
          <Route
            path="/author/stories/:storyId/chapters/:chapterId/preview"
            element={role('author', <AuthorPreviewPage />, true)}
          />
          <Route path="/author/import" element={role('author', <ImportPdfPage />, true)} />
          <Route path="/author/media" element={role('author', <MediaLibraryPage />, true)} />
          <Route
            path="/author/ai"
            element={role('author', <Navigate to="/author" replace />, true)}
          />
          <Route
            path="/author/submissions"
            element={role('author', <SubmissionReviewPage />, true)}
          />
          <Route path="/author/analytics" element={role('author', <AuthorAnalyticsPage />, true)} />
          <Route
            path="/author/submissions/:submissionId/preview"
            element={role('author', <SubmittedPackagePage />, true)}
          />
          <Route path="/author/earnings" element={role('author', <AuthorEarningsPage />, true)} />
          <Route
            path="/author/profile"
            element={role('author', <ProfileAccountPage workspace="author" />, true)}
          />
          <Route path="/author/wallet" element={role('author', <AuthorEarningsPage />, true)} />
          <Route
            path="/author/settings"
            element={role('author', <ReaderProfilePage workspace="author" />, true)}
          />
          <Route
            path="/author/settings/:section"
            element={role('author', <ReaderProfilePage workspace="author" />, true)}
          />
          <Route
            path="/author/account"
            element={role('author', <Navigate to="/author/profile?tab=account" replace />, true)}
          />
          <Route
            path="/author/support"
            element={role(
              'author',
              <RoleUtilityPage
                role="author"
                eyebrow="Trợ giúp NovelHub"
                title="Trợ giúp và hỗ trợ"
                description="Tìm hướng dẫn sáng tác, hỗ trợ xuất bản, câu hỏi thường gặp và kênh hỗ trợ."
              />,
              true,
            )}
          />
          <Route path="/moderator" element={role('moderator', <ModeratorOverviewPage />)} />
          <Route path={ROUTES.moderatorClaims} element={role('moderator', <ReviewClaimsPage />)} />
          <Route
            path="/moderator/manual-reviews/:submissionId"
            element={role('moderator', <ManualReviewPage />)}
          />
          <Route
            path="/moderator/submissions"
            element={role('moderator', <ReviewClaimsPage initialView="intake" />)}
          />
          <Route
            path="/moderator/submissions/:submissionId"
            element={role('moderator', <ManualReviewPage />)}
          />
          <Route path="/moderator/reports" element={role('moderator', <ReportsQueuePage />)} />
          <Route
            path="/moderator/reviews"
            element={role('moderator', <ReviewClaimsPage initialView="mine" />)}
          />
          <Route
            path="/moderator/similarity-flags"
            element={role(
              'moderator',
              <RoleUtilityPage
                role="moderator"
                eyebrow="Tính nguyên bản"
                title="Cờ tương đồng"
                description="Kiểm tra kết quả tương đồng tự động và chuyển trường hợp rủi ro cao sang đánh giá chi tiết."
              />,
            )}
          />
          <Route path="/moderator/decisions" element={role('moderator', <ReviewHistoryPage />)} />
          <Route
            path="/moderator/escalations"
            element={role(
              'moderator',
              <RoleUtilityPage
                role="moderator"
                eyebrow="Bàn ưu tiên"
                title="Chuyển cấp"
                description="Xử lý trường hợp khẩn cấp về an toàn, bản quyền và chính sách cần đánh giá cấp cao."
              />,
            )}
          />
          <Route
            path="/moderator/audit-trail"
            element={role(
              'moderator',
              <RoleUtilityPage
                role="moderator"
                eyebrow="Trách nhiệm giải trình"
                title="Nhật ký kiểm tra"
                description="Theo dõi hoạt động kiểm duyệt với chi tiết sự kiện bất biến và người đánh giá."
              />,
            )}
          />
          <Route
            path="/moderator/settings"
            element={role('moderator', <ReaderProfilePage workspace="moderator" />)}
          />
          <Route
            path="/moderator/settings/:section"
            element={role('moderator', <ReaderProfilePage workspace="moderator" />)}
          />
          <Route
            path="/moderator/profile"
            element={role('moderator', <ProfileAccountPage workspace="moderator" />)}
          />
          <Route
            path="/moderator/account"
            element={role('moderator', <Navigate to="/moderator/profile?tab=account" replace />)}
          />
          <Route
            path="/moderator/support"
            element={role(
              'moderator',
              <RoleUtilityPage
                role="moderator"
                eyebrow="Trợ giúp NovelHub"
                title="Trợ giúp và hỗ trợ"
                description="Tìm hướng dẫn kiểm duyệt, chính sách tham chiếu và kênh hỗ trợ."
              />,
            )}
          />
          <Route
            path="/moderator/similarity-review/:reviewId"
            element={role('moderator', <SimilarityRiskReviewPage />)}
          />
          <Route path="/admin" element={role('admin', <AdminDashboardPage />)} />
          <Route path="/admin/users" element={role('admin', <UsersManagementPage />)} />
          <Route path="/admin/users/:userId" element={role('admin', <AuthorAgreementPage />)} />
          <Route path="/admin/roles" element={role('admin', <RolesPermissionsPage />)} />
          <Route
            path="/admin/categories"
            element={role('admin', <CategoriesConfigurationPage />)}
          />
          <Route path="/admin/settings" element={role('admin', <PlatformSettingsPage />)} />
          <Route
            path="/admin/preferences"
            element={role('admin', <ReaderProfilePage workspace="admin" />)}
          />
          <Route
            path="/admin/preferences/:section"
            element={role('admin', <ReaderProfilePage workspace="admin" />)}
          />
          <Route
            path="/admin/profile"
            element={role('admin', <ProfileAccountPage workspace="admin" />)}
          />
          <Route
            path="/admin/account"
            element={role('admin', <Navigate to="/admin/profile?tab=account" replace />)}
          />
          <Route
            path="/admin/support"
            element={role(
              'admin',
              <RoleUtilityPage
                role="admin"
                eyebrow="Trợ giúp NovelHub"
                title="Trợ giúp và hỗ trợ"
                description="Tìm hướng dẫn quản trị, tài liệu vận hành và kênh hỗ trợ."
              />,
            )}
          />
          <Route path="/admin/content" element={role('admin', <FormerAuthorStoriesPage />)} />
          <Route
            path="/admin/services"
            element={role(
              'admin',
              <RoleUtilityPage
                role="admin"
                eyebrow="Hạ tầng"
                title="Dịch vụ và hạ tầng"
                description="Giám sát dịch vụ ngoài, lưu trữ, tìm kiếm, xử lý âm thanh và năng lực vận hành."
              />,
            )}
          />
          <Route path="/admin/audit-logs" element={role('admin', <AuditEventsPage />)} />
          <Route
            path="/admin/moderation"
            element={role(
              'admin',
              <RoleUtilityPage
                role="admin"
                eyebrow="Quản trị"
                title="Giám sát kiểm duyệt"
                description="Theo dõi thực thi chính sách, tình trạng hàng đợi, chuyển cấp, khiếu nại và hiệu suất kiểm duyệt."
              />,
            )}
          />
          <Route path="/admin/transactions" element={role('admin', <FinanceReportPage />)} />
          <Route
            path="/admin/monthly-payouts"
            element={role('admin', <AccountClosuresPage monthly />)}
          />
          <Route
            path={ROUTES.adminAccountClosures}
            element={role('admin', <AccountClosuresPage />)}
          />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path={ROUTES.adminBankReceipts} element={role('admin', <BankReceiptsPage />)} />
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
      </Suspense>
      {showPublicFooter && <SiteFooter />}
      <DevPanel />
    </>
  );
}

function GoogleAuthComplete() {
  const [requestedPath] = useState(() => sessionStorage.getItem('novelhub.google.returnTo'));
  const { authLoading, currentUser } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!authLoading) {
      sessionStorage.removeItem('novelhub.google.returnTo');
      const safePath =
        requestedPath?.startsWith('/') &&
        !requestedPath.startsWith('//') &&
        canAccessPath(currentUser, requestedPath);
      navigate(
        currentUser
          ? safePath
            ? requestedPath
            : getAccountHome(currentUser)
          : '/login?googleError=failed',
        { replace: true },
      );
    }
  }, [authLoading, currentUser, navigate, requestedPath]);
  return <RouteFallback />;
}

function ReaderExplorePage() {
  return (
    <ReaderLayout>
      <SearchResultsPage embedded />
    </ReaderLayout>
  );
}

function AdaptivePublicPage({ page }) {
  const { isAuthenticated, hasRole } = useAuth();
  const { search } = useLocation();
  const pagesByName = {
    home: GuestHomePage,
    categories: CategoriesPage,
    search: SearchResultsPage,
    rankings: RankingsPage,
  };
  const Page = pagesByName[page];

  if (!isAuthenticated) return <Page />;

  const requestedWorkspace = new URLSearchParams(search).get('workspace');
  const workspace =
    ['admin', 'moderator', 'author', 'reader'].find(
      (roleName) => roleName === requestedWorkspace && hasRole(roleName),
    ) || 'reader';
  const Layout = {
    reader: ReaderLayout,
    author: AuthorLayout,
    moderator: ModeratorLayout,
    admin: AdminLayout,
  }[workspace];
  return (
    <Layout>
      <Page embedded />
    </Layout>
  );
}

function AdaptiveStoryPage() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <StoryDetailPage />;
  return (
    <ReaderLayout>
      <StoryDetailPage embedded />
    </ReaderLayout>
  );
}
export function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <MockDataProvider>
            <AppRoutes />
          </MockDataProvider>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
