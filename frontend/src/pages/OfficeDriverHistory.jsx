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

function OfficeDriverHistory() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        const res = await fetch('http://localhost:8000/bookings/history', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          let detail = 'Failed to load driver history.'
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

    loadBookings()
  }, [])

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

  const formatDate = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('id-ID')
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
                className={`sidebar-item ${item === 'Driver History' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="office-content">
          <header className="office-header">
            <p className="eyebrow">Driver History</p>
            <h1>Driver History</h1>
            <p className="muted">All processed driver requests (non-pending)</p>
          </header>

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
                  <th>Driver</th>
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
                      No driver history found.
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
                      <td>{booking.driver_name || booking.driver_id || '-'}</td>
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
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeDriverHistory
