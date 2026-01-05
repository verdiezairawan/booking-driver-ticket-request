import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'
import useOfficeSidebar from '../hooks/useOfficeSidebar'
import { API_BASE_URL } from '../config'

const menuItems = [
  { label: 'Dashboard', icon: 'bi-speedometer2' },
  { label: 'Travel Requests', icon: 'bi-ticket-perforated' },
  { label: 'Travel Status & History', icon: 'bi-clock-history' },
  { label: 'Travel Assign', icon: 'bi-building' },
  { label: 'Booking Driver Requests', icon: 'bi-car-front' },
  { label: 'Booking Driver Status & History', icon: 'bi-card-list' },
  { label: 'Booking Driver Assign', icon: 'bi-person-check' },
  { label: 'Manage User', icon: 'bi-people' },
]

const initialForm = {
  requester_name: '',
  requester_dept_job_position: '',
  requester_nik: '',
  requester_phone: '',
  requester_email: '',
  driver_email: '',
  pickup_location: '',
  destination: '',
  trip_type: '',
  departure_date: '',
  departure_time: '',
  passenger_count: 1,
}

function OfficeAssignDrivers() {
  const navigate = useNavigate()
  const { collapsed: isSidebarCollapsed, toggle: toggleSidebar } = useOfficeSidebar()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [driversError, setDriversError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setDriversError('Authentication token not found.')
      return
    }

    const loadDrivers = async () => {
      setDriversLoading(true)
      setDriversError('')

      try {
        const res = await fetch(`${API_BASE_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          let detail = 'Failed to load drivers.'
          try {
            const data = await res.json()
            if (data?.detail) detail = data.detail
          } catch {
            // ignore parse error
          }
          setDriversError(detail)
          setDrivers([])
          return
        }

        const data = await res.json()
        const allUsers = Array.isArray(data) ? data : []
        setDrivers(allUsers.filter((user) => user.role === 'driver'))
      } catch (err) {
        setDriversError('Network error. Please try again.')
        setDrivers([])
      } finally {
        setDriversLoading(false)
      }
    }

    loadDrivers()
  }, [])

  const handleNavigate = (item) => {
    if (item === 'Dashboard') navigate('/office/home')
    if (item === 'Travel Requests') navigate('/office/ticket-requests')
    if (item === 'Travel Status & History') navigate('/office/ticket-history')
    if (item === 'Booking Driver Status & History') navigate('/office/driver-history')
    if (item === 'Travel Assign') navigate('/office/travel-accommodation')
    if (item === 'Booking Driver Requests') navigate('/office/driver-requests')
    if (item === 'Booking Driver Assign') navigate('/office/assign-drivers')
    if (item === 'Manage User') navigate('/office/manage-user')
  }

  const handleChange = (field) => (event) => {
    const value = field === 'passenger_count' ? event.target.value : event.target.value
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setSuccessMessage('')
    setErrorMessage('')
    setShowSuccessModal(false)

    if (!form.departure_date || !form.departure_time) {
      setErrorMessage('Departure date and time are required.')
      setLoading(false)
      return
    }

    const token = localStorage.getItem('authToken')
    if (!token) {
      setErrorMessage('Authentication token not found. Please login again.')
      setLoading(false)
      return
    }

    const departureDateTime = new Date(`${form.departure_date}T${form.departure_time}`)
    if (Number.isNaN(departureDateTime.getTime())) {
      setErrorMessage('Invalid departure date or time format.')
      setLoading(false)
      return
    }

    const payload = {
      requester_name: form.requester_name,
      requester_dept_job_position: form.requester_dept_job_position,
      requester_nik: form.requester_nik,
      requester_phone: form.requester_phone,
      requester_email: form.requester_email,
      driver_email: form.driver_email,
      pickup_location: form.pickup_location,
      destination: form.destination,
      trip_type: form.trip_type,
      departure_time: departureDateTime.toISOString(),
      passenger_count: Number(form.passenger_count) || 1,
    }

    try {
      const response = await fetch(`${API_BASE_URL}/bookings/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let detail = 'Failed to assign driver.'
        try {
          const data = await response.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setErrorMessage(detail)
      } else {
        setSuccessMessage('Driver assigned successfully (approved).')
        setForm(initialForm)
        setShowSuccessModal(true)
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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
                className={`sidebar-item ${item.label === 'Booking Driver Assign' ? 'active' : ''}`}
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
            <p className="eyebrow">Assign Drivers</p>
            <h1>Assign a Driver</h1>
            <p className="muted">
              Create an approved driver booking on behalf of a user (will go directly to driver history).
            </p>
          </header>

          <form className="ticket-form" onSubmit={handleSubmit}>
            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon" aria-hidden="true">
                  <i className="bi bi-person-badge" />
                </div>
                <div>
                  <h2>Requester</h2>
                  <p className="muted">User details (can be a non-account user)</p>
                </div>
              </div>
              <div className="field-grid">
                <label className="inline-label">
                  <span>Full name</span>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.requester_name}
                    onChange={handleChange('requester_name')}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>User Dept/Job Position</span>
                  <input
                    type="text"
                    placeholder="User Dept/Job Position"
                    value={form.requester_dept_job_position}
                    onChange={handleChange('requester_dept_job_position')}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>National ID</span>
                  <input
                    type="text"
                    placeholder="National ID"
                    value={form.requester_nik}
                    onChange={handleChange('requester_nik')}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>Phone number</span>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={form.requester_phone}
                    onChange={handleChange('requester_phone')}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={form.requester_email}
                    onChange={handleChange('requester_email')}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon" aria-hidden="true">
                  <i className="bi bi-car-front-fill" />
                </div>
                <div>
                  <h2>Booking Details</h2>
                  <p className="muted">Pickup, destination, schedule</p>
                </div>
              </div>
              <div className="field-grid">
                <label className="inline-label">
                  <span>Pickup location</span>
                  <input
                    type="text"
                    placeholder="Pickup location"
                    value={form.pickup_location}
                    onChange={handleChange('pickup_location')}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>Destination</span>
                  <input
                    type="text"
                    placeholder="Destination"
                    value={form.destination}
                    onChange={handleChange('destination')}
                    required
                  />
                </label>
                <label className="inline-label">
                  <span>Type of trip</span>
                  <select value={form.trip_type} onChange={handleChange('trip_type')} required>
                    <option value="" disabled>
                      Type of trip
                    </option>
                    <option value="antar">Drop-off</option>
                    <option value="jemput">Pick-up</option>
                    <option value="fulltrip">Full Trip</option>
                  </select>
                </label>
                <label className="inline-label">
                  <span>Departure date</span>
                  <input type="date" value={form.departure_date} onChange={handleChange('departure_date')} required />
                </label>
                <label className="inline-label">
                  <span>Departure time</span>
                  <input type="time" value={form.departure_time} onChange={handleChange('departure_time')} required />
                </label>
                <label className="inline-label">
                  <span>Passenger count</span>
                  <input
                    type="number"
                    min="1"
                    value={form.passenger_count}
                    onChange={handleChange('passenger_count')}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon" aria-hidden="true">
                  <i className="bi bi-person-check" />
                </div>
                <div>
                  <h2>Driver</h2>
                  <p className="muted">Assign a driver</p>
                </div>
              </div>
              <div className="field-grid">
                {driversError ? <p className="error-text">{driversError}</p> : null}
                <label className="inline-label">
                  <span>Driver</span>
                  <select
                    value={form.driver_email}
                    onChange={handleChange('driver_email')}
                    disabled={driversLoading || loading || !drivers.length}
                    required
                  >
                    <option value="" disabled>
                      {driversLoading ? 'Loading drivers...' : drivers.length ? 'Select driver...' : 'No drivers found'}
                    </option>
                    {drivers.map((driver) => (
                      <option key={driver.uid} value={driver.email}>
                        {driver.name ? `${driver.name} (${driver.email})` : driver.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            {successMessage ? <p className="success-text">{successMessage}</p> : null}
            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : 'Assign Driver'}
              </button>
              <button type="button" className="btn btn-neutral" onClick={() => navigate('/office/driver-history')}>
                View History
              </button>
            </div>
          </form>

          {showSuccessModal ? (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="assign-success-title">
              <div className="modal success-modal">
                <div className="success-modal-icon" aria-hidden="true">
                  <i className="bi bi-check-lg" />
                </div>
                <h2 id="assign-success-title" className="success-modal-title">
                  Assignment Saved
                </h2>
                <p className="success-modal-message">
                  Driver assignment was saved successfully. It will appear in driver history.
                </p>
                <div className="success-modal-actions">
                  <button
                    type="button"
                    className="btn btn-brand"
                    onClick={() => {
                      setShowSuccessModal(false)
                      navigate('/office/driver-history')
                    }}
                  >
                    View History
                  </button>
                  <button type="button" className="btn btn-outline-brand" onClick={() => setShowSuccessModal(false)}>
                    Back to Form
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeAssignDrivers
