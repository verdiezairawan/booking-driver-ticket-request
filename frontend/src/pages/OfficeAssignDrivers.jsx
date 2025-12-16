import { useState } from 'react'
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

const initialForm = {
  requester_name: '',
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
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleNavigate = (item) => {
    if (item === 'Dashboard') navigate('/office/home')
    if (item === 'Ticket Requests') navigate('/office/ticket-requests')
    if (item === 'Driver Requests') navigate('/office/driver-requests')
    if (item === 'Ticket History') navigate('/office/ticket-history')
    if (item === 'Driver History') navigate('/office/driver-history')
    if (item === 'Travel Accommodation') navigate('/office/travel-accommodation')
    if (item === 'Assign Drivers') navigate('/office/assign-drivers')
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
      const response = await fetch('http://localhost:8000/bookings/assign', {
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
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
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
                className={`sidebar-item ${item === 'Assign Drivers' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
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
                <div className="heading-icon">ID</div>
                <div>
                  <h2>Requester</h2>
                  <p className="muted">User details (can be a non-account user)</p>
                </div>
              </div>
              <div className="field-grid">
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.requester_name}
                  onChange={handleChange('requester_name')}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={form.requester_phone}
                  onChange={handleChange('requester_phone')}
                  required
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={form.requester_email}
                  onChange={handleChange('requester_email')}
                  required
                />
              </div>
            </section>

            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon">BD</div>
                <div>
                  <h2>Booking Details</h2>
                  <p className="muted">Pickup, destination, schedule</p>
                </div>
              </div>
              <div className="field-grid">
                <input
                  type="text"
                  placeholder="Pickup location"
                  value={form.pickup_location}
                  onChange={handleChange('pickup_location')}
                  required
                />
                <input
                  type="text"
                  placeholder="Destination"
                  value={form.destination}
                  onChange={handleChange('destination')}
                  required
                />
                <select value={form.trip_type} onChange={handleChange('trip_type')} required>
                  <option value="" disabled>
                    Type of trip
                  </option>
                  <option value="antar">Antar</option>
                  <option value="jemput">Jemput</option>
                  <option value="fulltrip">Full Trip</option>
                </select>
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
                <div className="heading-icon">DR</div>
                <div>
                  <h2>Driver</h2>
                  <p className="muted">Assign a driver (by email)</p>
                </div>
              </div>
              <div className="field-grid">
                <input
                  type="email"
                  placeholder="Driver email"
                  value={form.driver_email}
                  onChange={handleChange('driver_email')}
                  required
                />
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
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeAssignDrivers

