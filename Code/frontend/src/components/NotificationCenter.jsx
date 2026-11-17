import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../api/client.js'

// Poll interval — same convention as MyListingsPage's status polling (task
// 9.6). Without this, a notification created while the bell's owner already
// had the page open (e.g. a donor cancels a claim while the NGO is sitting on
// their own page) never appeared until a manual reload, since the original
// version only fetched once on mount.
const POLL_INTERVAL_MS = 5000
const PAGE_SIZE = 10

// Bell icon + list + mark-as-read (task 9.10). GET /notifications (LLD §3.5)
// works for any authenticated role, so this lives in the shared nav rather
// than under a donor-only page.
function NotificationCenter() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [error, setError] = useState(null)

  // The 5s poll and markRead() both write to `notifications` independently.
  // Without this, a poll already in flight when the user clicks to mark
  // something read can resolve *after* markRead's own response and overwrite
  // it with the pre-click (still-unread) snapshot it fetched earlier, making
  // the unread count revert right after it just dropped. Only the response
  // to whichever request was issued *last* is allowed to apply.
  const latestRequestId = useRef(0)

  const refetch = useCallback(() => {
    const requestId = ++latestRequestId.current
    return apiFetch('/notifications')
      .then((data) => {
        if (requestId === latestRequestId.current) setNotifications(data)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    refetch()
    const intervalId = setInterval(refetch, POLL_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [user, refetch])

  if (!user) return null

  const unreadCount = notifications.filter((n) => !n.read).length
  const recentNotifications = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  async function markRead(id) {
    const requestId = ++latestRequestId.current
    try {
      const updated = await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
      if (requestId === latestRequestId.current) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  // Mark only the notifications actually revealed in the panel as read.
  // There is no bulk endpoint, so this fires one request per item.
  async function markNotificationsRead(visibleNotifications) {
    const unread = visibleNotifications.filter((n) => !n.read)
    if (unread.length === 0) return

    const requestId = ++latestRequestId.current
    try {
      const updated = await Promise.all(
        unread.map((n) => apiFetch(`/notifications/${n.id}/read`, { method: 'POST' })),
      )
      if (requestId === latestRequestId.current) {
        const updatedById = new Map(updated.map((n) => [n.id, n]))
        setNotifications((prev) => prev.map((n) => updatedById.get(n.id) || n))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleOpen() {
    const next = !open
    if (next) {
      setVisibleCount(PAGE_SIZE)
      markNotificationsRead(recentNotifications.slice(0, PAGE_SIZE))
    }
    setOpen(next)
  }

  function showMore() {
    const nextCount = Math.min(visibleCount + PAGE_SIZE, recentNotifications.length)
    markNotificationsRead(recentNotifications.slice(visibleCount, nextCount))
    setVisibleCount(nextCount)
  }

  return (
    <div data-testid="notification-center">
      <button type="button" data-testid="notification-bell" onClick={toggleOpen}>
        🔔{unreadCount > 0 && <span data-testid="notification-unread-count">{unreadCount}</span>}
      </button>
      {open && (
        <div data-testid="notification-list">
          {error && <p data-testid="notification-error">{error}</p>}
          {recentNotifications.length === 0 && <p>No notifications yet.</p>}
          {recentNotifications.slice(0, visibleCount).map((n) => (
            <div
              key={n.id}
              data-testid="notification-item"
              data-read={n.read}
              onClick={() => !n.read && markRead(n.id)}
            >
              {n.message}
            </div>
          ))}
          {recentNotifications.length > 0 && (
            <p data-testid="notification-list-count" className="notification-list-count" aria-live="polite">
              Showing the {Math.min(visibleCount, recentNotifications.length)} most recent notifications
              {recentNotifications.length > visibleCount && ` (of ${recentNotifications.length})`}
            </p>
          )}
          {visibleCount < recentNotifications.length && (
            <button
              type="button"
              data-testid="notification-view-more"
              className="notification-view-more"
              onClick={showMore}
            >
              View more notifications
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationCenter
