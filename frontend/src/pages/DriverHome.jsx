import { useEffect, useMemo, useState } from 'react'
import MainLayout from '../components/MainLayout'

const TABS = {
  active: 'active',
  completed: 'completed',
}

function DriverHome() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(TABS.active)

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setLoading(false)
      setError('Authentication token not found.')
      return
    }

    const loadAssigned = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('http://localhost:8000/bookings/assigned', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          let detail = 'Failed to load assignments.'
          try {
            const data = await res.json()
            if (data?.detail) detail = data.detail
          } catch {
            // ignore parse error
          }
          setError(detail)
          setBookings([])
        } else {
          const data = await res.json()
          setBookings(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        setError('Network error. Please try again.')
        setBookings([])
      } finally {
        setLoading(false)
      }
    }

    loadAssigned()
  }, [])

  const counts = useMemo(() => {
    const activeCount = bookings.filter((b) => (b.status || 'pending') !== 'completed').length
    const completedCount = bookings.filter((b) => (b.status || 'pending') === 'completed').length
    return { active: activeCount, completed: completedCount }
  }, [bookings])

  const items = useMemo(() => {
    const normalized = bookings.map((b) => ({ ...b, status: b.status || 'pending' }))
    const filtered =
      tab === TABS.completed
        ? normalized.filter((b) => b.status === 'completed')
        : normalized.filter((b) => b.status !== 'completed')

    const safeTime = (value) => {
      const dt = new Date(value)
      return Number.isNaN(dt.getTime()) ? null : dt
    }

    const sorted = [...filtered].sort((a, b) => {
      const aTime = safeTime(a.departure_time)
      const bTime = safeTime(b.departure_time)
      if (!aTime && !bTime) return 0
      if (!aTime) return 1
      if (!bTime) return -1
      return tab === TABS.completed ? bTime - aTime : aTime - bTime
    })

    return sorted
  }, [bookings, tab])

  const formatDeparture = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '-'
    const datePart = dt.toLocaleDateString('id-ID')
    const timePart = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} ${timePart}`
  }

  const formatTripType = (value) => {
    if (!value) return '-'
    if (value === 'antar') return 'Drop-off'
    if (value === 'jemput') return 'Pick-up'
    if (value === 'fulltrip') return 'Full Trip'
    return value
  }

  return (
    <MainLayout title="">
      <div className="driver-page">
        <header className="driver-header">
          <div>
            <p className="eyebrow">Driver</p>
            <h1>My Tasks</h1>
            <p className="muted">View and manage your assigned bookings</p>
          </div>

          <div className="driver-tabs">
            <button
              type="button"
              className={`driver-tab ${tab === TABS.active ? 'active' : ''}`}
              onClick={() => setTab(TABS.active)}
            >
              Active ({counts.active})
            </button>
            <button
              type="button"
              className={`driver-tab ${tab === TABS.completed ? 'active' : ''}`}
              onClick={() => setTab(TABS.completed)}
            >
              Completed ({counts.completed})
            </button>
          </div>
        </header>

        {loading ? <p className="muted">Loading assignments...</p> : null}
        {!loading && error ? <p className="error-text">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <div className="driver-empty">
            <h2>No assignments yet</h2>
            <p className="muted">When the office assigns you a booking, it will appear here.</p>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="driver-list">
            {items.map((booking) => {
              const phone = booking.requester_phone || ''
              const email = booking.requester_email || ''
              return (
                <article key={booking.id} className="driver-card">
                  <div className="driver-card__top">
                    <div className="driver-card__title">
                      <h2 className="driver-route">
                        {booking.pickup_location || '-'} → {booking.destination || '-'}
                      </h2>
                      <div className="driver-subrow">
                        <span className={`status-badge status-${booking.status}`}>{booking.status}</span>
                        <span className="muted">Departure: {formatDeparture(booking.departure_time)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="driver-meta">
                    <div className="driver-meta__item">
                      <span className="driver-meta__label">Passengers</span>
                      <span className="driver-meta__value">{booking.passenger_count ?? '-'}</span>
                    </div>
                    <div className="driver-meta__item">
                      <span className="driver-meta__label">Trip Type</span>
                      <span className="driver-meta__value">{formatTripType(booking.trip_type)}</span>
                    </div>
                    <div className="driver-meta__item">
                      <span className="driver-meta__label">Requester</span>
                      <span className="driver-meta__value">{booking.requester_name || '-'}</span>
                    </div>
                    <div className="driver-meta__item">
                      <span className="driver-meta__label">Phone</span>
                      <span className="driver-meta__value">{phone || '-'}</span>
                    </div>
                    <div className="driver-meta__item">
                      <span className="driver-meta__label">Email</span>
                      <span className="driver-meta__value">{email || '-'}</span>
                    </div>
                  </div>

                  <div className="driver-actions">
                    <a className={`btn btn-neutral ${phone ? '' : 'btn-disabled'}`} href={phone ? `tel:${phone}` : '#'}>
                      Call
                    </a>
                    <a
                      className={`btn btn-neutral ${email ? '' : 'btn-disabled'}`}
                      href={email ? `mailto:${email}` : '#'}
                    >
                      Email
                    </a>
                    <button type="button" className="btn btn-neutral" disabled>
                      Mark Completed
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </MainLayout>
  )
}

export default DriverHome
