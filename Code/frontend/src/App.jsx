import { Link, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import DonorPage from './pages/DonorPage.jsx'
import NgoPage from './pages/NgoPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import BackendStatus from './components/BackendStatus.jsx'
import NotificationCenter from './components/NotificationCenter.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './App.css'

function App() {
  const location = useLocation()

  return (
    <AuthProvider>
      <header className="site-header">
        <nav className="nav-inner" aria-label="Main navigation">
          <Link className="brand" to="/" aria-label="WearForward — Give clothes a future.">
            <img className="brand-symbol" src="/images/wearforward-icon.png" alt="" />
            <span className="brand-lockup">
              <span className="brand-name"><span>Wear</span><span>Forward</span></span>
              <span className="brand-tagline">Give clothes a future.</span>
            </span>
          </Link>
          <div className="nav-links">
            <Link className={location.pathname === '/' ? 'active' : ''} to="/">Home</Link>
            <Link className={location.pathname.startsWith('/donor') ? 'active' : ''} to="/donor">Donor</Link>
            <Link className={location.pathname.startsWith('/ngo') ? 'active' : ''} to="/ngo">NGO</Link>
            <Link className={location.pathname.startsWith('/admin') ? 'active' : ''} to="/admin">Admin</Link>
          </div>
          <div className="nav-tools"><NotificationCenter /></div>
        </nav>
      </header>
      <BackendStatus />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<DonorPage />} />
          <Route path="/auth/callback" element={<DonorPage />} />
          <Route path="/donor" element={<DonorPage />} />
          <Route path="/donor/dashboard" element={<DonorPage />} />
          <Route path="/donor/new-listing" element={<DonorPage />} />
          <Route path="/donor/listings" element={<DonorPage />} />
          <Route path="/donor/account" element={<DonorPage />} />
          <Route path="/ngo" element={<NgoPage />} />
          <Route path="/ngo/dashboard" element={<NgoPage />} />
          <Route path="/ngo/browse" element={<NgoPage />} />
          <Route path="/ngo/claims" element={<NgoPage />} />
          <Route path="/ngo/account" element={<NgoPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/dashboard" element={<AdminPage />} />
          <Route path="/admin/moderation" element={<AdminPage />} />
          <Route path="/admin/ngo-verifications" element={<AdminPage />} />
          <Route path="/admin/stale-claims" element={<AdminPage />} />
          <Route path="/admin/account" element={<AdminPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </main>
    </AuthProvider>
  )
}

export default App
