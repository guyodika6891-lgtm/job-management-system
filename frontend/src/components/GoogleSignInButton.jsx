import { useEffect, useRef } from 'react'

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function GoogleSignInButton({ onCredential, disabled = false, onError }) {
  const buttonRef = useRef(null)
  const callbacksRef = useRef({ onCredential, onError })

  useEffect(() => {
    callbacksRef.current = { onCredential, onError }
  }, [onCredential, onError])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return undefined

    let active = true
    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`)
    const initialize = () => {
      if (!active || !buttonRef.current || !window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (!response.credential) {
            callbacksRef.current.onError?.('Google did not return a sign-in credential. Please try again.')
            return
          }
          callbacksRef.current.onCredential(response.credential)
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: Math.min(buttonRef.current.clientWidth || 320, 420),
        logo_alignment: 'left',
      })
    }

    const handleScriptError = () => {
      if (active) callbacksRef.current.onError?.('Google sign-in could not load. Check your connection and try again.')
    }

    if (window.google?.accounts?.id) {
      initialize()
    } else {
      if (!script) {
        script = document.createElement('script')
        script.src = GOOGLE_SCRIPT_URL
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      script.addEventListener('load', initialize)
      script.addEventListener('error', handleScriptError)
    }

    return () => {
      active = false
      script?.removeEventListener('load', initialize)
      script?.removeEventListener('error', handleScriptError)
    }
  }, [])

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="google-setup-notice" role="status">
        Google sign-in needs matching OAuth client IDs in VITE_GOOGLE_CLIENT_ID and backend GOOGLE_CLIENT_ID.
      </p>
    )
  }

  return (
    <div
      className={`google-signin-button${disabled ? ' disabled' : ''}`}
      ref={buttonRef}
      aria-label="Sign in with Google"
      aria-disabled={disabled}
    />
  )
}

export default GoogleSignInButton
