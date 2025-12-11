import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function TicketHistory() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('authToken')
      if (!token) {
        setError('Authentication token not found. Please login again.')
        setLoading(false)
        return
      }

      try {
        const response = await fetch('http://localhost:8000/tickets/my', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          let detail = 'Failed to load tickets.'
          try {
            const data = await response.json()
            if (data?.detail) {
              detail = data.detail
            }
          } catch (err) {
            // ignore parse error
          }
          setError(detail)
          setTickets([])
        } else {
          const data = await response.json()
          setTickets(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        setError('Network error. Please try again.')
        setTickets([])
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [])

  const toDate = (value) => {
    if (!value) return null
    if (value?.seconds) {
      return new Date(value.seconds * 1000)
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const formatDate = (value) => {
    const date = toDate(value)
    if (!date) return '-'
    return date.toLocaleDateString('id-ID')
  }

  const formatDateTime = (dateValue, timeValue) => {
    const date = toDate(dateValue)
    if (!date) return '-'
    const base = date.toLocaleDateString('id-ID')
    if (timeValue) {
      return `${base} ${timeValue}`
    }
    return base
  }

  const formatBool = (value) => {
    if (value === true) return 'Yes'
    if (value === false) return 'No'
    if (value === 'yes') return 'Yes'
    if (value === 'no') return 'No'
    return '-'
  }

  return (
    <MainLayout title="Ticket History">
      <div className="ticket-history">
        <header className="history-header">
          <button className="back-link" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <p className="eyebrow">Ticket History</p>
            <h1>Riwayat Pengajuan Tiket</h1>
            <p className="muted">Lihat status semua permintaan perjalanan kamu</p>
          </div>
        </header>

        {loading ? <p className="muted">Loading tickets...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <div className="table-wrapper">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Submission Date</th>
                  <th>Departure Date</th>
                  <th>Departure Point</th>
                  <th>Destination</th>
                  <th>Type of Trip</th>
                  <th>Hotel Accommodation</th>
                  <th>Transportation</th>
                  <th>Special Requests</th>
                  <th>Approval Note</th>
                  <th>Additional Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="muted">
                      Belum ada pengajuan tiket.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{formatDate(ticket.created_at)}</td>
                      <td>{formatDateTime(ticket.departure_date, ticket.departure_time)}</td>
                      <td className="cell-wrap">{ticket.departure_point || '-'}</td>
                      <td>{ticket.destination || '-'}</td>
                      <td>{ticket.trip_type || '-'}</td>
                      <td>{formatBool(ticket.hotel_accommodation)}</td>
                      <td>{ticket.transportation_mode || '-'}</td>
                      <td className="cell-wrap">{ticket.special_requests || '-'}</td>
                      <td className="cell-wrap">{ticket.superior_approval_note || '-'}</td>
                      <td className="cell-wrap">{ticket.additional_notes || '-'}</td>
                      <td className={`status-badge status-${(ticket.status || 'pending').toLowerCase()}`}>
                        {ticket.status || 'pending'}
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

export default TicketHistory
