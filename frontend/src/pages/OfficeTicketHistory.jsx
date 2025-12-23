import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'
import useOfficeSidebar from '../hooks/useOfficeSidebar'

const menuItems = [
  { label: 'Dashboard', icon: 'bi-speedometer2' },
  { label: 'Ticket Requests', icon: 'bi-ticket-perforated' },
  { label: 'Driver Requests', icon: 'bi-car-front' },
  { label: 'Ticket History', icon: 'bi-clock-history' },
  { label: 'Driver History', icon: 'bi-card-list' },
  { label: 'Travel Accommodation', icon: 'bi-building' },
  { label: 'Assign Drivers', icon: 'bi-person-check' },
  { label: 'Manage User', icon: 'bi-people' },
  { label: 'Report', icon: 'bi-clipboard-data' },
]

function OfficeTicketHistory() {
  const navigate = useNavigate()
  const { collapsed: isSidebarCollapsed, toggle: toggleSidebar } = useOfficeSidebar()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' })

  const pageSize = 10

  const toDate = (value) => {
    if (!value) return null
    if (value?.seconds) return new Date(value.seconds * 1000)
    const dt = new Date(value)
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const getTicketSortValue = (ticket, key) => {
    if (!ticket) return ''
    switch (key) {
      case 'full_name':
        return ticket.full_name || ''
      case 'dept_job_position':
        return ticket.dept_job_position || ''
      case 'phone_number':
        return ticket.phone_number || ''
      case 'email':
        return ticket.email || ''
      case 'national_id':
        return ticket.national_id || ''
      case 'departure_date':
        return toDate(ticket.departure_date)?.getTime() ?? null
      case 'departure_time':
        return ticket.departure_time || ''
      case 'departure_point':
        return ticket.departure_point || ''
      case 'destination':
        return ticket.destination || ''
      case 'purpose_of_travel':
        return ticket.purpose_of_travel || ''
      case 'trip_type':
        return ticket.trip_type || ''
      case 'hotel_accommodation':
        return ticket.hotel_accommodation ? 1 : 0
      case 'hotel_name':
        return ticket.hotel_name || ''
      case 'hotel_location':
        return ticket.hotel_location || ''
      case 'transportation_mode':
        return ticket.transportation_mode || ''
      case 'attachment':
        return ticket.superior_approval_note || ''
      case 'notes':
        return ticket.additional_notes || ''
      case 'status':
        return String(ticket.status || '').toLowerCase()
      default:
        return ''
    }
  }

  const compareValues = (aValue, bValue) => {
    const aEmpty = aValue === null || aValue === undefined || aValue === ''
    const bEmpty = bValue === null || bValue === undefined || bValue === ''

    if (aEmpty && bEmpty) return 0
    if (aEmpty) return 1
    if (bEmpty) return -1

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue
    }

    return String(aValue).localeCompare(String(bValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  }

  const sortedTickets = useMemo(() => {
    if (!sortConfig.key) return tickets

    return tickets
      .map((ticket, index) => ({ ticket, index }))
      .sort((a, b) => {
        const aValue = getTicketSortValue(a.ticket, sortConfig.key)
        const bValue = getTicketSortValue(b.ticket, sortConfig.key)
        const base = compareValues(aValue, bValue)

        if (base !== 0) {
          return sortConfig.direction === 'asc' ? base : -base
        }

        return a.index - b.index
      })
      .map((entry) => entry.ticket)
  }, [tickets, sortConfig])

  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedTickets = sortedTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
    const dt = toDate(value)
    return dt ? dt.toLocaleDateString('en-GB') : '-'
  }

  const toggleSort = (key) => {
    setPage(1)
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const renderSortIcon = (key) => {
    const isActive = sortConfig.key === key
    if (!isActive) {
      return <i className="bi bi-arrow-down-up sort-indicator sort-indicator-muted" aria-hidden="true" />
    }
    return (
      <i
        className={`bi ${sortConfig.direction === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} sort-indicator`}
        aria-hidden="true"
      />
    )
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
    if (!sortedTickets.length) return

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

    const rows = sortedTickets.map((ticket) => [
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
      <div className={`office-dashboard fixed-sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}>
        <aside className="office-sidebar visible">
          <div className="sidebar-header">
            <span className="sidebar-role">Office Coordinator</span>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <i className={`bi ${isSidebarCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`} aria-hidden="true" />
            </button>
          </div>
          <nav className="sidebar-menu">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`sidebar-item ${item.label === 'Ticket History' ? 'active' : ''}`}
                onClick={() => handleNavigate(item.label)}
                aria-label={item.label}
                title={item.label}
              >
                <i className={`bi ${item.icon} sidebar-item__icon`} aria-hidden="true" />
                <span className="sidebar-item__label">{item.label}</span>
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
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('full_name')}>
                      Name {renderSortIcon('full_name')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('dept_job_position')}>
                      User Dept/Job Position {renderSortIcon('dept_job_position')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('phone_number')}>
                      Phone {renderSortIcon('phone_number')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('email')}>
                      Email {renderSortIcon('email')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('national_id')}>
                      National ID {renderSortIcon('national_id')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('departure_date')}>
                      Departure Date {renderSortIcon('departure_date')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('departure_time')}>
                      Departure Time {renderSortIcon('departure_time')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('departure_point')}>
                      Departure Point {renderSortIcon('departure_point')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('destination')}>
                      Destination {renderSortIcon('destination')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('purpose_of_travel')}>
                      Purpose of Travel {renderSortIcon('purpose_of_travel')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('trip_type')}>
                      Type of Trip {renderSortIcon('trip_type')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('hotel_accommodation')}>
                      Hotel Accommodation {renderSortIcon('hotel_accommodation')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('hotel_name')}>
                      Hotel Name {renderSortIcon('hotel_name')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('hotel_location')}>
                      Hotel Location {renderSortIcon('hotel_location')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('transportation_mode')}>
                      Transport Mode {renderSortIcon('transportation_mode')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('attachment')}>
                      Attachment {renderSortIcon('attachment')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('notes')}>
                      Notes {renderSortIcon('notes')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('status')}>
                      Status {renderSortIcon('status')}
                    </button>
                  </th>
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
