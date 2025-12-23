import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function BookingHistory() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(bookings.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedBookings = bookings.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

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

  const handleEdit = (booking) => {
    navigate('/user/booking-driver', { state: { booking } })
  }

  const handleCancel = async (bookingId) => {
    const confirmed = window.confirm('Cancel this driver booking request?')
    if (!confirmed) return

    const token = localStorage.getItem('authToken')
    if (!token) {
      setActionError('Authentication token not found. Please login again.')
      return
    }

    setActionLoadingId(bookingId)
    setActionError('')

    try {
      const response = await fetch(`http://localhost:8000/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        let detail = 'Failed to cancel booking.'
        try {
          const data = await response.json()
          if (data?.detail) detail = data.detail
        } catch (err) {
          // ignore parse error
        }
        setActionError(detail)
        return
      }

      const updated = await response.json()
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)))
    } catch (err) {
      setActionError('Network error. Please try again.')
    } finally {
      setActionLoadingId('')
    }
  }

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
            &larr; Back
          </button>
          <div>
            <p className="eyebrow">Booking History</p>
            <h1>Riwayat Booking Driver</h1>
            <p className="muted">Lihat status semua permintaan driver kamu</p>
          </div>
        </header>

        {loading ? <p className="muted">Loading bookings...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {actionError ? <p className="error-text">{actionError}</p> : null}

        {!loading && !error ? (
          <>
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="muted">
                        Belum ada booking driver.
                      </td>
                    </tr>
                  ) : (
                    pagedBookings.map((booking) => {
                      const statusValue = (booking.status || 'pending').toLowerCase()
                      const isPending = statusValue === 'pending'

                      return (
                        <tr key={booking.id}>
                          <td>{formatDateOnly(booking.created_at)}</td>
                          <td className="cell-wrap">{booking.pickup_location || '-'}</td>
                          <td className="cell-wrap">{booking.destination || '-'}</td>
                          <td>{booking.trip_type || '-'}</td>
                          <td>{formatDateTime(booking.departure_time)}</td>
                          <td>
                            <span className={`status-badge status-${statusValue}`}>{booking.status || 'pending'}</span>
                          </td>
                          <td>
                            {isPending ? (
                              <div className="table-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-outline-brand"
                                  onClick={() => handleEdit(booking)}
                                  disabled={actionLoadingId === booking.id}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => handleCancel(booking.id)}
                                  disabled={actionLoadingId === booking.id}
                                >
                                  {actionLoadingId === booking.id ? 'Cancelling...' : 'Cancel'}
                                </button>
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="office-pagination">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={loading || currentPage <= 1 || bookings.length === 0}
                onClick={() => setPage((prev) => Math.max(1, Math.min(prev, totalPages) - 1))}
              >
                Prev
              </button>
              <span className="office-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-neutral"
                disabled={loading || currentPage >= totalPages || bookings.length === 0}
                onClick={() => setPage((prev) => Math.min(totalPages, Math.min(prev, totalPages) + 1))}
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </div>
    </MainLayout>
  )
}

export default BookingHistory
