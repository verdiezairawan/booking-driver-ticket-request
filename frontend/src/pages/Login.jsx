import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

const roleRouteMap = {
  user: '/user/home',
  driver: '/driver/home',
  office_coordinator: '/office/home',
  superadmin: '/admin/home',
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const token = await userCredential.user.getIdToken(true)

      localStorage.setItem('authToken', token)

      const response = await fetch('http://localhost:8000/users/me', {
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
      setError(err?.message || 'Login failed. Please check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-logo">
          <div className="login-logo__circle">
            <span>APP LOGO</span>
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
