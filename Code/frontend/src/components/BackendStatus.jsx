import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client.js'

function BackendStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false

    apiFetch('/health')
      .then(() => {
        if (!cancelled) setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'checking') return <p>backend: checking...</p>
  if (status === 'ok') return <p>backend: ok</p>
  return <p>backend: error</p>
}

export default BackendStatus
