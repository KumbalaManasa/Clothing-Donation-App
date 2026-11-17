import { useLocation } from 'react-router-dom'
import { ChartNoAxesColumn, ClipboardCheck, ShieldCheck, UserRound, Clock3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import AdminLoginForm from '../components/AdminLoginForm.jsx'
import ListingsModerationTable from '../components/ListingsModerationTable.jsx'
import StaleClaimsTable from '../components/StaleClaimsTable.jsx'
import NgoVerificationsTable from '../components/NgoVerificationsTable.jsx'
import RoleEntryLayout from '../components/RoleEntryLayout.jsx'
import RoleAccessGate from '../components/RoleAccessGate.jsx'
import { adminSlides } from '../content/rolePhotos.js'
import AnalyticsDashboard from '../components/AnalyticsDashboard.jsx'
import RoleWorkspace from '../components/RoleWorkspace.jsx'
import AccountDetails from '../components/AccountDetails.jsx'

const sections = [
  { key: 'dashboard', title: 'Dashboard', description: 'Review platform activity and delivery trends.', icon: ChartNoAxesColumn, to: '/admin/dashboard' },
  { key: 'moderation', title: 'Listing moderation', description: 'Review and manage donation listings.', icon: ClipboardCheck, to: '/admin/moderation' },
  { key: 'verification', title: 'NGO verification', description: 'Review organization verification records.', icon: ShieldCheck, to: '/admin/ngo-verifications' },
  { key: 'stale-claims', title: 'Stale claims', description: 'Review claims that expired before pickup.', icon: Clock3, to: '/admin/stale-claims' },
  { key: 'account', title: 'My account', description: 'View your admin account details.', icon: UserRound, to: '/admin/account' },
]

function AdminPage() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  if (!user) {
    return (
      <RoleEntryLayout
        role="Admin"
        title="Admin"
        description="A clear view of listings, verification, and claims helps the community donation process run smoothly."
        slides={adminSlides}
      >
        <AdminLoginForm />
      </RoleEntryLayout>
    )
  }

  // The backend already rejects a non-admin token on every /admin/* route
  // (task 8's requireRole('admin')) — this is the same guard applied
  // client-side so a donor/NGO who happens to be logged in and navigates
  // here sees a plain message instead of a table that just 403s (task 11.4:
  // no control here can mutate NGO verification either way, so this gate is
  // purely about who sees the moderation UI at all, not a security boundary
  // by itself).
  if (user.role !== 'admin') {
    const currentRole = { donor: 'Donor', ngo: 'NGO' }[user.role] ?? user.role
    return <RoleAccessGate role="Admin" currentRole={currentRole} slides={adminSlides} onLogout={logout} />
  }

  const routeSection = pathname === '/admin' ? 'home' : pathname.split('/')[2]
  const active = routeSection === 'ngo-verifications' ? 'verification' : routeSection
  const content = {
    dashboard: <AnalyticsDashboard role="admin" />,
    moderation: <ListingsModerationTable />,
    verification: <NgoVerificationsTable />,
    'stale-claims': <StaleClaimsTable />,
    account: <AccountDetails user={user} />,
  }[active]

  return <RoleWorkspace role="Admin" user={user} logout={logout} active={content ? active : 'home'} sections={sections}>
    {content}
  </RoleWorkspace>
}

export default AdminPage
