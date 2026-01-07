import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { APP_NAME } from '../config'

function MainLayout({ title, children }) {
  const navigate = useNavigate()

  useEffect(() => {
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    document.title = trimmedTitle ? `${trimmedTitle} | ${APP_NAME}` : APP_NAME
  }, [title])

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
          <span className="navbar__title">{APP_NAME}</span>
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
