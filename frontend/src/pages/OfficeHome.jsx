import { useEffect, useState } from 'react'
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

const actionConfig = [
  { label: 'Pending Tickets', type: 'ticketPending', icon: '🎟️' },
  { label: 'Approved Travel', type: 'ticketApproved', icon: '✅' },
  { label: 'Rejected Travel', type: 'ticketRejected', icon: '🚫' },
  { label: 'Pending Bookings', type: 'bookingPending', icon: '🚗' },
  { label: 'Rejected Drivers', type: 'bookingRejected', icon: '⛔' },
  { label: 'Completed Drivers', type: 'bookingCompleted', icon: '✔️' },
]

function OfficeHome() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: '' })
  const [stats, setStats] = useState({
    ticketPending: 0,
    ticketApproved: 0,
    ticketRejected: 0,
    bookingPending: 0,
    bookingApproved: 0,
    bookingRejected: 0,
    bookingCompleted: 0,
  })

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) return

    const loadProfile = async () => {
      try {
        const res = await fetch('http://localhost:8000/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setProfile({ name: data.name || data.email || 'User' })
        }
      } catch (err) {
        console.error('Failed to load profile', err)
      }
    }

    const loadStats = async () => {
      try {
        const [ticketRes, bookingRes] = await Promise.all([
          fetch('http://localhost:8000/tickets/stats', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:8000/bookings/stats', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        const ticketData = ticketRes.ok ? await ticketRes.json() : {}
        const bookingData = bookingRes.ok ? await bookingRes.json() : {}

        setStats({
          ticketPending: ticketData.pending || 0,
          ticketApproved: ticketData.approved || 0,
          ticketRejected: ticketData.rejected || 0,
          bookingPending: bookingData.pending || 0,
          bookingApproved: bookingData.approved || 0,
          bookingRejected: bookingData.rejected || 0,
          bookingCompleted: bookingData.completed || 0,
        })
      } catch (err) {
        console.error('Failed to load stats', err)
      }
    }

    loadProfile()
    loadStats()
  }, [])

  const handleNavigate = (item) => {
    if (item === 'Dashboard') navigate('/office/home')
    if (item === 'Ticket Requests') navigate('/office/ticket-requests')
    if (item === 'Driver Requests') navigate('/office/driver-requests')
    if (item === 'Ticket History') navigate('/office/ticket-history')
    if (item === 'Driver History') navigate('/office/driver-history')
    if (item === 'Travel Accommodation') navigate('/office/travel-accommodation')
    if (item === 'Assign Drivers') navigate('/office/assign-drivers')
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
                className={`sidebar-item ${item === 'Dashboard' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="office-content">
          <header className="office-header">
            <p className="eyebrow">Dashboard</p>
            <h1>Hello, {profile.name || 'Coordinator'}!</h1>
            <p className="muted">Manage ticket requests and driver bookings</p>
          </header>

          <div className="office-actions">
            {actionConfig.map((action) => (
              <div key={action.label} className="office-card">
                <div className="office-card__left">
                  <span className="office-card__icon">{action.icon}</span>
                </div>
                <div className="office-card__text">
                  <span className="office-card__label">{action.label}</span>
                  <span className="office-card__countPlain">{stats[action.type] ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeHome
