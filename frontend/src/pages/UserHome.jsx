import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function UserHome() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: '' })
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [stats, setStats] = useState({
    ticketPending: 0,
    bookingPending: 0,
    bookingActive: 0,
  })

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      setLoadingProfile(false)
      return
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:8000/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setProfile({ name: data.name || data.email || '' })
        }
      } catch (error) {
        console.error('Failed to load profile', error)
      } finally {
        setLoadingProfile(false)
      }
    }

    const fetchStats = async () => {
      try {
        const [ticketsRes, bookingsRes] = await Promise.all([
          fetch('http://localhost:8000/tickets/my', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('http://localhost:8000/bookings/my', { headers: { Authorization: `Bearer ${token}` } }),
        ])

        let ticketPending = 0
        let bookingPending = 0
        let bookingActive = 0

        if (ticketsRes.ok) {
          const tickets = await ticketsRes.json()
          ticketPending = Array.isArray(tickets)
            ? tickets.filter((t) => (t.status || '').toLowerCase() === 'pending').length
            : 0
        }

        if (bookingsRes.ok) {
          const bookings = await bookingsRes.json()
          if (Array.isArray(bookings)) {
            bookingPending = bookings.filter((b) => (b.status || '').toLowerCase() === 'pending').length
            bookingActive = bookings.filter((b) => (b.status || '').toLowerCase() === 'approved').length
          }
        }

        setStats({ ticketPending, bookingPending, bookingActive })
      } catch (error) {
        console.error('Failed to load stats', error)
      }
    }

    fetchProfile()
    fetchStats()
  }, [])

  const handleTicketRequest = () => {
    navigate('/user/ticket-request')
  }

  const handleTicketHistory = () => {
    navigate('/user/ticket-history')
  }

  const handleBookingDriver = () => {
    navigate('/user/booking-driver')
  }

  const handleBookingHistory = () => {
    navigate('/user/booking-history')
  }

  const handleCardKeyDown = (event, action) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  return (
    <MainLayout title="User Dashboard">
      <div className="user-dashboard">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">User Dashboard</p>
            <h1>Hello, {profile.name || (loadingProfile ? '...' : 'User')}</h1>
            <p className="muted">Summary of your trips and bookings</p>
          </div>
        </div>

        <section className="stats-section">
          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-icon stat-icon-blue">T</div>
              <div>
                <p className="stat-label">Pending Tickets</p>
                <p className="stat-value">{stats.ticketPending}</p>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-icon-green">D</div>
              <div>
                <p className="stat-label">Pending Bookings</p>
                <p className="stat-value">{stats.bookingPending}</p>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-icon-amber">B</div>
              <div>
                <p className="stat-label">Active Bookings</p>
                <p className="stat-value">{stats.bookingActive}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="menu-section">
          <div className="section-heading">
            <div className="heading-icon">#</div>
            <div>
              <h2>Main Menu</h2>
              <p className="muted">Choose the service you need</p>
            </div>
          </div>

          <div className="actions-grid">
            <article
              className="action-card action-primary is-clickable"
              role="link"
              tabIndex={0}
              onClick={handleTicketRequest}
              onKeyDown={(event) => handleCardKeyDown(event, handleTicketRequest)}
            >
              <div className="action-icon">+</div>
              <div className="action-content">
                <h3>Make a Ticket Request</h3>
                <p className="muted">Submit a ticket request for business or travel needs</p>
                <span className="link-cta">
                  Make Request <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </article>

            <article
              className="action-card action-success is-clickable"
              role="link"
              tabIndex={0}
              onClick={handleBookingDriver}
              onKeyDown={(event) => handleCardKeyDown(event, handleBookingDriver)}
            >
              <div className="action-icon">+</div>
              <div className="action-content">
                <h3>Book a Driver</h3>
                <p className="muted">Request a driver for business travel or operational needs</p>
                <span className="link-cta success">
                  Make Request <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </article>

            <article
              className="action-card action-plain is-clickable"
              role="link"
              tabIndex={0}
              onClick={handleTicketHistory}
              onKeyDown={(event) => handleCardKeyDown(event, handleTicketHistory)}
            >
              <div className="action-icon icon-soft">T</div>
              <div className="action-content">
                <h3>Ticket History</h3>
                <p className="muted">View all your ticket requests</p>
                <span className="link-cta">
                  View <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </article>

            <article
              className="action-card action-plain is-clickable"
              role="link"
              tabIndex={0}
              onClick={handleBookingHistory}
              onKeyDown={(event) => handleCardKeyDown(event, handleBookingHistory)}
            >
              <div className="action-icon icon-soft">D</div>
              <div className="action-content">
                <h3>Driver History</h3>
                <p className="muted">View all your driver bookings</p>
                <span className="link-cta">
                  View <span aria-hidden="true">&rarr;</span>
                </span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default UserHome
