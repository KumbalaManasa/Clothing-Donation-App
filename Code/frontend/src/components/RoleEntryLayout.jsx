import RolePhotoCarousel from './RolePhotoCarousel.jsx'

function RoleEntryLayout({ role, title, description, slides, children, variant }) {
  return (
    <section className={`role-entry${variant ? ` role-entry--${variant}` : ''}`} aria-labelledby="role-entry-title">
      <div className="role-entry-content">
        <p className="eyebrow">{role} community</p>
        <h1 id="role-entry-title">{title}</h1>
        <p className="role-entry-description">{description}</p>
        {children}
      </div>
      <RolePhotoCarousel role={role} slides={slides} />
    </section>
  )
}

export default RoleEntryLayout
