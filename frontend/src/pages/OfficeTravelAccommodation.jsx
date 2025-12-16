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
  full_name: '',
  phone_number: '',
  email: '',
  national_id: '',
  destination: '',
  departure_point: '',
  departure_date: '',
  departure_time: '',
  purpose_of_travel: '',
  trip_type: '',
  hotel_accommodation: 'no',
  hotel_name: '',
  hotel_location: '',
  transportation_mode: '',
  transportation_other: '',
  special_requests: '',
  superior_approval_note: '',
  additional_notes: '',
}

function OfficeTravelAccommodation() {
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
  }

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setSuccessMessage('')
    setErrorMessage('')

    const token = localStorage.getItem('authToken')
    if (!token) {
      setErrorMessage('Authentication token not found. Please login again.')
      setLoading(false)
      return
    }

    const payload = {
      ...form,
      hotel_accommodation: form.hotel_accommodation === 'yes',
    }

    try {
      const response = await fetch('http://localhost:8000/tickets/accommodation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let detail = 'Failed to create travel accommodation.'
        try {
          const data = await response.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setErrorMessage(detail)
      } else {
        setSuccessMessage('Travel accommodation created and approved.')
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
                className={`sidebar-item ${item === 'Travel Accommodation' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="office-content">
          <header className="office-header">
            <p className="eyebrow">Travel Accommodation</p>
            <h1>Create Travel Accommodation</h1>
            <p className="muted">
              Create an approved ticket request on behalf of a user (will go directly to ticket history).
            </p>
          </header>

          <form className="ticket-form" onSubmit={handleSubmit}>
            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon">ID</div>
                <div>
                  <h2>Identity & Contact Information</h2>
                  <p className="muted">Who is traveling</p>
                </div>
              </div>
              <div className="field-grid">
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={handleChange('full_name')}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={form.phone_number}
                  onChange={handleChange('phone_number')}
                  required
                />
                <input type="email" placeholder="Email address" value={form.email} onChange={handleChange('email')} required />
                <input
                  type="text"
                  placeholder="National ID (KTP)"
                  value={form.national_id}
                  onChange={handleChange('national_id')}
                  required
                />
              </div>
            </section>

            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon">TR</div>
                <div>
                  <h2>Travel Details</h2>
                  <p className="muted">Where and when the travel happens</p>
                </div>
              </div>
              <div className="field-grid">
                <input
                  type="text"
                  placeholder="Destination"
                  value={form.destination}
                  onChange={handleChange('destination')}
                  required
                />
                <input
                  type="text"
                  placeholder="Departure point (airport/station)"
                  value={form.departure_point}
                  onChange={handleChange('departure_point')}
                  required
                />
                <label className="inline-label">
                  <span>Departure date</span>
                  <input type="date" value={form.departure_date} onChange={handleChange('departure_date')} required />
                </label>
                <label className="inline-label">
                  <span>Departure time</span>
                  <input type="time" value={form.departure_time} onChange={handleChange('departure_time')} required />
                </label>
                <textarea
                  placeholder="Purpose of travel"
                  rows="3"
                  value={form.purpose_of_travel}
                  onChange={handleChange('purpose_of_travel')}
                  required
                />
                <select value={form.trip_type} onChange={handleChange('trip_type')} required>
                  <option value="" disabled>
                    Type of trip
                  </option>
                  <option value="one-way">One way</option>
                  <option value="round-trip">Return</option>
                  <option value="full-trip">Full Trip</option>
                </select>
              </div>
            </section>

            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon">HT</div>
                <div>
                  <h2>Accommodation & Transportation</h2>
                  <p className="muted">Hotel and ride details</p>
                </div>
              </div>
              <div className="field-grid">
                <div className="radio-row">
                  <span>Hotel accommodation?</span>
                  <label>
                    <input
                      type="radio"
                      name="hotel"
                      value="yes"
                      checked={form.hotel_accommodation === 'yes'}
                      onChange={handleChange('hotel_accommodation')}
                    />{' '}
                    Yes
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hotel"
                      value="no"
                      checked={form.hotel_accommodation === 'no'}
                      onChange={handleChange('hotel_accommodation')}
                    />{' '}
                    No
                  </label>
                </div>

                <input type="text" placeholder="Hotel name" value={form.hotel_name} onChange={handleChange('hotel_name')} />
                <input
                  type="text"
                  placeholder="Hotel location"
                  value={form.hotel_location}
                  onChange={handleChange('hotel_location')}
                />

                <select value={form.transportation_mode} onChange={handleChange('transportation_mode')} required>
                  <option value="" disabled>
                    Preferred mode of transportation
                  </option>
                  <option value="plane">Plane</option>
                  <option value="train">Train</option>
                  <option value="car">Car</option>
                  <option value="bus">Bus</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="If other, write name"
                  value={form.transportation_other}
                  onChange={handleChange('transportation_other')}
                />
                <textarea
                  placeholder="Special requests"
                  rows="3"
                  value={form.special_requests}
                  onChange={handleChange('special_requests')}
                />
              </div>
            </section>

            <section className="field-group">
              <div className="field-heading">
                <div className="heading-icon">AP</div>
                <div>
                  <h2>Approval & Notes</h2>
                  <p className="muted">Approval evidence and additional notes</p>
                </div>
              </div>
              <div className="field-grid">
                <textarea
                  placeholder="Superior approval note (link or description)"
                  rows="3"
                  value={form.superior_approval_note}
                  onChange={handleChange('superior_approval_note')}
                />
                <textarea
                  placeholder="Additional notes"
                  rows="4"
                  value={form.additional_notes}
                  onChange={handleChange('additional_notes')}
                />
              </div>
            </section>

            {successMessage ? <p className="success-text">{successMessage}</p> : null}
            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit & Approve'}
              </button>
              <button type="button" className="btn btn-neutral" onClick={() => navigate('/office/ticket-history')}>
                View History
              </button>
            </div>
          </form>
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeTravelAccommodation

