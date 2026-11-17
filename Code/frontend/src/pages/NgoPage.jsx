import { useLocation } from 'react-router-dom'
import { ChartNoAxesColumn, ClipboardList, Search, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import NgoAuthForm from '../components/NgoAuthForm.jsx'
import NgoReverifyForm from '../components/NgoReverifyForm.jsx'
import BrowseListings from '../components/BrowseListings.jsx'
import RoleEntryLayout from '../components/RoleEntryLayout.jsx'
import RoleAccessGate from '../components/RoleAccessGate.jsx'
import { ngoSlides } from '../content/rolePhotos.js'
import AnalyticsDashboard from '../components/AnalyticsDashboard.jsx'
import MyClaimsPage from './MyClaimsPage.jsx'
import RoleWorkspace from '../components/RoleWorkspace.jsx'
import AccountDetails from '../components/AccountDetails.jsx'

const sections = [
  { key: 'dashboard', title: 'Dashboard', description: 'Review claims, delivery results, and trends.', icon: ChartNoAxesColumn, to: '/ngo/dashboard' },
  { key: 'browse', title: 'Browse listings', description: 'Find clothing available in your area.', icon: Search, to: '/ngo/browse' },
  { key: 'claims', title: 'My claims', description: 'Coordinate pickups and manage deliveries.', icon: ClipboardList, to: '/ngo/claims' },
  { key: 'account', title: 'My account', description: 'View organization and verification details.', icon: UserRound, to: '/ngo/account' },
]

function NgoPage() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  if (!user) {
    return (
      <RoleEntryLayout
        role="NGO"
        title="NGO"
        description="Find available clothing, coordinate claims, and help good donations reach your community."
        slides={ngoSlides}
      >
        <NgoAuthForm />
      </RoleEntryLayout>
    )
  }

  // Same guard as DonorPage — the backend already rejects a non-NGO token on
  // every /listings/open, /claims, and /ngo route (requireRole('ngo') /
  // requireVerifiedNgo); this just keeps a donor who's logged in and
  // navigates here from seeing NGO-only UI that can never actually work.
  if (user.role !== 'ngo') {
    const currentRole = { donor: 'Donor', admin: 'Admin' }[user.role] ?? user.role
    return <RoleAccessGate role="NGO" currentRole={currentRole} slides={ngoSlides} onLogout={logout} />
  }

  const active = pathname === '/ngo' ? 'home' : pathname.split('/')[2]
  const browseContent = <>
    {user.verification_status && <p className="ngo-verification-pill" data-testid="ngo-verification-status" data-status={user.verification_status}>
      Verification: {user.verification_status === 'verified' ? 'Verified' : 'Not verified'}
    </p>}
    {user.verification_status === 'not_verified' && <NgoReverifyForm registrationNumber={user.registration_number} />}
    {user.verification_status === 'verified' && <BrowseListings />}
  </>
  const content = {
    dashboard: <AnalyticsDashboard role="ngo" />,
    browse: browseContent,
    claims: <MyClaimsPage />,
    account: <AccountDetails user={user} />,
  }[active]

  return <RoleWorkspace role="NGO" user={user} logout={logout} active={content ? active : 'home'} sections={sections}>
    {content}
  </RoleWorkspace>
}

export default NgoPage
