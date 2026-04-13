import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AdminExcelUpload from './components/admin/AdminExcelUpload'
import AdminLayout from './components/admin/AdminLayout'
import AdminUserManagement from './components/admin/AdminUserManagement'
import MasterRoute from './components/MasterRoute'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Game from './pages/Game'
import ComboChallenge from './pages/ComboChallenge'
import Login from './pages/Login'
import Register from './pages/Register'

/** 게임 진입마다 상태 초기화 (동일 팩 재도전 포함) */
function GameScreen() {
  const { key } = useLocation()
  return (
    <ProtectedRoute>
      <Game key={key} />
    </ProtectedRoute>
  )
}

/**
 * 최상위 라우팅 — 홈·로그인·게임·관리자
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} />
      <Route path="/combo-challenge" element={<ComboChallenge />} />
      <Route path="/game" element={<GameScreen />} />
      <Route
        path="/admin"
        element={
          <MasterRoute>
            <AdminLayout />
          </MasterRoute>
        }
      >
        <Route index element={<Navigate to="/admin/excel" replace />} />
        <Route path="excel" element={<AdminExcelUpload />} />
        <Route path="users" element={<AdminUserManagement />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
