// Listing status badge — the six values are the full state machine (LLD §2):
// listed -> claimed -> picked_up -> distributed -> delivered, or cancelled
// from listed/claimed. Colors are just visual grouping (open/in-progress/
// terminal), not part of the spec.
const STATUS_META = {
  listed: { label: 'Listed', style: 'status-listed' },
  claimed: { label: 'Claimed', style: 'status-progress' },
  picked_up: { label: 'Picked Up', style: 'status-progress' },
  distributed: { label: 'Distributed', style: 'status-progress' },
  delivered: { label: 'Delivered', style: 'status-delivered' },
  cancelled: { label: 'Cancelled', style: 'status-cancelled' },
  failed: { label: 'Failed', style: 'status-cancelled' },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, style: 'status-progress' }

  return (
    <span
      data-testid="listing-status"
      data-status={status}
      className={`status-badge ${meta.style}`}
    >
      {meta.label}
    </span>
  )
}

export default StatusBadge
