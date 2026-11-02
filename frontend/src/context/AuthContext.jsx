import { useEffect, useState } from 'react'
import { API_URL, apiRequest } from '../api'
import AuthContext from './authState'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('access_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function checkAuth() {
      if (!token) {
        if (active) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      try {
        const currentUser = await apiRequest('/api/auth/me', { token })
        if (active) setUser(currentUser)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('token_type')
        if (active) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    checkAuth()
    return () => {
      active = false
    }
  }, [token])

  async function login(email, password) {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || 'Login failed.')
    }

    const currentUser = await apiRequest('/api/auth/me', {
      token: data.access_token,
    })

    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('token_type', data.token_type)
    setUser(currentUser)
    setToken(data.access_token)
    setLoading(false)

    return { ...data, ...currentUser }
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
