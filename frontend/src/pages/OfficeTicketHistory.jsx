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

  const handleNavigate = (item) => {
    if (item === 'Dashboard') navigate('/office/home')
    if (item === 'Ticket Requests') navigate('/office/ticket-requests')
    if (item === 'Driver Requests') navigate('/office/driver-requests')
    if (item === 'Ticket History') navigate('/office/ticket-history')
    if (item === 'Driver History') navigate('/office/driver-history')
    if (item === 'Travel Accommodation') navigate('/office/travel-accommodation')
    if (item === 'Assign Drivers') navigate('/office/assign-drivers')
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

          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Name</th>
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
                    <td colSpan="17" className="muted">
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="17" className="error-text">
                      {error}
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan="17" className="muted">
                      No ticket history found.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.full_name || '-'}</td>
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
                      <td>{ticket.status || '-'}</td>
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

export default OfficeTicketHistory
