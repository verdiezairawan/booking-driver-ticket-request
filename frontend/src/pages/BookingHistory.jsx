import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function BookingHistory() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true)
      setError('')

      const token = localStorage.getItem('authToken')
      if (!token) {
        setError('Authentication token not found. Please login again.')
        setLoading(false)
        return
      }

      try {
        const response = await fetch('http://localhost:8000/bookings/my', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          let detail = 'Failed to load bookings.'
          try {
            const data = await response.json()
            if (data?.detail) detail = data.detail
          } catch (err) {
            // ignore parse error
          }
          setError(detail)
          setBookings([])
        } else {
          const data = await response.json()
          setBookings(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        setError('Network error. Please try again.')
        setBookings([])
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [])

  const toDate = (value) => {
    if (!value) return null
    if (value?.seconds) return new Date(value.seconds * 1000)
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const formatDateTime = (value) => {
    const date = toDate(value)
    if (!date) return '-'
    return `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
  }

  const formatDateOnly = (value) => {
    const date = toDate(value)
    if (!date) return '-'
    return date.toLocaleDateString('id-ID')
  }

  return (
    <MainLayout title="Booking Driver">
      <div className="ticket-history">
        <header className="history-header">
          <button className="back-link" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <p className="eyebrow">Booking History</p>
            <h1>Riwayat Booking Driver</h1>
            <p className="muted">Lihat status semua permintaan driver kamu</p>
          </div>
        </header>

        {loading ? <p className="muted">Loading bookings...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <div className="table-wrapper">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Submission Date</th>
                  <th>Pickup Location</th>
                  <th>Destination</th>
                  <th>Trip Type</th>
                  <th>Departure</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="muted">
                      Belum ada booking driver.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{formatDateOnly(booking.created_at)}</td>
                      <td className="cell-wrap">{booking.pickup_location || '-'}</td>
                      <td className="cell-wrap">{booking.destination || '-'}</td>
                      <td>{booking.trip_type || '-'}</td>
                      <td>{formatDateTime(booking.departure_time)}</td>
                      <td className={`status-badge status-${(booking.status || 'pending').toLowerCase()}`}>
                        {booking.status || 'pending'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </MainLayout>
  )
}

export default BookingHistory
