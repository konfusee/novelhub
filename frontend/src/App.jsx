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

function App() {
  return <ThemeProvider><BrowserRouter><Routes><Route path="/" element={<GuestHomePage/>}/><Route path="/categories" element={<CategoriesPage/>}/><Route path="/search" element={<SearchResultsPage/>}/><Route path="/rankings" element={<RankingsPage/>}/><Route path="/stories/:storyId" element={<StoryDetailPage/>}/><Route path="/stories/:storyId/preview/:chapterId" element={<GuestReaderPreviewPage/>}/><Route path="/join" element={<JoinPage/>}/><Route path="/ui-preview" element={<UIPreviewPage />} /><Route path="/ui-preview/p01" element={<GuestHomePage/>}/><Route path="/ui-preview/p02" element={<CategoriesPage/>}/><Route path="/ui-preview/p03" element={<SearchResultsPage/>}/><Route path="/ui-preview/p04" element={<RankingsPage/>}/><Route path="/ui-preview/p05" element={<StoryDetailPage/>}/><Route path="/ui-preview/p06" element={<GuestReaderPreviewPage/>}/><Route path="/ui-preview/p07" element={<JoinPage/>}/><Route path="*" element={<Navigate to="/ui-preview" replace />} /></Routes></BrowserRouter></ThemeProvider>
}

export default App
