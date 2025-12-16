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

const initialCreate = {
  name: '',
  dept_job_position: '',
  role: 'user',
  nik: '',
  phone: '',
  email: '',
  password: '',
}

function OfficeManageUser() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(initialCreate)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  const [selectedUser, setSelectedUser] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')

  const token = localStorage.getItem('authToken')

  const handleNavigate = (item) => {
    if (item === 'Dashboard') navigate('/office/home')
    if (item === 'Ticket Requests') navigate('/office/ticket-requests')
    if (item === 'Driver Requests') navigate('/office/driver-requests')
    if (item === 'Ticket History') navigate('/office/ticket-history')
    if (item === 'Driver History') navigate('/office/driver-history')
    if (item === 'Travel Accommodation') navigate('/office/travel-accommodation')
    if (item === 'Assign Drivers') navigate('/office/assign-drivers')
    if (item === 'Manage User') navigate('/office/manage-user')
  }

  const loadUsers = async () => {
    if (!token) {
      setLoading(false)
      setError('Authentication token not found.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:8000/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let detail = 'Failed to load users.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setError(detail)
        setUsers([])
      } else {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      setError('Network error. Please try again.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateChange = (field) => (event) => {
    setCreateForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleEditChange = (field) => (event) => {
    setEditForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    setEditForm({
      name: user.name || '',
      dept_job_position: user.dept_job_position || '',
      role: user.role || 'user',
      nik: user.nik || '',
      phone: user.phone || '',
      email: user.email || '',
    })
    setEditError('')
    setEditSuccess('')
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!token) return

    setCreateLoading(true)
    setCreateError('')
    setCreateSuccess('')

    try {
      const res = await fetch('http://localhost:8000/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        let detail = 'Failed to create user.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setCreateError(detail)
      } else {
        setCreateSuccess('User account created successfully.')
        setCreateForm(initialCreate)
        setShowCreate(false)
        await loadUsers()
      }
    } catch (err) {
      setCreateError('Network error. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleUpdate = async (event) => {
    event.preventDefault()
    if (!token || !selectedUser) return

    setEditLoading(true)
    setEditError('')
    setEditSuccess('')

    try {
      const res = await fetch(`http://localhost:8000/users/${selectedUser.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        let detail = 'Failed to update user.'
        try {
          const data = await res.json()
          if (data?.detail) detail = data.detail
        } catch {
          // ignore parse error
        }
        setEditError(detail)
      } else {
        setEditSuccess('User updated successfully.')
        await loadUsers()
      }
    } catch (err) {
      setEditError('Network error. Please try again.')
    } finally {
      setEditLoading(false)
    }
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
                className={`sidebar-item ${item === 'Manage User' ? 'active' : ''}`}
                onClick={() => handleNavigate(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="office-content">
          <header className="office-header">
            <p className="eyebrow">Manage User</p>
            <h1>Manage Users</h1>
            <p className="muted">Create new accounts and update existing user profiles</p>
          </header>

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Close Create Form' : 'Create Account'}
            </button>
          </div>

          {showCreate ? (
            <form className="ticket-form" onSubmit={handleCreate}>
              <section className="field-group">
                <div className="field-heading">
                  <div className="heading-icon">+</div>
                  <div>
                    <h2>Create Account</h2>
                    <p className="muted">Create a new Firebase account and user profile</p>
                  </div>
                </div>
                <div className="field-grid">
                  <label className="inline-label">
                    <span>Nama User</span>
                    <input
                      placeholder="Nama User"
                      value={createForm.name}
                      onChange={handleCreateChange('name')}
                      required
                    />
                  </label>
                  <label className="inline-label">
                    <span>User Dept/Job Position</span>
                    <input
                      placeholder="User Dept/Job Position"
                      value={createForm.dept_job_position}
                      onChange={handleCreateChange('dept_job_position')}
                      required
                    />
                  </label>
                  <label className="inline-label">
                    <span>Role</span>
                    <select value={createForm.role} onChange={handleCreateChange('role')} required>
                      <option value="user">user</option>
                      <option value="driver">driver</option>
                      <option value="office_coordinator">office_coordinator</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </label>
                  <label className="inline-label">
                    <span>NIK</span>
                    <input placeholder="NIK" value={createForm.nik} onChange={handleCreateChange('nik')} required />
                  </label>
                  <label className="inline-label">
                    <span>Phone</span>
                    <input placeholder="Phone" value={createForm.phone} onChange={handleCreateChange('phone')} required />
                  </label>
                  <label className="inline-label">
                    <span>Email</span>
                    <input
                      type="email"
                      placeholder="Email"
                      value={createForm.email}
                      onChange={handleCreateChange('email')}
                      required
                    />
                  </label>
                  <label className="inline-label">
                    <span>Password</span>
                    <input
                      type="password"
                      placeholder="Password (min 6 chars)"
                      value={createForm.password}
                      onChange={handleCreateChange('password')}
                      required
                    />
                  </label>
                </div>
              </section>

              {createSuccess ? <p className="success-text">{createSuccess}</p> : null}
              {createError ? <p className="error-text">{createError}</p> : null}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          ) : null}

          {selectedUser && editForm ? (
            <form className="ticket-form" onSubmit={handleUpdate}>
              <section className="field-group">
                <div className="field-heading">
                  <div className="heading-icon">ED</div>
                  <div>
                    <h2>Edit User</h2>
                  </div>
                </div>
                <div className="field-grid">
                  <label className="inline-label">
                    <span>Nama User</span>
                    <input placeholder="Nama User" value={editForm.name} onChange={handleEditChange('name')} required />
                  </label>
                  <label className="inline-label">
                    <span>User Dept/Job Position</span>
                    <input
                      placeholder="User Dept/Job Position"
                      value={editForm.dept_job_position}
                      onChange={handleEditChange('dept_job_position')}
                      required
                    />
                  </label>
                  <label className="inline-label">
                    <span>Role</span>
                    <select value={editForm.role} onChange={handleEditChange('role')} required>
                      <option value="user">user</option>
                      <option value="driver">driver</option>
                      <option value="office_coordinator">office_coordinator</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </label>
                  <label className="inline-label">
                    <span>NIK</span>
                    <input placeholder="NIK" value={editForm.nik} onChange={handleEditChange('nik')} required />
                  </label>
                  <label className="inline-label">
                    <span>Phone</span>
                    <input placeholder="Phone" value={editForm.phone} onChange={handleEditChange('phone')} required />
                  </label>
                  <label className="inline-label">
                    <span>Email</span>
                    <input
                      type="email"
                      placeholder="Email"
                      value={editForm.email}
                      onChange={handleEditChange('email')}
                      required
                    />
                  </label>
                </div>
              </section>

              {editSuccess ? <p className="success-text">{editSuccess}</p> : null}
              {editError ? <p className="error-text">{editError}</p> : null}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => {
                    setSelectedUser(null)
                    setEditForm(null)
                    setEditError('')
                    setEditSuccess('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th>Nama User</th>
                  <th>User Dept/Job Position</th>
                  <th>Role</th>
                  <th>NIK</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="muted">
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" className="error-text">
                      {error}
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.uid}
                      style={{ background: selectedUser?.uid === user.uid ? '#f5e6f2' : undefined }}
                    >
                      <td>{user.name || '-'}</td>
                      <td>{user.dept_job_position || '-'}</td>
                      <td>{user.role || '-'}</td>
                      <td>{user.nik || '-'}</td>
                      <td>{user.phone || '-'}</td>
                      <td>{user.email || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={(event) => {
                            handleSelectUser(user)
                          }}
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default OfficeManageUser
