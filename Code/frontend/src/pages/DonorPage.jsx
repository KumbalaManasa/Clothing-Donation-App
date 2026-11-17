import { useLocation } from 'react-router-dom'
import { ChartNoAxesColumn, Package, Plus, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import DonorAuthForm from '../components/DonorAuthForm.jsx'
import CreateListingForm from '../components/CreateListingForm.jsx'
import RoleEntryLayout from '../components/RoleEntryLayout.jsx'
import RoleAccessGate from '../components/RoleAccessGate.jsx'
import { donorSlides } from '../content/rolePhotos.js'
import AnalyticsDashboard from '../components/AnalyticsDashboard.jsx'
import MyListingsPage from './MyListingsPage.jsx'
import RoleWorkspace from '../components/RoleWorkspace.jsx'
import AccountDetails from '../components/AccountDetails.jsx'

const sections = [
  { key: 'dashboard', title: 'Dashboard', description: 'See your donation impact and trends.', icon: ChartNoAxesColumn, to: '/donor/dashboard' },
  { key: 'new-listing', title: 'New listing', description: 'Add clothes and arrange a pickup.', icon: Plus, to: '/donor/new-listing' },
  { key: 'listings', title: 'My listings', description: 'Track the status of your donations.', icon: Package, to: '/donor/listings' },
  { key: 'account', title: 'My account', description: 'View your account details.', icon: UserRound, to: '/donor/account' },
]

function DonorPage() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  if (!user) {
    return (
      <RoleEntryLayout
        role="Donor"
        title="Donor"
        description="Give clean, wearable clothes a thoughtful next chapter. Your donation can help someone find pieces they feel good in."
        slides={donorSlides}
      >
        <DonorAuthForm />
      </RoleEntryLayout>
    )
  }

  // Backend already rejects a non-donor token on every /listings write route
  // (requireRole('donor')) — this is the same guard client-side, so an NGO
  // who's logged in and navigates here sees a plain message instead of a
  // fully interactive form that can never actually submit.
  if (user.role !== 'donor') {
    const currentRole = { ngo: 'NGO', admin: 'Admin' }[user.role] ?? user.role
    return <RoleAccessGate role="Donor" currentRole={currentRole} slides={donorSlides} onLogout={logout} />
  }

  const active = pathname === '/donor' ? 'home' : pathname.split('/')[2]
  const content = {
    dashboard: <AnalyticsDashboard role="donor" />,
    'new-listing': <CreateListingForm />,
    listings: <MyListingsPage />,
    account: <AccountDetails user={user} />,
  }[active]

  return <RoleWorkspace role="Donor" user={user} logout={logout} active={content ? active : 'home'} sections={sections}>
    {content}
  </RoleWorkspace>
}

export default DonorPage
