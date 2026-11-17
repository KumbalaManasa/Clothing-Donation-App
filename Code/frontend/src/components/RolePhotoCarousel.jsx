import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

function RolePhotoCarousel({ role, slides }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!preference) return undefined
    const updatePreference = () => setReducedMotion(preference.matches)
    updatePreference()
    preference.addEventListener?.('change', updatePreference)
    return () => preference.removeEventListener?.('change', updatePreference)
  }, [])

  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2) return undefined
    const intervalId = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, 6500)
    return () => clearInterval(intervalId)
  }, [paused, reducedMotion, slides.length])

  return (
    <aside className="role-photo-panel" aria-label={`${role} community photography`}>
      <div className="role-photo-viewport">
        <div className="role-photo-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {slides.map((slide, index) => (
            <figure className="role-photo-slide" key={slide.src ?? slide.pair.map((photo) => photo.src).join('|')}>
              {slide.pair ? (
                <div className="role-photo-pair">
                  {slide.pair.map((photo) => (
                    <div className="role-photo-pair-panel" key={photo.src}>
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        loading={index === activeIndex ? 'eager' : 'lazy'}
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.hidden = true
                          event.currentTarget.closest('.role-photo-slide').classList.add('photo-fallback')
                        }}
                      />
                      <span className="role-photo-pair-arrow" aria-hidden="true"><ArrowRight size={19} strokeWidth={2.5} /></span>
                    </div>
                  ))}
                </div>
              ) : (
                <img
                  src={slide.src}
                  alt={slide.alt}
                  loading={index === activeIndex ? 'eager' : 'lazy'}
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.hidden = true
                    event.currentTarget.closest('.role-photo-slide').classList.add('photo-fallback')
                  }}
                />
              )}
              <figcaption className="role-photo-caption">
                <span>{role}</span>
                <strong>{slide.caption}</strong>
                {slide.pair ? (
                  <span className="role-photo-credits">
                    {slide.pair.map((photo) => (
                      <a key={photo.src} href={photo.photoPage} target="_blank" rel="noreferrer">
                        Photo by {photo.photographer} · Pexels
                      </a>
                    ))}
                  </span>
                ) : (
                  <a href={slide.photoPage} target="_blank" rel="noreferrer">
                    Photo by {slide.photographer} · Pexels
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="role-photo-controls">
        <span className="role-photo-note">Illustrative stock photos · People shown are not app users, recipients, or endorsers</span>
        <div className="role-photo-actions" role="group" aria-label="Photo carousel controls">
          {slides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              className={`role-photo-dot ${activeIndex === index ? 'active' : ''}`}
              aria-label={`Show photo ${index + 1}: ${slide.caption}`}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            />
          ))}
          <button
            type="button"
            className="role-photo-pause"
            aria-label={paused ? 'Resume photo rotation' : 'Pause photo rotation'}
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? 'Play' : 'Pause'}
          </button>
        </div>
      </div>
    </aside>
  )
}

export default RolePhotoCarousel
