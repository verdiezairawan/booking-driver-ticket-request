import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

const menuItems = [
  'Dashboard',
  'Ticket Requests',
  'Driver Requests',
  'Ticket History',
  'Driver History',
  'Travel Accommodation',
  'Assign Drivers',
  'Manage User',
  'Report',
]

function OfficeDriverRequests() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: '' })
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [processing, setProcessing] = useState({})
  const [drivers, setDrivers] = useState([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [driversError, setDriversError] = useState('')
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState(null)
  const [selectedDriverId, setSelectedDriverId] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) return
    const loadProfile = async () => {
      try {
        const res = await fetch('http://localhost:8000/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setProfile({ name: data.name || data.email || 'User' })
        }
      } catch (err) {
        console.error('Failed to load profile', err)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) return

    const loadDrivers = async () => {
      setDriversLoading(true)
      setDriversError('')

      try {
        const res = await fetch('http://localhost:8000/users', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          let detail = 'Failed to load drivers.'
          try {
            const data = await res.json()
            if (data?.detail) detail = data.detail
          } catch {
            // ignore parse error
          }
          setDriversError(detail)
          setDrivers([])
          return
        }

        const data = await res.json()
        const allUsers = Array.isArray(data) ? data : []
        setDrivers(allUsers.filter((user) => user.role === 'driver'))
      } catch (err) {
        setDriversError('Network error. Please try again.')
        setDrivers([])
      } finally {
        setDriversLoading(false)
      }
    }

    loadDrivers()
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setLoading(false)
      setError('Authentication token not found.')
      return
    }

    const loadBookings = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('http://localhost:8000/bookings/pending', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          let detail = 'Failed to load bookings.'
          try {
            const data = await res.json()
            if (data?.detail) detail = data.detail
          } catch (err) {
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

    loadBookings()
  }, [])

  const openAssignModal = (booking) => {
    setAssignTarget(booking)
    setSelectedDriverId('')
    setAssignModalOpen(true)
    setActionMessage('')
    setActionError('')
  }

  const closeAssignModal = () => {
    setAssignModalOpen(false)
    setAssignTarget(null)
    setSelectedDriverId('')
  }

  const handleAssign = async () => {
    if (!assignTarget?.id) return
    if (!selectedDriverId) {
      setActionError('Please select a driver.')
      return
    }

    const token = localStorage.getItem('authToken')
    if (!token) {
      setActionError('Authentication token not found.')
      return
    }

    setProcessing((prev) => ({ ...prev, [assignTarget.id]: true }))
    setActionMessage('')
    setActionError('')

    try {
      const res = await fetch(`http://localhost:8000/bookings/${assignTarget.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'approved', driver_id: selectedDriverId }),
      })

      if (!res.ok) {
        let detail = 'Failed to assign driver.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setActionError(detail)
        return
      }

      setBookings((prev) => prev.filter((booking) => booking.id !== assignTarget.id))
      setActionMessage('Driver assigned. Moved to driver history and will appear in driver tasks.')
      closeAssignModal()
    } catch (err) {
      setActionError('Network error. Please try again.')
    } finally {
      setProcessing((prev) => {
        const next = { ...prev }
        delete next[assignTarget.id]
        return next
      })
    }
  }

  const handleReject = async (bookingId) => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setActionError('Authentication token not found.')
      return
    }

    setProcessing((prev) => ({ ...prev, [bookingId]: true }))
    setActionMessage('')
    setActionError('')

    try {
      const res = await fetch(`http://localhost:8000/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'rejected' }),
      })

      if (!res.ok) {
        let detail = 'Failed to reject booking.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setActionError(detail)
        return
      }

      setBookings((prev) => prev.filter((booking) => booking.id !== bookingId))
      setActionMessage('Booking rejected. Moved to driver history.')
    } catch (err) {
      setActionError('Network error. Please try again.')
    } finally {
      setProcessing((prev) => {
        const next = { ...prev }
        delete next[bookingId]
        return next
      })
    }
  }

  const formatDate = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('id-ID')
  }

  const handleNavigate = (item) => {
    if (item === 'Dashboard') navigate('/office/home')
    if (item === 'Ticket Requests') navigate('/office/ticket-requests')
    if (item === 'Driver Requests') navigate('/office/driver-requests')
    if (item === 'Ticket History') navigate('/office/ticket-history')
    if (item === 'Driver History') navigate('/office/driver-history')
    if (item === 'Travel Accommodation') navigate('/office/travel-accommodation')
    if (item === 'Assign Drivers') navigate('/office/assign-drivers')
    if (item === 'Manage User') navigate('/office/manage-user')
  }

  return (
    <MainLayout title="">
      <div className="office-dashboard fixed-sidebar">
        <aside className="office-sidebar visible">
          <div className="sidebar-header">
            <span className="sidebar-role">Office Coordinator</span>
          </div>
          <nav className="sidebar-menu">
            {menuItems.map((item) => (
              <button
                key={item}
                type="button"
                className={`sidebar-item ${item === 'Driver Requests' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="office-content">
          <header className="office-header">
            <p className="eyebrow">Driver Requests</p>
            <h1>List of all driver bookings</h1>
            <p className="muted">Manage assignments and driver procurement</p>
          </header>

          {actionMessage ? <p className="success-text">{actionMessage}</p> : null}
          {actionError ? <p className="error-text">{actionError}</p> : null}

          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Pickup Location</th>
                  <th>Destination</th>
                  <th>Passenger Count</th>
                  <th>Departure Date</th>
                  <th>Type of Trip</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="muted">
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="9" className="error-text">
                      {error}
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="muted">
                      No driver requests found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.requester_name || '-'}</td>
                      <td>{booking.requester_phone || '-'}</td>
                      <td>{booking.requester_email || '-'}</td>
                      <td>{booking.pickup_location || '-'}</td>
                      <td>{booking.destination || '-'}</td>
                      <td>{booking.passenger_count ?? '-'}</td>
                      <td>{formatDate(booking.departure_time)}</td>
                      <td>{booking.trip_type || '-'}</td>
                      <td>
                        <div className="office-row-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={processing[booking.id]}
                            onClick={() => openAssignModal(booking)}
                          >
                            Assign Driver
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={processing[booking.id]}
                            onClick={() => handleReject(booking.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="office-pagination">
            <button type="button" className="btn btn-neutral" disabled>
              Prev
            </button>
            <span className="office-page-info">Page 1 of 1</span>
            <button type="button" className="btn btn-neutral" disabled>
              Next
            </button>
          </div>

          {assignModalOpen ? (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              onClick={() => {
                if (!processing[assignTarget?.id]) closeAssignModal()
              }}
            >
              <div
                className="modal"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                <div className="modal-header">
                  <h2>Assign Driver</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={closeAssignModal}
                    disabled={processing[assignTarget?.id]}
                    aria-label="Close"
                  >
                    &times;
                  </button>
                </div>

                <p className="muted" style={{ marginTop: 0 }}>
                  Select a driver for this request. After assigning, the request will move to driver history.
                </p>

                {driversError ? <p className="error-text">{driversError}</p> : null}

                <label className="inline-label">
                  <span>Driver</span>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    disabled={driversLoading || processing[assignTarget?.id]}
                    required
                  >
                    <option value="" disabled>
                      {driversLoading ? 'Loading drivers...' : 'Select driver...'}
                    </option>
                    {drivers.map((driver) => (
                      <option key={driver.uid} value={driver.uid}>
                        {driver.name ? `${driver.name} (${driver.email})` : driver.email}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAssign}
                    disabled={driversLoading || !drivers.length || processing[assignTarget?.id]}
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={closeAssignModal}
                    disabled={processing[assignTarget?.id]}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeDriverRequests
