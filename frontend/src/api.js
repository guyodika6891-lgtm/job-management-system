const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000')
  .replace(/\/+$/, '')

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {})

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error('The request could not be completed.')
    }
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const detail = data?.detail
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(', ')
      : detail || (typeof data === 'string' ? data : null)
    throw new Error(message || `Request failed (${response.status}).`)
  }

  return data
}

export async function downloadFile(path, filename, token) {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.detail || 'File download failed.')
  }

  const objectUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export { API_URL }
