function AccountDetails({ user }) {
  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Phone', user.phone],
    ['Role', user.role],
    ...(user.role === 'ngo' ? [
      ['Organization', user.org_name],
      ['Registration number', user.registration_number],
      ['Operating City / Address', user.address || user.operating_area],
      ['Verification status', user.verification_status],
    ] : []),
  ].filter(([, value]) => value)

  return <section className="account-details">
    <p className="workspace-eyebrow">ACCOUNT</p>
    <h2>My account</h2>
    <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </section>
}

export default AccountDetails
