import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { API_BASE_URL, APP_NAME } from '../config'

const roleRouteMap = {
  user: '/user/home',
  driver: '/driver/home',
  office_coordinator: '/office/home',
  superadmin: '/admin/home',
}

const LOGO_SOURCES = ['/app-logo-blue.png', '/app-logo-black.png', '/app-logo-white.png', '/app-logo.png']

// Map Firebase Auth errors into user-friendly login messages.
const getLoginErrorMessage = (err) => {
  const code = err?.code
  if (code === 'auth/invalid-credential') {
    return 'Invalid email or password. If this account was imported, please ask an administrator to reset the password.'
  }
  if (code === 'auth/user-disabled') {
    return 'Your account has been disabled. Please contact an administrator.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many login attempts. Please try again later.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Please try again.'
  }
  if (err?.message) {
    return err.message
  }
  return 'Login failed. Please check your email and password.'
}

// Login page for all roles; redirects after fetching the user's role.
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoIndex, setLogoIndex] = useState(0)

  const navigate = useNavigate()

  // Set a consistent document title for the login page.
  useEffect(() => {
    document.title = `Login | ${APP_NAME}`
  }, [])

  // Sign in with Firebase and fetch the role from the API.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password)
      const token = await userCredential.user.getIdToken(true)

      localStorage.setItem('authToken', token)

      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let detail = 'Failed to fetch user role'
        try {
          const data = await response.json()
          if (data?.detail) {
            detail = data.detail
          }
        } catch (e) {
          // ignore parse error
        }
        throw new Error(detail)
      }

      const data = await response.json()
      const destination = roleRouteMap[data.role] || '/login'

      navigate(destination, { replace: true })
    } catch (err) {
      console.error('Login error', err)
      localStorage.removeItem('authToken')
      setError(getLoginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-logo">
          <div className="login-logo__circle">
            {LOGO_SOURCES[logoIndex] ? (
              <img
                className="login-logo__image"
                src={LOGO_SOURCES[logoIndex]}
                alt={APP_NAME}
                onError={() => setLogoIndex((prev) => prev + 1)}
              />
            ) : (
              <span className="login-logo__fallback">APP LOGO</span>
            )}
          </div>
        </div>

        <div className="login-card login-card-branded">
          <h1 className="login-title">LOGIN</h1>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="********"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} aria-hidden="true" />
                </button>
              </div>
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
