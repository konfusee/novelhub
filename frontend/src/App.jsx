import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { UIPreviewPage } from './pages/UIPreviewPage'
import { GuestHomePage } from './pages/GuestHomePage'
import { CategoriesPage } from './pages/CategoriesPage'
import { SearchResultsPage } from './pages/SearchResultsPage'
import { RankingsPage } from './pages/RankingsPage'
import { StoryDetailPage } from './pages/StoryDetailPage'
import { GuestReaderPreviewPage } from './pages/GuestReaderPreviewPage'
import { JoinPage } from './pages/JoinPage'
import { ReaderHomePage } from './pages/ReaderHomePage'
import { PersonalLibraryPage } from './pages/PersonalLibraryPage'
import { FollowingPage } from './pages/FollowingPage'
import { FullChapterReaderPage } from './pages/FullChapterReaderPage'
import { FullAudioPlayerPage } from './pages/FullAudioPlayerPage'
import { ReadingHistoryPage } from './pages/ReadingHistoryPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ReaderProfilePage } from './pages/ReaderProfilePage'
import { WalletPage } from './pages/WalletPage'
import { AuthorDashboardPage } from './pages/AuthorDashboardPage'
import { CreateStoryPage } from './pages/CreateStoryPage'
import { StoryManagerPage } from './pages/StoryManagerPage'
import { ChapterEditorPage } from './pages/ChapterEditorPage'
import { DraftsPage } from './pages/DraftsPage'
import { ImportPdfPage } from './pages/ImportPdfPage'
import { MediaLibraryPage } from './pages/MediaLibraryPage'
import { AiWritingAssistantPage } from './pages/AiWritingAssistantPage'
import { SubmissionReviewPage } from './pages/SubmissionReviewPage'
import { AuthorAnalyticsPage } from './pages/AuthorAnalyticsPage'
import { ModeratorOverviewPage } from './pages/ModeratorOverviewPage'
import { SubmissionQueuePage } from './pages/SubmissionQueuePage'
import { ContentReviewDetailPage } from './pages/ContentReviewDetailPage'
import { ReportsQueuePage } from './pages/ReportsQueuePage'
import { SimilarityRiskReviewPage } from './pages/SimilarityRiskReviewPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { UsersManagementPage } from './pages/UsersManagementPage'
import { RolesPermissionsPage } from './pages/RolesPermissionsPage'
import { CategoriesConfigurationPage } from './pages/CategoriesConfigurationPage'
import { PlatformSettingsPage } from './pages/PlatformSettingsPage'

const previewPages=[GuestHomePage,CategoriesPage,SearchResultsPage,RankingsPage,StoryDetailPage,GuestReaderPreviewPage,JoinPage,ReaderHomePage,PersonalLibraryPage,FollowingPage,FullChapterReaderPage,FullAudioPlayerPage,ReadingHistoryPage,NotificationsPage,ReaderProfilePage,WalletPage,AuthorDashboardPage,CreateStoryPage,StoryManagerPage,ChapterEditorPage,DraftsPage,ImportPdfPage,MediaLibraryPage,AiWritingAssistantPage,SubmissionReviewPage,AuthorAnalyticsPage,ModeratorOverviewPage,SubmissionQueuePage,ContentReviewDetailPage,ReportsQueuePage,SimilarityRiskReviewPage,AdminDashboardPage,UsersManagementPage,RolesPermissionsPage,CategoriesConfigurationPage,PlatformSettingsPage]

function App(){return <ThemeProvider><BrowserRouter><Routes>
 <Route path="/" element={<GuestHomePage/>}/><Route path="/categories" element={<CategoriesPage/>}/><Route path="/search" element={<SearchResultsPage/>}/><Route path="/rankings" element={<RankingsPage/>}/><Route path="/stories/:storyId" element={<StoryDetailPage/>}/><Route path="/stories/:storyId/preview/:chapterId" element={<GuestReaderPreviewPage/>}/><Route path="/join" element={<JoinPage/>}/>
 <Route path="/reader" element={<ReaderHomePage/>}/><Route path="/reader/library" element={<PersonalLibraryPage/>}/><Route path="/reader/following" element={<FollowingPage/>}/><Route path="/reader/history" element={<ReadingHistoryPage/>}/><Route path="/reader/notifications" element={<NotificationsPage/>}/><Route path="/reader/profile" element={<ReaderProfilePage/>}/><Route path="/reader/wallet" element={<WalletPage/>}/><Route path="/read/:storyId/:chapterId" element={<FullChapterReaderPage/>}/><Route path="/listen/:storyId/:chapterId" element={<FullAudioPlayerPage/>}/>
 <Route path="/author" element={<AuthorDashboardPage/>}/><Route path="/author/stories/new" element={<CreateStoryPage/>}/><Route path="/author/stories/:storyId" element={<StoryManagerPage/>}/><Route path="/author/stories/:storyId/chapters/:chapterId/edit" element={<ChapterEditorPage/>}/><Route path="/author/drafts" element={<DraftsPage/>}/><Route path="/author/import" element={<ImportPdfPage/>}/><Route path="/author/media" element={<MediaLibraryPage/>}/><Route path="/author/ai" element={<AiWritingAssistantPage/>}/><Route path="/author/submissions" element={<SubmissionReviewPage/>}/><Route path="/author/analytics" element={<AuthorAnalyticsPage/>}/>
 <Route path="/moderator" element={<ModeratorOverviewPage/>}/><Route path="/moderator/submissions" element={<SubmissionQueuePage/>}/><Route path="/moderator/submissions/:submissionId" element={<ContentReviewDetailPage/>}/><Route path="/moderator/reports" element={<ReportsQueuePage/>}/><Route path="/moderator/similarity-review/:reviewId" element={<SimilarityRiskReviewPage/>}/>
 <Route path="/admin" element={<AdminDashboardPage/>}/><Route path="/admin/users" element={<UsersManagementPage/>}/><Route path="/admin/roles" element={<RolesPermissionsPage/>}/><Route path="/admin/categories" element={<CategoriesConfigurationPage/>}/><Route path="/admin/settings" element={<PlatformSettingsPage/>}/>
 <Route path="/ui-preview" element={<UIPreviewPage/>}/>{previewPages.map((Page,index)=><Route key={index} path={`/ui-preview/p${String(index+1).padStart(2,'0')}`} element={<Page/>}/>)}<Route path="*" element={<Navigate to="/ui-preview" replace/>}/>
 </Routes></BrowserRouter></ThemeProvider>}

export default App
