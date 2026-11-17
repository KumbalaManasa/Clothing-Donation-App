const STEPS = [
  { status: 'listed', label: 'Listed' },
  { status: 'claimed', label: 'Claimed' },
  { status: 'picked_up', label: 'Picked up' },
  { status: 'distributed', label: 'Distributed' },
  { status: 'delivered', label: 'Delivered' },
]

function DonationProgress({ status }) {
  const currentIndex = STEPS.findIndex((step) => step.status === status)
  if (currentIndex < 0) return null

  return (
    <div className="progress-track" role="img" aria-label={`Donation progress: ${STEPS[currentIndex].label}`}>
      {STEPS.map((step, index) => (
        <span key={step.status} className={`progress-step ${index <= currentIndex ? 'done' : ''}`}>
          {step.label}
        </span>
      ))}
    </div>
  )
}

export default DonationProgress
