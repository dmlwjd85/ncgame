import { Navigate, Route, Routes } from 'react-router-dom'
import AdminExcelUpload from './components/admin/AdminExcelUpload'
import Home from './pages/Home'

/**
 * 최상위 라우팅 뼈대 — 페이즈·게임방 경로는 이후 확장
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin" element={<AdminExcelUpload />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
