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
  const [page, setPage] = useState(1)

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(bookings.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedBookings = bookings.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

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

  const formatDistance = (booking) => {
    const starting = Number(booking?.starting_mileage)
    const ending = Number(booking?.ending_mileage)
    if (!Number.isFinite(starting) || !Number.isFinite(ending)) return '-'
    if (ending < starting) return '-'
    return String(ending - starting)
  }

  const escapeHtml = (value) => {
    if (value === null || value === undefined) return ''
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  const handleExport = () => {
    if (!bookings.length) return

    const headers = [
      'Name',
      'User Dept/Job Position',
      'Phone',
      'Email',
      'National ID',
      'Pickup Location',
      'Destination',
      'Passenger Count',
      'Departure Date',
      'Type of Trip',
      'Driver',
      'Starting Mileage',
      'Ending Mileage',
      'Total Distance',
      'Status',
    ]

    const rows = bookings.map((booking) => [
      booking.requester_name || '',
      booking.requester_dept_job_position || '',
      booking.requester_phone || '',
      booking.requester_email || '',
      booking.requester_nik || '',
      booking.pickup_location || '',
      booking.destination || '',
      booking.passenger_count ?? '',
      formatDate(booking.departure_time),
      booking.trip_type || '',
      booking.driver_name || booking.driver_id || '',
      booking.starting_mileage ?? '',
      booking.ending_mileage ?? '',
      formatDistance(booking),
      booking.status || '',
    ])

    const headerHtml = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`
    const bodyHtml = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join('')

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <table border="1">
      <thead>${headerHtml}</thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </body>
</html>`

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `driver_history_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-outline-brand"
              onClick={handleExport}
              disabled={loading || !bookings.length}
              title={bookings.length ? 'Export to Excel (.xls)' : 'No data to export'}
            >
              <i className="bi bi-file-earmark-excel" />
              Export Excel
            </button>
          </div>

          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>User Dept/Job Position</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>National ID</th>
                  <th>Pickup Location</th>
                  <th>Destination</th>
                  <th>Passenger Count</th>
                  <th>Departure Date</th>
                  <th>Type of Trip</th>
                  <th>Driver</th>
                  <th>Starting Mileage</th>
                  <th>Ending Mileage</th>
                  <th>Total Distance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="15" className="muted">
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="15" className="error-text">
                      {error}
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="muted">
                      No driver history found.
                    </td>
                  </tr>
                ) : (
                  pagedBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{booking.requester_name || '-'}</td>
                      <td>{booking.requester_dept_job_position || '-'}</td>
                      <td>{booking.requester_phone || '-'}</td>
                      <td>{booking.requester_email || '-'}</td>
                      <td>{booking.requester_nik || '-'}</td>
                      <td>{booking.pickup_location || '-'}</td>
                      <td>{booking.destination || '-'}</td>
                      <td>{booking.passenger_count ?? '-'}</td>
                      <td>{formatDate(booking.departure_time)}</td>
                      <td>{booking.trip_type || '-'}</td>
                      <td>{booking.driver_name || booking.driver_id || '-'}</td>
                      <td>{booking.starting_mileage ?? '-'}</td>
                      <td>{booking.ending_mileage ?? '-'}</td>
                      <td>{formatDistance(booking)}</td>
                      <td>
                        {booking.status ? (
                          <span className={`status-badge status-${String(booking.status).toLowerCase()}`}>
                            {booking.status}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
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
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeDriverHistory
