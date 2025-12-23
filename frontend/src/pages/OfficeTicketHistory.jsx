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

function OfficeTicketHistory() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedTickets = tickets.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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

    const loadTickets = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('http://localhost:8000/tickets/history', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          let detail = 'Failed to load tickets.'
          try {
            const data = await res.json()
            if (data?.detail) detail = data.detail
          } catch {
            // ignore parse error
          }
          setError(detail)
          setTickets([])
        } else {
          const data = await res.json()
          setTickets(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        setError('Network error. Please try again.')
        setTickets([])
      } finally {
        setLoading(false)
      }
    }

    loadTickets()
  }, [])

  const formatDate = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('id-ID')
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
    if (!tickets.length) return

    const headers = [
      'Name',
      'User Dept/Job Position',
      'Phone',
      'Email',
      'National ID',
      'Departure Date',
      'Departure Time',
      'Departure Point',
      'Destination',
      'Purpose of Travel',
      'Type of Trip',
      'Hotel Accommodation',
      'Hotel Name',
      'Hotel Location',
      'Transport Mode',
      'Attachment',
      'Notes',
      'Status',
    ]

    const rows = tickets.map((ticket) => [
      ticket.full_name || '',
      ticket.dept_job_position || '',
      ticket.phone_number || '',
      ticket.email || '',
      ticket.national_id || '',
      formatDate(ticket.departure_date),
      ticket.departure_time || '',
      ticket.departure_point || '',
      ticket.destination || '',
      ticket.purpose_of_travel || '',
      ticket.trip_type || '',
      ticket.hotel_accommodation ? 'Yes' : 'No',
      ticket.hotel_name || '',
      ticket.hotel_location || '',
      ticket.transportation_mode || '',
      ticket.superior_approval_note || '',
      ticket.additional_notes || '',
      ticket.status || '',
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
    link.download = `ticket_history_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
                className={`sidebar-item ${item === 'Ticket History' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="office-content">
          <header className="office-header">
            <p className="eyebrow">Ticket History</p>
            <h1>Ticket History</h1>
            <p className="muted">All processed ticket requests (non-pending)</p>
          </header>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-outline-brand"
              onClick={handleExport}
              disabled={loading || !tickets.length}
              title={tickets.length ? 'Export to Excel (.xls)' : 'No data to export'}
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
                  <th>Departure Date</th>
                  <th>Departure Time</th>
                  <th>Departure Point</th>
                  <th>Destination</th>
                  <th>Purpose of Travel</th>
                  <th>Type of Trip</th>
                  <th>Hotel Accommodation</th>
                  <th>Hotel Name</th>
                  <th>Hotel Location</th>
                  <th>Transport Mode</th>
                  <th>Attachment</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="18" className="muted">
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="18" className="error-text">
                      {error}
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan="18" className="muted">
                      No ticket history found.
                    </td>
                  </tr>
                ) : (
                  pagedTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.full_name || '-'}</td>
                      <td>{ticket.dept_job_position || '-'}</td>
                      <td>{ticket.phone_number || '-'}</td>
                      <td>{ticket.email || '-'}</td>
                      <td>{ticket.national_id || '-'}</td>
                      <td>{formatDate(ticket.departure_date)}</td>
                      <td>{ticket.departure_time || '-'}</td>
                      <td>{ticket.departure_point || '-'}</td>
                      <td>{ticket.destination || '-'}</td>
                      <td>{ticket.purpose_of_travel || '-'}</td>
                      <td>{ticket.trip_type || '-'}</td>
                      <td>{ticket.hotel_accommodation ? 'Yes' : 'No'}</td>
                      <td>{ticket.hotel_name || '-'}</td>
                      <td>{ticket.hotel_location || '-'}</td>
                      <td>{ticket.transportation_mode || '-'}</td>
                      <td>{ticket.superior_approval_note || '-'}</td>
                      <td>{ticket.additional_notes || '-'}</td>
                      <td>
                        {ticket.status ? (
                          <span className={`status-badge status-${String(ticket.status).toLowerCase()}`}>{ticket.status}</span>
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
              disabled={loading || currentPage <= 1 || tickets.length === 0}
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
              disabled={loading || currentPage >= totalPages || tickets.length === 0}
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

export default OfficeTicketHistory
