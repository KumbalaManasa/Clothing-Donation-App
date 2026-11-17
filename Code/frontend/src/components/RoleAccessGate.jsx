import { ArrowRight, ShieldAlert } from 'lucide-react'
import RoleEntryLayout from './RoleEntryLayout.jsx'

const requiredRoleArticle = {
  Donor: 'a donor',
  NGO: 'an NGO',
  Admin: 'an admin',
}

function RoleAccessGate({ role, currentRole, slides, onLogout }) {
  const requiredRole = requiredRoleArticle[role]

  return (
    <RoleEntryLayout
      role={role}
      title={`${role} access`}
      description={`This workspace is for ${role} accounts. Switch to the correct role to continue.`}
      slides={slides}
      variant="access"
    >
      <div className="role-access-card" role="alert">
        <span className="role-access-icon" aria-hidden="true"><ShieldAlert size={21} /></span>
        <div>
          <strong>You must be logged in as {requiredRole} to view this page.</strong>
          <p>You’re currently signed in as {currentRole}. Log out, then sign in with {requiredRole} account.</p>
        </div>
      </div>
      <button className="role-access-action" type="button" onClick={onLogout}>
        Log out to switch accounts <ArrowRight size={17} aria-hidden="true" />
      </button>
    </RoleEntryLayout>
  )
}

export default RoleAccessGate
