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

function App() {
  return <ThemeProvider><BrowserRouter><Routes><Route path="/" element={<GuestHomePage/>}/><Route path="/categories" element={<CategoriesPage/>}/><Route path="/search" element={<SearchResultsPage/>}/><Route path="/rankings" element={<RankingsPage/>}/><Route path="/stories/:storyId" element={<StoryDetailPage/>}/><Route path="/stories/:storyId/preview/:chapterId" element={<GuestReaderPreviewPage/>}/><Route path="/join" element={<JoinPage/>}/><Route path="/reader" element={<ReaderHomePage/>}/><Route path="/reader/library" element={<PersonalLibraryPage/>}/><Route path="/reader/following" element={<FollowingPage/>}/><Route path="/reader/history" element={<ReadingHistoryPage/>}/><Route path="/reader/notifications" element={<NotificationsPage/>}/><Route path="/reader/profile" element={<ReaderProfilePage/>}/><Route path="/reader/wallet" element={<WalletPage/>}/><Route path="/read/:storyId/:chapterId" element={<FullChapterReaderPage/>}/><Route path="/listen/:storyId/:chapterId" element={<FullAudioPlayerPage/>}/><Route path="/ui-preview" element={<UIPreviewPage />} /><Route path="/ui-preview/p01" element={<GuestHomePage/>}/><Route path="/ui-preview/p02" element={<CategoriesPage/>}/><Route path="/ui-preview/p03" element={<SearchResultsPage/>}/><Route path="/ui-preview/p04" element={<RankingsPage/>}/><Route path="/ui-preview/p05" element={<StoryDetailPage/>}/><Route path="/ui-preview/p06" element={<GuestReaderPreviewPage/>}/><Route path="/ui-preview/p07" element={<JoinPage/>}/><Route path="/ui-preview/p08" element={<ReaderHomePage/>}/><Route path="/ui-preview/p09" element={<PersonalLibraryPage/>}/><Route path="/ui-preview/p10" element={<FollowingPage/>}/><Route path="/ui-preview/p11" element={<FullChapterReaderPage/>}/><Route path="/ui-preview/p12" element={<FullAudioPlayerPage/>}/><Route path="/ui-preview/p13" element={<ReadingHistoryPage/>}/><Route path="/ui-preview/p14" element={<NotificationsPage/>}/><Route path="/ui-preview/p15" element={<ReaderProfilePage/>}/><Route path="/ui-preview/p16" element={<WalletPage/>}/><Route path="*" element={<Navigate to="/ui-preview" replace />} /></Routes></BrowserRouter></ThemeProvider>
}

export default App
