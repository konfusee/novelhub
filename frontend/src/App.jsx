import { Link, Route, Routes } from 'react-router';
import { ApiStatus } from './components/ApiStatus.jsx';

function Home() {
  return (
    <main>
      <h1>NovelHub</h1>
      <ApiStatus />
    </main>
  );
}

function NotFound() {
  return (
    <main>
      <h1>Không tìm thấy trang</h1>
      <Link to="/">Về trang chủ</Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
