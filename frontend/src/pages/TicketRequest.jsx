import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function TicketRequest() {
  const navigate = useNavigate()

  return (
    <MainLayout title="Ticket Request">
      <div className="ticket-request-page">
        <header className="ticket-request-header">
          <button className="back-link" type="button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <p className="eyebrow">Ticket Request</p>
            <h1>Business Travel Ticketing Request</h1>
            <p className="muted">Fill out the form to submit a request</p>
          </div>
        </header>

        <form className="ticket-form">
          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">ID</div>
              <div>
                <h2>Identity & Contact Information</h2>
                <p className="muted">Tell us who is traveling</p>
              </div>
            </div>
            <div className="field-grid">
              <input type="text" placeholder="Full name" />
              <input type="tel" placeholder="Phone Number" />
              <input type="email" placeholder="Email address" />
              <input type="text" placeholder="National ID (KTP)" />
            </div>
          </section>

          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">✈</div>
              <div>
                <h2>Travel Details</h2>
                <p className="muted">Where and when you need to go</p>
              </div>
            </div>
            <div className="field-grid">
              <input type="text" placeholder="Destination" />
              <input type="text" placeholder="Departure point (airport/station)" />
              <label className="inline-label">
                <span>Departure date</span>
                <input type="date" />
              </label>
              <label className="inline-label">
                <span>Departure time</span>
                <input type="time" />
              </label>
              <textarea placeholder="Purpose of travel" rows="3" />
              <select defaultValue="">
                <option value="" disabled>
                  Type of trip
                </option>
                <option value="one-way">One way</option>
                <option value="round-trip">Round trip</option>
                <option value="multi-city">Multi city</option>
              </select>
            </div>
          </section>

          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">🏨</div>
              <div>
                <h2>Accommodation & Transportation</h2>
                <p className="muted">Hotel and ride preferences</p>
              </div>
            </div>
            <div className="field-grid">
              <div className="radio-row">
                <span>Hotel accommodation?</span>
                <label>
                  <input type="radio" name="hotel" /> Yes
                </label>
                <label>
                  <input type="radio" name="hotel" /> No
                </label>
              </div>
              <select defaultValue="">
                <option value="" disabled>
                  Preferred mode of transportation
                </option>
                <option value="plane">Plane</option>
                <option value="train">Train</option>
                <option value="car">Car</option>
                <option value="bus">Bus</option>
              </select>
              <input type="text" placeholder="If other, write name" />
              <textarea placeholder="Special requests" rows="3" />
            </div>
          </section>

          <section className="field-group">
            <div className="field-heading">
              <div className="heading-icon">📄</div>
              <div>
                <h2>Approval & Attachments</h2>
                <p className="muted">Upload approvals or share notes</p>
              </div>
            </div>
            <div className="field-grid">
              <label className="file-field">
                <span>Superior Approval File/Photo</span>
                <input type="file" />
              </label>
              <textarea placeholder="Additional notes" rows="4" />
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-primary">
              Submit Request
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
