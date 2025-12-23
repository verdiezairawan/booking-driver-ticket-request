import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function TicketHistory() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [page, setPage] = useState(1)

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedTickets = tickets.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

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

  const handleEdit = (ticket) => {
    navigate('/user/ticket-request', { state: { ticket } })
  }

  const handleCancel = async (ticketId) => {
    const confirmed = window.confirm('Cancel this ticket request?')
    if (!confirmed) return

    const token = localStorage.getItem('authToken')
    if (!token) {
      setActionError('Authentication token not found. Please login again.')
      return
    }

    setActionLoadingId(ticketId)
    setActionError('')

    try {
      const response = await fetch(`http://localhost:8000/tickets/${ticketId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        let detail = 'Failed to cancel ticket.'
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
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)))
    } catch (err) {
      setActionError('Network error. Please try again.')
    } finally {
      setActionLoadingId('')
    }
  }

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
    return date.toLocaleDateString('en-GB')
  }

  const formatDateTime = (dateValue, timeValue) => {
    const date = toDate(dateValue)
    if (!date) return '-'
    const base = date.toLocaleDateString('en-GB')
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
            &larr; Back
          </button>
          <div>
            <p className="eyebrow">Ticket History</p>
            <h1>Ticket Request History</h1>
            <p className="muted">Track the status of all your travel ticket requests</p>
          </div>
        </header>

        {loading ? <p className="muted">Loading tickets...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {actionError ? <p className="error-text">{actionError}</p> : null}

        {!loading && !error ? (
          <>
            <div className="table-wrapper">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Submission Date</th>
                    <th>Name</th>
                    <th>National ID</th>
                    <th>Dept/Job Position</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Departure Date</th>
                    <th>Departure Point</th>
                    <th>Destination</th>
                    <th>Type of Trip</th>
                    <th>Hotel Accommodation</th>
                    <th>Hotel Name</th>
                    <th>Hotel Location</th>
                    <th>Transportation</th>
                    <th>Approval Note</th>
                    <th>Additional Notes</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan="18" className="muted">
                        No ticket requests yet.
                      </td>
                    </tr>
                  ) : (
                    pagedTickets.map((ticket) => {
                      const statusValue = (ticket.status || 'pending').toLowerCase()
                      const isPending = statusValue === 'pending'

                      return (
                        <tr key={ticket.id}>
                          <td>{formatDate(ticket.created_at)}</td>
                          <td className="cell-wrap">{ticket.full_name || '-'}</td>
                          <td>{ticket.national_id || '-'}</td>
                          <td className="cell-wrap">{ticket.dept_job_position || '-'}</td>
                          <td>{ticket.phone_number || '-'}</td>
                          <td className="cell-wrap">{ticket.email || '-'}</td>
                          <td>{formatDateTime(ticket.departure_date, ticket.departure_time)}</td>
                          <td className="cell-wrap">{ticket.departure_point || '-'}</td>
                          <td>{ticket.destination || '-'}</td>
                          <td>{ticket.trip_type || '-'}</td>
                          <td>{formatBool(ticket.hotel_accommodation)}</td>
                          <td className="cell-wrap">{ticket.hotel_name || '-'}</td>
                          <td className="cell-wrap">{ticket.hotel_location || '-'}</td>
                          <td>{ticket.transportation_mode || '-'}</td>
                          <td className="cell-wrap">{ticket.superior_approval_note || '-'}</td>
                          <td className="cell-wrap">{ticket.additional_notes || '-'}</td>
                          <td>
                            <span className={`status-badge status-${statusValue}`}>{ticket.status || 'pending'}</span>
                          </td>
                          <td>
                            {isPending ? (
                              <div className="table-row-actions">
                                <button
                                  type="button"
                                  className="btn btn-outline-brand"
                                  onClick={() => handleEdit(ticket)}
                                  disabled={actionLoadingId === ticket.id}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => handleCancel(ticket.id)}
                                  disabled={actionLoadingId === ticket.id}
                                >
                                  {actionLoadingId === ticket.id ? 'Cancelling...' : 'Cancel'}
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
          </>
        ) : null}
      </div>
    </MainLayout>
  )
}

export default TicketHistory
