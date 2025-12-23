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

function OfficeDriverHistory() {
  const navigate = useNavigate()
  const { collapsed: isSidebarCollapsed, toggle: toggleSidebar } = useOfficeSidebar()
  const [bookings, setBookings] = useState([])
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

  const getDistanceNumber = (booking) => {
    const starting = Number(booking?.starting_mileage)
    const ending = Number(booking?.ending_mileage)
    if (!Number.isFinite(starting) || !Number.isFinite(ending)) return null
    if (ending < starting) return null
    return ending - starting
  }

  const getBookingSortValue = (booking, key) => {
    if (!booking) return ''
    switch (key) {
      case 'requester_name':
        return booking.requester_name || ''
      case 'requester_dept_job_position':
        return booking.requester_dept_job_position || ''
      case 'requester_phone':
        return booking.requester_phone || ''
      case 'requester_email':
        return booking.requester_email || ''
      case 'requester_nik':
        return booking.requester_nik || ''
      case 'pickup_location':
        return booking.pickup_location || ''
      case 'destination':
        return booking.destination || ''
      case 'passenger_count':
        {
          const count = Number(booking.passenger_count)
          return Number.isFinite(count) ? count : null
        }
      case 'departure_time':
        return toDate(booking.departure_time)?.getTime() ?? null
      case 'trip_type':
        return booking.trip_type || ''
      case 'driver':
        return booking.driver_name || booking.driver_id || ''
      case 'starting_mileage':
        {
          const starting = Number(booking.starting_mileage)
          return Number.isFinite(starting) ? starting : null
        }
      case 'ending_mileage':
        {
          const ending = Number(booking.ending_mileage)
          return Number.isFinite(ending) ? ending : null
        }
      case 'total_distance':
        return getDistanceNumber(booking) ?? null
      case 'status':
        return String(booking.status || '').toLowerCase()
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

  const sortedBookings = useMemo(() => {
    if (!sortConfig.key) return bookings

    return bookings
      .map((booking, index) => ({ booking, index }))
      .sort((a, b) => {
        const aValue = getBookingSortValue(a.booking, sortConfig.key)
        const bValue = getBookingSortValue(b.booking, sortConfig.key)
        const base = compareValues(aValue, bValue)

        if (base !== 0) {
          return sortConfig.direction === 'asc' ? base : -base
        }

        return a.index - b.index
      })
      .map((entry) => entry.booking)
  }, [bookings, sortConfig])

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedBookings = sortedBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
    const dt = toDate(value)
    return dt ? dt.toLocaleDateString('en-GB') : '-'
  }

  const formatTripType = (value) => {
    if (!value) return '-'
    if (value === 'antar') return 'Drop-off'
    if (value === 'jemput') return 'Pick-up'
    if (value === 'fulltrip') return 'Full Trip'
    return value
  }

  const formatDistance = (booking) => {
    const distance = getDistanceNumber(booking)
    return distance === null ? '-' : String(distance)
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
    if (!sortedBookings.length) return

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

    const rows = sortedBookings.map((booking) => [
      booking.requester_name || '',
      booking.requester_dept_job_position || '',
      booking.requester_phone || '',
      booking.requester_email || '',
      booking.requester_nik || '',
      booking.pickup_location || '',
      booking.destination || '',
      booking.passenger_count ?? '',
      formatDate(booking.departure_time),
      formatTripType(booking.trip_type),
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
                className={`sidebar-item ${item.label === 'Driver History' ? 'active' : ''}`}
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
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('requester_name')}>
                      Name {renderSortIcon('requester_name')}
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => toggleSort('requester_dept_job_position')}
                    >
                      User Dept/Job Position {renderSortIcon('requester_dept_job_position')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('requester_phone')}>
                      Phone {renderSortIcon('requester_phone')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('requester_email')}>
                      Email {renderSortIcon('requester_email')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('requester_nik')}>
                      National ID {renderSortIcon('requester_nik')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('pickup_location')}>
                      Pickup Location {renderSortIcon('pickup_location')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('destination')}>
                      Destination {renderSortIcon('destination')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('passenger_count')}>
                      Passenger Count {renderSortIcon('passenger_count')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('departure_time')}>
                      Departure Date {renderSortIcon('departure_time')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('trip_type')}>
                      Type of Trip {renderSortIcon('trip_type')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('driver')}>
                      Driver {renderSortIcon('driver')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('starting_mileage')}>
                      Starting Mileage {renderSortIcon('starting_mileage')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('ending_mileage')}>
                      Ending Mileage {renderSortIcon('ending_mileage')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="table-sort" onClick={() => toggleSort('total_distance')}>
                      Total Distance {renderSortIcon('total_distance')}
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
                      <td>{formatTripType(booking.trip_type)}</td>
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
