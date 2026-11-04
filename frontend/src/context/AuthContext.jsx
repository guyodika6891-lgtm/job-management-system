import { useEffect, useState } from 'react'
import { API_URL, apiRequest } from '../api'
import AuthContext from './authState'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(
    localStorage.getItem('access_token') || sessionStorage.getItem('access_token'),
  )
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
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('token_type')
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

  async function establishSession(data, rememberMe) {
    const currentUser = await apiRequest('/api/auth/me', {
      token: data.access_token,
    })

    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('token_type')
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem('access_token', data.access_token)
    storage.setItem('token_type', data.token_type)
    setUser(currentUser)
    setToken(data.access_token)
    setLoading(false)

    return { ...data, ...currentUser }
  }

  async function login(email, password, rememberMe = false) {
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

    return establishSession(data, rememberMe)
  }

  async function loginWithGoogle(credential, rememberMe = false) {
    const data = await apiRequest('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
    return establishSession(data, rememberMe)
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_type')
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('token_type')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
