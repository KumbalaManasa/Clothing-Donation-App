import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck, HandHeart, PackagePlus } from 'lucide-react'

function HomePage() {
  return (
    <>
      <section className="home-hero home-hero--fundraise" aria-labelledby="home-title">
        <figure className="home-hero-photo">
          <img
            src="/images/home-clothing-handoff.jpg"
            alt="A smiling woman shares folded clothes with a child as others gather around them."
            fetchPriority="high"
            decoding="async"
            onError={(event) => {
              event.currentTarget.hidden = true
              event.currentTarget.parentElement.classList.add('photo-fallback')
            }}
          />
          <figcaption>
            <span>Shared with care, received with joy</span>
          </figcaption>
        </figure>
        <div className="home-copy">
          <p className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />WearForward</p>
          <h1 id="home-title">Good clothes. <em>New beginnings.</em></h1>
          <p>Pass along clean, wearable clothing. Donors arrange a pickup, and verified NGOs help each donation make its way through collection and distribution.</p>
          <div className="home-actions">
            <Link to="/donor"><span>Donate clothing</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
            <Link className="secondary" to="/ngo"><span>For NGOs</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <p className="home-hero-note">Give clothes a future.</p>
        </div>
      </section>

      <section className="home-process" aria-labelledby="process-title">
        <div className="home-section-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="process-title">Good clothes, thoughtfully passed along</h2>
        </div>
        <div className="home-steps">
          <article className="step-card">
            <div className="step-illustration">
              <img src="/images/steps/step-donate.svg" alt="" aria-hidden="true" loading="lazy" />
              <span className="step-icon"><PackagePlus size={19} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="step-number" aria-hidden="true">01</span>
            </div>
            <div className="step-copy"><span className="step-audience">For donors</span><strong>List clean, wearable clothes</strong><p>Add a few item details, show the pieces with your own photos, and enter a pickup location.</p></div>
          </article>
          <article className="step-card">
            <div className="step-illustration">
              <img src="/images/steps/step-connect.svg" alt="" aria-hidden="true" loading="lazy" />
              <span className="step-icon"><BadgeCheck size={19} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="step-number" aria-hidden="true">02</span>
            </div>
            <div className="step-copy"><span className="step-audience">For verified NGOs</span><strong>Find a suitable donation</strong><p>Browse available listings and claim clothing your organization can collect and distribute.</p></div>
          </article>
          <article className="step-card">
            <div className="step-illustration">
              <img src="/images/steps/step-handoff.svg" alt="" aria-hidden="true" loading="lazy" />
              <span className="step-icon"><HandHeart size={19} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="step-number" aria-hidden="true">03</span>
            </div>
            <div className="step-copy"><span className="step-audience">Pickup to handoff</span><strong>Follow each step along the way</strong><p>Keep track as a donation moves from claimed, to picked up, to distributed.</p></div>
          </article>
        </div>
      </section>

      <section className="community-stories" aria-label="Community clothing donation moments">
        <article className="community-story">
          <div className="story-image">
            <img
              src="/images/ngo-preparation.jpg"
              alt="Volunteers sort donated clothes together at a community center."
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.hidden = true
                event.currentTarget.nextElementSibling.hidden = false
              }}
            />
            <span className="photo-fallback-label" hidden>Community photo unavailable</span>
          </div>
          <div className="community-story-copy">
            <p className="eyebrow">Care in every step</p>
            <h3>Prepared with care</h3>
            <p>Volunteers sort wearable clothing together so donations are ready to share.</p>
            <a className="photo-credit" href="https://www.pexels.com/photo/people-having-fun-while-packing-clothes-6995093/" target="_blank" rel="noreferrer">Photo by Julia M. Cameron Â· Pexels</a>
          </div>
        </article>
        <article className="community-story">
          <div className="story-image">
            <img
              src="/images/donation-volunteers.jpg"
              alt="Two volunteers organize donated clothes together at a community center."
              loading="lazy"
              decoding="async"
              onError={(event) => {
                event.currentTarget.hidden = true
                event.currentTarget.nextElementSibling.hidden = false
              }}
            />
            <span className="photo-fallback-label" hidden>Community photo unavailable</span>
          </div>
          <div className="community-story-copy">
            <p className="eyebrow">Shared with dignity</p>
            <h3>Shared with respect</h3>
            <p>Warm handoffs help clothing reach people in a welcoming community setting.</p>
            <a className="photo-credit" href="https://www.pexels.com/photo/woman-holding-clothes-for-donations-6591152/" target="_blank" rel="noreferrer">Photo by cottonbro studio Â· Pexels</a>
          </div>
        </article>
      </section>
      <p className="photo-disclaimer">Pexels stock photos are illustrative; pictured people are not app users or actual recipients and do not endorse the app.</p>
    </>
  )
}

export default HomePage
