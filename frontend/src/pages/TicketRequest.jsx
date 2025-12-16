import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

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
  superior_approval_note: '',
  additional_notes: '',
}

function TicketRequest() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      }

      if (field === 'hotel_accommodation' && value !== 'yes') {
        next.hotel_name = ''
        next.hotel_location = ''
      }

      return next
    })
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

    if (form.hotel_accommodation !== 'yes') {
      payload.hotel_name = null
      payload.hotel_location = null
    }

    try {
      const response = await fetch('http://localhost:8000/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let detail = 'Failed to submit ticket request.'
        try {
          const data = await response.json()
          if (data?.detail) {
            detail = data.detail
          }
        } catch (error) {
          // ignore parse error
        }
        setErrorMessage(detail)
      } else {
        setSuccessMessage('Ticket request submitted successfully.')
        setForm(initialForm)
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout title="Ticket Request">
      <div className="ticket-request-page">
        <header className="ticket-request-header">
          <button className="back-link" type="button" onClick={() => navigate(-1)}>
            &larr; Back
          </button>
          <div>
            <p className="eyebrow">Ticket Request</p>
            <h1>Business Travel Ticketing Request</h1>
            <p className="muted">Fill out the form to submit a request</p>
          </div>
        </header>

        <form className="ticket-form" onSubmit={handleSubmit}>
          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">ID</div>
              <div>
                <h2>Identity & Contact Information</h2>
                <p className="muted">Tell us who is traveling</p>
              </div>
            </div>
            <div className="field-grid">
              <label className="inline-label">
                <span>Full name</span>
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={handleChange('full_name')}
                  required
                />
              </label>
              <label className="inline-label">
                <span>Phone number</span>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={form.phone_number}
                  onChange={handleChange('phone_number')}
                  required
                />
              </label>
              <label className="inline-label">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                />
              </label>
              <label className="inline-label">
                <span>National ID (KTP)</span>
                <input
                  type="text"
                  placeholder="National ID (KTP)"
                  value={form.national_id}
                  onChange={handleChange('national_id')}
                  required
                />
              </label>
            </div>
          </section>

          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">TR</div>
              <div>
                <h2>Travel Details</h2>
                <p className="muted">Where and when you need to go</p>
              </div>
            </div>
            <div className="field-grid">
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
                <span>Departure point</span>
                <input
                  type="text"
                  placeholder="Departure point (airport/station)"
                  value={form.departure_point}
                  onChange={handleChange('departure_point')}
                  required
                />
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
                <span>Purpose of travel</span>
                <textarea
                  placeholder="Purpose of travel"
                  rows="3"
                  value={form.purpose_of_travel}
                  onChange={handleChange('purpose_of_travel')}
                  required
                />
              </label>
              <label className="inline-label">
                <span>Type of trip</span>
                <select value={form.trip_type} onChange={handleChange('trip_type')} required>
                  <option value="" disabled>
                    Type of trip
                  </option>
                  <option value="one-way">One way</option>
                  <option value="round-trip">Return</option>
                  <option value="full-trip">Full Trip</option>
                </select>
              </label>
            </div>
          </section>

          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">HT</div>
              <div>
                <h2>Accommodation & Transportation</h2>
                <p className="muted">Hotel and ride preferences</p>
              </div>
            </div>
            <div className="field-grid">
              <div className="radio-row">
                <span>Hotel accommodation?</span>
                <div className="radio-options">
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
              </div>
              {form.hotel_accommodation === 'yes' ? (
                <>
                  <label className="inline-label">
                    <span>Hotel name</span>
                    <input
                      type="text"
                      placeholder="Hotel name"
                      value={form.hotel_name}
                      onChange={handleChange('hotel_name')}
                      required
                    />
                  </label>
                  <label className="inline-label">
                    <span>Hotel location</span>
                    <input
                      type="text"
                      placeholder="Hotel location"
                      value={form.hotel_location}
                      onChange={handleChange('hotel_location')}
                      required
                    />
                  </label>
                </>
              ) : null}
              <label className="inline-label">
                <span>Preferred mode of transportation</span>
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
              </label>
              <label className="inline-label">
                <span>Other transportation (optional)</span>
                <input
                  type="text"
                  placeholder="If other, write name"
                  value={form.transportation_other}
                  onChange={handleChange('transportation_other')}
                />
              </label>
            </div>
          </section>

          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">AP</div>
              <div>
                <h2>Approval & Attachments</h2>
                <p className="muted">Upload approvals or share notes</p>
              </div>
            </div>
            <div className="field-grid">
              <label className="inline-label">
                <span>Approval note (optional)</span>
                <textarea
                  placeholder="Superior approval note (link or description)"
                  rows="3"
                  value={form.superior_approval_note}
                  onChange={handleChange('superior_approval_note')}
                />
              </label>
              <label className="inline-label">
                <span>Additional notes (optional)</span>
                <textarea
                  placeholder="Additional notes"
                  rows="4"
                  value={form.additional_notes}
                  onChange={handleChange('additional_notes')}
                />
              </label>
            </div>
          </section>

          {successMessage ? <p className="success-text">{successMessage}</p> : null}
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
            <button type="button" className="btn btn-neutral" onClick={() => navigate('/user/home')}>
              Batal
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}

export default TicketRequest
