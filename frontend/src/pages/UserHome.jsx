import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../components/MainLayout'

function UserHome() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: '' })
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('authToken')
      if (!token) {
        setLoadingProfile(false)
        return
      }
      try {
        const response = await fetch('http://localhost:8000/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

    fetchProfile()
  }, [])

  const handleTicketRequest = () => {
    navigate('/user/ticket-request')
  }

  const handleTicketHistory = () => {
    navigate('/user/ticket-history')
  }

  return (
    <MainLayout title="Dashboard User">
      <div className="user-dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Halo, {profile.name || (loadingProfile ? '...' : 'User')}</h1>
            <p className="muted">Ringkasan perjalanan dan booking kamu</p>
          </div>
        </div>

        <section className="stats-section">
          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-icon stat-icon-blue">T</div>
              <div>
                <p className="stat-label">Ticket Pending</p>
                <p className="stat-value">0</p>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-icon-green">D</div>
              <div>
                <p className="stat-label">Driver Pending</p>
                <p className="stat-value">0</p>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-icon-amber">B</div>
              <div>
                <p className="stat-label">Booking Active</p>
                <p className="stat-value">0</p>
              </div>
            </article>
          </div>
        </section>

        <section className="menu-section">
          <div className="section-heading">
            <div className="heading-icon">#</div>
            <div>
              <h2>Main menu</h2>
              <p className="muted">Pilih layanan yang kamu butuhkan</p>
            </div>
          </div>

          <div className="actions-grid">
            <article className="action-card action-primary">
              <div className="action-icon">+</div>
              <div className="action-content">
                <h3>Make a Ticket Request</h3>
                <p className="muted">
                  Ajukan permintaan untuk perjalanan dinas atau kebutuhan lainnya
                </p>
                <button className="link-cta" type="button" onClick={handleTicketRequest}>
                  Make Request →
                </button>
              </div>
            </article>

            <article className="action-card action-success">
              <div className="action-icon">+</div>
              <div className="action-content">
                <h3>Make a Booking Driver</h3>
                <p className="muted">
                  Pesan driver untuk keperluan perjalanan dinas atau operasional
                </p>
                <button className="link-cta success" type="button">
                  Make Request →
                </button>
              </div>
            </article>

            <article className="action-card action-plain">
              <div className="action-icon icon-soft">T</div>
              <div className="action-content">
                <h3>Ticket History</h3>
                <p className="muted">Lihat semua permintaan tiket kamu</p>
                <button className="link-cta" type="button" onClick={handleTicketHistory}>
                  View →
                </button>
              </div>
            </article>

            <article className="action-card action-plain">
              <div className="action-icon icon-soft">D</div>
              <div className="action-content">
                <h3>Driver History</h3>
                <p className="muted">Lihat semua riwayat booking driver</p>
                <button className="link-cta" type="button">
                  View →
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default UserHome
