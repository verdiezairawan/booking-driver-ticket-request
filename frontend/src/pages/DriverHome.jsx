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
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [processing, setProcessing] = useState({})

  const [startModalOpen, setStartModalOpen] = useState(false)
  const [finishModalOpen, setFinishModalOpen] = useState(false)
  const [activeBooking, setActiveBooking] = useState(null)
  const [startingMileage, setStartingMileage] = useState('')
  const [endingMileage, setEndingMileage] = useState('')
  const [completionProof, setCompletionProof] = useState('')

  const completedDistance = useMemo(() => {
    const startingValue = Number(activeBooking?.starting_mileage)
    const endingValue = Number(endingMileage)
    if (!Number.isFinite(startingValue) || !Number.isFinite(endingValue)) return ''
    if (endingValue < startingValue) return ''
    return String(endingValue - startingValue)
  }, [activeBooking?.starting_mileage, endingMileage])

  const distanceInvalid = useMemo(() => {
    if (!endingMileage) return false
    const startingValue = Number(activeBooking?.starting_mileage)
    const endingValue = Number(endingMileage)
    if (!Number.isFinite(startingValue) || !Number.isFinite(endingValue)) return false
    return endingValue < startingValue
  }, [activeBooking?.starting_mileage, endingMileage])

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

  const updateBookingInState = (bookingId, updatedFields) => {
    setBookings((prev) =>
      prev.map((booking) => {
        if (booking.id !== bookingId) return booking
        return { ...booking, ...updatedFields }
      })
    )
  }

  const openStartModal = (booking) => {
    setActiveBooking(booking)
    setStartingMileage('')
    setStartModalOpen(true)
    setActionMessage('')
    setActionError('')
  }

  const openFinishModal = (booking) => {
    setActiveBooking(booking)
    setEndingMileage('')
    setCompletionProof('')
    setFinishModalOpen(true)
    setActionMessage('')
    setActionError('')
  }

  const closeModals = () => {
    setStartModalOpen(false)
    setFinishModalOpen(false)
    setActiveBooking(null)
    setStartingMileage('')
    setEndingMileage('')
    setCompletionProof('')
  }

  const handleStart = async () => {
    if (!activeBooking?.id) return

    const mileageValue = Number(startingMileage)
    if (!Number.isFinite(mileageValue) || mileageValue < 0) {
      setActionError('Starting mileage must be a valid number.')
      return
    }

    const token = localStorage.getItem('authToken')
    if (!token) {
      setActionError('Authentication token not found.')
      return
    }

    setProcessing((prev) => ({ ...prev, [activeBooking.id]: true }))
    setActionMessage('')
    setActionError('')

    try {
      const res = await fetch(`http://localhost:8000/bookings/${activeBooking.id}/start`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ starting_mileage: mileageValue }),
      })

      if (!res.ok) {
        let detail = 'Failed to start booking.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setActionError(detail)
        return
      }

      const updated = await res.json()
      updateBookingInState(activeBooking.id, updated)
      setActionMessage('Trip started.')
      closeModals()
    } catch (err) {
      setActionError('Network error. Please try again.')
    } finally {
      setProcessing((prev) => {
        const next = { ...prev }
        delete next[activeBooking.id]
        return next
      })
    }
  }

  const handleFinish = async () => {
    if (!activeBooking?.id) return

    const endingValue = Number(endingMileage)
    if (!Number.isFinite(endingValue) || endingValue < 0) {
      setActionError('Ending mileage must be a valid number.')
      return
    }

    if (!completionProof.trim()) {
      setActionError('Completion proof is required.')
      return
    }

    const token = localStorage.getItem('authToken')
    if (!token) {
      setActionError('Authentication token not found.')
      return
    }

    setProcessing((prev) => ({ ...prev, [activeBooking.id]: true }))
    setActionMessage('')
    setActionError('')

    try {
      const res = await fetch(`http://localhost:8000/bookings/${activeBooking.id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ending_mileage: endingValue,
          completion_proof: completionProof.trim(),
        }),
      })

      if (!res.ok) {
        let detail = 'Failed to complete booking.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setActionError(detail)
        return
      }

      const updated = await res.json()
      updateBookingInState(activeBooking.id, updated)
      setActionMessage('Trip completed.')
      closeModals()
    } catch (err) {
      setActionError('Network error. Please try again.')
    } finally {
      setProcessing((prev) => {
        const next = { ...prev }
        delete next[activeBooking.id]
        return next
      })
    }
  }

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
        {!loading && !error && actionMessage ? <p className="success-text">{actionMessage}</p> : null}
        {!loading && !error && actionError ? <p className="error-text">{actionError}</p> : null}

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
              const isCompleted = booking.status === 'completed'
              const isStarted = booking.starting_mileage !== null && booking.starting_mileage !== undefined
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
                    {!isCompleted ? (
                      <button
                        type="button"
                        className="btn btn-neutral"
                        disabled={processing[booking.id]}
                        onClick={() => {
                          if (isStarted) {
                            openFinishModal(booking)
                          } else {
                            openStartModal(booking)
                          }
                        }}
                      >
                        {isStarted ? 'Selesai' : 'Start'}
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}

        {startModalOpen ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeModals}>
            <div
              className="modal"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <div className="modal-header">
                <h2>Start Trip</h2>
                <button type="button" className="modal-close" onClick={closeModals} aria-label="Close">
                  &times;
                </button>
              </div>

              {actionError ? <p className="error-text">{actionError}</p> : null}

              <div className="field-grid">
                <label className="inline-label">
                  <span>Starting mileage</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Starting mileage"
                    value={startingMileage}
                    onChange={(e) => setStartingMileage(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={processing[activeBooking?.id]}
                >
                  Save & Start
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={closeModals} disabled={processing[activeBooking?.id]}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {finishModalOpen ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeModals}>
            <div
              className="modal"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <div className="modal-header">
                <h2>Completion Report</h2>
                <button type="button" className="modal-close" onClick={closeModals} aria-label="Close">
                  &times;
                </button>
              </div>

              {actionError ? <p className="error-text">{actionError}</p> : null}

              <div className="field-grid">
                <label className="inline-label">
                  <span>Starting mileage</span>
                  <input type="number" value={activeBooking?.starting_mileage ?? ''} disabled readOnly />
                </label>
                <label className="inline-label">
                  <span>Ending mileage</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ending mileage"
                    value={endingMileage}
                    onChange={(e) => setEndingMileage(e.target.value)}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>Total distance (auto)</span>
                  <input type="number" placeholder="Auto calculated" value={completedDistance} disabled readOnly />
                </label>
                {distanceInvalid ? (
                  <p className="error-text" style={{ gridColumn: '1 / -1' }}>
                    Ending mileage must be greater than or equal to starting mileage.
                  </p>
                ) : null}
                <label className="inline-label">
                  <span>Proof of completion (text)</span>
                  <input
                    type="text"
                    placeholder="Proof (photo link / description)"
                    value={completionProof}
                    onChange={(e) => setCompletionProof(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFinish}
                  disabled={processing[activeBooking?.id]}
                >
                  Save
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={closeModals} disabled={processing[activeBooking?.id]}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  )
}

export default DriverHome
