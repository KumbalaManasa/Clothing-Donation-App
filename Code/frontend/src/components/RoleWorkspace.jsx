import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
const photo = (filename, photographer, photoPage, alt, focus = '50% 58%') => ({
  src: `/images/${filename}`,
  photographer,
  photoPage,
  alt,
  focus,
})

const workspaceVisuals = {
  Donor: {
    home: { photo: photo('volunteer-coordination.jpg', 'Gustavo Fring', 'https://www.pexels.com/photo/male-volunteer-packing-up-donations-7156184/', 'A volunteer organizes donated clothing beside a rail of wearable clothes.', '50% 54%'), eyebrow: 'A good start', title: 'Good clothes deserve another chapter', description: 'Create a listing or follow your donations from pickup through delivery.' },
    dashboard: { photo: photo('workspace-donor-dashboard.jpg', 'RDNE Stock project', 'https://www.pexels.com/photo/woman-sitting-on-a-rug-sorting-clothes-8581019/', 'A volunteer sorts clothing into boxes at home.', '50% 72%'), eyebrow: 'Your donation journey', title: 'Follow the story behind each donation', description: 'Review your activity and clothing donation trends.' },
    'new-listing': { photo: photo('donor-new-listing-box.jpg', 'Towfiqu barbhuiya', 'https://www.pexels.com/photo/box-with-clothes-for-donation-11200117/', 'Colorful clothes are arranged in a box marked for donation.', '50% 68%'), eyebrow: 'New donation', title: 'Start with the pieces you are ready to share', description: 'Add item details, clothing condition, photos, and a pickup location.' },
    listings: { photo: photo('workspace-donor-listings.jpg', 'RDNE Stock project', 'https://www.pexels.com/photo/a-person-holding-a-pile-of-folded-clothes-7310204/', 'A person rests a hand on a neat stack of folded clothes.', '50% 55%'), eyebrow: 'Your listings', title: 'See each donation move forward', description: 'Check listing status and follow its progress toward pickup and distribution.' },
    account: { photo: photo('workspace-donor-account.jpg', 'Liza Summer', 'https://www.pexels.com/photo/crop-anonymous-person-showing-donation-box-6348119/', 'A person holds a box for clothing donations.', '50% 69%'), eyebrow: 'Your profile', title: 'Your account details, together in one place', description: 'Review the donor information connected to your account.' },
  },
  NGO: {
    home: { photo: photo('workspace-ngo-home.jpg', 'Julia M. Cameron', 'https://www.pexels.com/photo/volunteers-in-a-loft-with-donations-6995109/', 'Volunteers organize donated clothes in a bright community space.', '50% 62%'), eyebrow: 'NGO workspace', title: 'Connect good clothing with community needs', description: 'Browse listings, coordinate pickup, and follow claims through distribution.' },
    dashboard: { photo: photo('workspace-ngo-dashboard.jpg', 'Julia M. Cameron', 'https://www.pexels.com/photo/people-sorting-donations-6994963/', 'A diverse volunteer team sorts clothes and supplies at a donation center.', '50% 63%'), eyebrow: 'Your delivery activity', title: 'Make every claim count', description: 'Review delivery outcomes, monthly activity, and clothing condition trends.' },
    browse: { photo: photo('workspace-ngo-browse.jpg', 'Artūras Kokorevas', 'https://www.pexels.com/photo/volunteers-collecting-donations-for-people-in-need-11319521/', 'Community volunteers collect and organize clothing donations outdoors.', '50% 54%'), eyebrow: 'Available donations', title: 'Find clothing your team can put to use', description: 'Browse open listings and choose donations your organization can collect.' },
    claims: { photo: photo('workspace-ngo-claims.jpg', 'Gustavo Fring', 'https://www.pexels.com/photo/handing-out-of-box-of-donations-7156193/', 'Volunteers pass donation boxes to one another.', '50% 54%'), eyebrow: 'Your claims', title: 'Keep each pickup and handoff on track', description: 'Manage claimed donations and update pickup and distribution progress.' },
    account: { photo: photo('workspace-ngo-account.jpg', 'Julia M. Cameron', 'https://www.pexels.com/photo/a-group-of-volunteers-sorting-clothes-into-containers-posing-together-6995106/', 'Volunteers share a moment while sorting donated clothing.', '50% 58%'), eyebrow: 'Organization profile', title: 'Your organization details, all together', description: 'Review the account and verification information for your NGO.' },
  },
  Admin: {
    home: { photo: photo('workspace-admin-home.jpg', 'Liza Summer', 'https://www.pexels.com/photo/smiling-ethnic-woman-showing-volunteer-sign-on-red-apron-6348129/', 'A smiling volunteer wears a volunteer badge.', '50% 62%'), eyebrow: 'Admin workspace', title: 'Help keep community giving organized', description: 'Review listings, verify NGOs, and manage claims from one workspace.' },
    dashboard: { photo: photo('workspace-admin-dashboard.jpg', 'cottonbro studio', 'https://www.pexels.com/photo/two-volunteers-packing-the-charity-goods-6590929/', 'Two volunteers pack donated items into boxes.', '50% 53%'), eyebrow: 'Platform overview', title: 'A clearer view of the donation network', description: 'Review donations, delivery progress, and NGO activity below.' },
    moderation: { photo: photo('workspace-admin-moderation.jpg', 'cottonbro studio', 'https://www.pexels.com/photo/person-holding-a-brown-box-with-clothing-6591155/', 'Hands place folded clothing into a cardboard donation box.', '50% 63%'), eyebrow: 'Listing moderation', title: 'Review listings with care and consistency', description: 'Keep clothing listings clear and ready for verified NGOs to browse.' },
    verification: { photo: photo('workspace-admin-verification.jpg', 'Julia M. Cameron', 'https://www.pexels.com/photo/a-woman-holding-a-cardboard-with-inscription-6994984/', 'A volunteer holds a sign at a community donation center.', '50% 63%'), eyebrow: 'NGO verification', title: 'Support trusted community partners', description: 'Review organization records and current verification details.' },
    'stale-claims': { photo: photo('workspace-admin-stale-claims.jpg', 'Julia M. Cameron', 'https://www.pexels.com/photo/clothes-in-a-plastic-box-for-donation-6995179/', 'A clear box contains clothing set aside for donation.', '50% 52%'), eyebrow: 'Claims follow-up', title: 'Give paused claims a clear next step', description: 'Review claims that have expired before pickup and need attention.' },
    account: { photo: photo('workspace-admin-account.jpg', 'Liza Summer', 'https://www.pexels.com/photo/cheerful-volunteer-woman-in-red-uniform-6347743/', 'A volunteer smiles while wearing a red volunteer shirt.', '50% 61%'), eyebrow: 'Your profile', title: 'Your admin account in one place', description: 'Review the account details associated with your administrator access.' },
  },
}

function WorkspacePhotoBanner({ role, active }) {
  const visual = workspaceVisuals[role]?.[active]
  if (!visual) return null

  const { photo: image } = visual

  return <section className={`workspace-photo-banner workspace-photo-banner-${role.toLowerCase()}`} aria-label={`${role} workspace introduction`}>
    <div className="workspace-photo-copy">
      <p className="workspace-photo-eyebrow">{visual.eyebrow}</p>
      <h2>{visual.title}</h2>
      <p>{visual.description}</p>
    </div>
    <figure className="workspace-photo-frame" style={{ '--workspace-photo-focus': image.focus }}>
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        onError={(event) => {
          event.currentTarget.hidden = true
          event.currentTarget.parentElement.classList.add('photo-fallback')
        }}
      />
      <figcaption><a href={image.photoPage} target="_blank" rel="noreferrer">Illustrative photo · {image.photographer} / Pexels</a></figcaption>
    </figure>
  </section>
}

function RoleWorkspace({ role, user, logout, active, sections, children }) {
  const current = sections.find((section) => section.key === active)
  const title = current?.title || `${role} workspace`

  return <div className="role-workspace">
    <header className="workspace-heading">
      <div>
        <p className="workspace-eyebrow">{role} workspace</p>
        <h1>{active === 'home' ? `Welcome${user.name ? `, ${user.name}` : ''}` : title}</h1>
        <p>Signed in as {user.email}</p>
      </div>
      {active !== 'home' && <Link className="workspace-home-link" to={`/${role.toLowerCase()}`}>All sections <ArrowRight size={16} /></Link>}
    </header>

    <nav className={`workspace-sections ${active === 'home' ? 'workspace-sections-home' : ''}`} aria-label={`${role} sections`}>
      {sections.map(({ key, title: sectionTitle, description, icon: Icon, to }) => (
        <Link key={key} to={to} className={`workspace-section-card ${active === key ? 'is-active' : ''}`} aria-current={active === key ? 'page' : undefined}>
          <span className="workspace-section-icon"><Icon size={21} strokeWidth={1.8} /></span>
          <span className="workspace-section-copy"><strong>{sectionTitle}</strong><small>{description}</small></span>
          <ArrowRight className="workspace-section-arrow" size={17} aria-hidden="true" />
        </Link>
      ))}
    </nav>

    <WorkspacePhotoBanner role={role} active={active} />
    {active !== 'home' && <section className="workspace-content">{children}</section>}

    <div className="workspace-footer"><Link to={`/${role.toLowerCase()}/account`}>My account</Link><button type="button" onClick={logout}>Log out</button></div>
  </div>
}

export default RoleWorkspace
