import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import UserHome from './pages/UserHome'
import DriverHome from './pages/DriverHome'
import OfficeHome from './pages/OfficeHome'
import AdminHome from './pages/AdminHome'
import TicketRequest from './pages/TicketRequest'
import TicketHistory from './pages/TicketHistory'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/user/home"
            element={
              <ProtectedRoute>
                <UserHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/ticket-request"
            element={
              <ProtectedRoute>
                <TicketRequest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/ticket-history"
            element={
              <ProtectedRoute>
                <TicketHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/home"
            element={
              <ProtectedRoute>
                <DriverHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/office/home"
            element={
              <ProtectedRoute>
                <OfficeHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/home"
            element={
              <ProtectedRoute>
                <AdminHome />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
