import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

const initialForm = {
  pickup_location: '',
  destination: '',
  trip_type: '',
  departure_date: '',
  departure_time: '',
  passenger_count: 1,
}

function BookingDriver() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

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
      setErrorMessage('Tanggal dan jam keberangkatan wajib diisi.')
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
      setErrorMessage('Format tanggal atau jam tidak valid.')
      setLoading(false)
      return
    }

    const payload = {
      pickup_location: form.pickup_location,
      destination: form.destination,
      trip_type: form.trip_type,
      departure_time: departureDateTime.toISOString(),
      passenger_count: Number(form.passenger_count) || 1,
    }

    try {
      const response = await fetch('http://localhost:8000/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let detail = 'Failed to submit booking request.'
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
        setSuccessMessage('Booking request submitted successfully.')
        setForm(initialForm)
      }
    } catch (error) {
      setErrorMessage('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout title="Booking Driver">
      <div className="ticket-request-page booking-driver-page">
        <header className="ticket-request-header">
          <button className="back-link" type="button" onClick={() => navigate(-1)}>
            &larr; Back
          </button>
          <div>
            <p className="eyebrow">Booking Driver</p>
            <h1>Buat Booking Baru</h1>
            <p className="muted">Isi form berikut untuk permintaan driver</p>
          </div>
        </header>

        <form className="ticket-form" onSubmit={handleSubmit}>
          <section className="booking-card">
            <div className="booking-card__header">
              <div className="heading-icon">BD</div>
              <div>
                <h2>Detail Perjalanan</h2>
                <p className="muted">Lokasi, tujuan, dan jadwal keberangkatan</p>
              </div>
            </div>

            <div className="booking-grid">
              <label className="form-field">
                <span>Lokasi Awal</span>
                <input
                  type="text"
                  placeholder="Lobby Kantor"
                  value={form.pickup_location}
                  onChange={handleChange('pickup_location')}
                  required
                />
              </label>
              <label className="form-field">
                <span>Tujuan</span>
                <input
                  type="text"
                  placeholder="Bandara Soetta"
                  value={form.destination}
                  onChange={handleChange('destination')}
                  required
                />
              </label>
              <label className="form-field">
                <span>Jenis Perjalanan</span>
                <select value={form.trip_type} onChange={handleChange('trip_type')} required>
                  <option value="" disabled>
                    Pilih jenis...
                  </option>
                  <option value="antar">Antar</option>
                  <option value="jemput">Jemput</option>
                  <option value="fulltrip">Full Trip</option>
                </select>
              </label>
              <label className="form-field">
                <span>Tanggal Keberangkatan</span>
                <input
                  type="date"
                  value={form.departure_date}
                  onChange={handleChange('departure_date')}
                  required
                />
              </label>
              <label className="form-field">
                <span>Jam Keberangkatan</span>
                <input
                  type="time"
                  value={form.departure_time}
                  onChange={handleChange('departure_time')}
                  required
                />
              </label>
              <label className="form-field">
                <span>Jumlah Penumpang</span>
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

          {successMessage ? <p className="success-text">{successMessage}</p> : null}
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim Request'}
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

export default BookingDriver
