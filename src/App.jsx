import { Navigate, Route, Routes } from 'react-router-dom'
import AdminExcelUpload from './components/admin/AdminExcelUpload'
import MasterRoute from './components/MasterRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

/**
 * 최상위 라우팅 — 페이즈·게임방 경로는 이후 확장
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} />
      <Route
        path="/admin"
        element={
          <MasterRoute>
            <AdminExcelUpload />
          </MasterRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
