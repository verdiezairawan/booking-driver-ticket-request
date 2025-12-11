import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

function MainLayout({ title, children }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    localStorage.removeItem('authToken')

    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error during sign out', error)
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="layout">
      <header className="navbar">
        <div className="navbar__brand">
          <span className="navbar__title">Booking Driver</span>
          {title ? <span className="navbar__subtitle">{title}</span> : null}
        </div>
        <button type="button" className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <main className="layout__content">
        {children ? children : <div className="content-placeholder" />}
      </main>
    </div>
  )
}

export default MainLayout
