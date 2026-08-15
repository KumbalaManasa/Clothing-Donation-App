import { Link, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import DonorPage from './pages/DonorPage.jsx'
import NgoPage from './pages/NgoPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import BackendStatus from './components/BackendStatus.jsx'
import './App.css'

function App() {
  return (
    <>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/donor">Donor</Link>
        <Link to="/ngo">NGO</Link>
        <Link to="/admin">Admin</Link>
      </nav>
      <BackendStatus />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/donor" element={<DonorPage />} />
        <Route path="/ngo" element={<NgoPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </>
  )
}

export default App
