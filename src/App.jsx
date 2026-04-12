import { Navigate, Route, Routes } from 'react-router-dom'
import AdminExcelUpload from './components/admin/AdminExcelUpload'
import MasterRoute from './components/MasterRoute'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Game from './pages/Game'
import Login from './pages/Login'
import Register from './pages/Register'

/**
 * 최상위 라우팅 — 홈·로그인·게임·관리자
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} />
      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <Game />
          </ProtectedRoute>
        }
      />
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
