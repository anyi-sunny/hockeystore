import { createContext, useContext } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const AuthContext = createContext(null)

// Shared admin password — passed verbally to admins. Change here if it leaks.
export const ADMIN_PASSWORD = 'bowdoinhockey2026'

export function AuthProvider({ children }) {
  const [session, setSession] = useLocalStorage('auth.session', null)

  // isSelf = the buyer is the team player themselves (vs. a family/friend ordering for them).
  function loginAsPlayer(playerId, buyerName, isSelf) {
    setSession({ role: 'player', playerId, buyerName, isSelf: !!isSelf })
  }

  function loginAsAdmin(email, password) {
    if (!email || !email.includes('@')) {
      return { ok: false, error: 'Please enter a valid email.' }
    }
    if (password !== ADMIN_PASSWORD) {
      return { ok: false, error: 'Incorrect password.' }
    }
    // Stored so the data layer can authorize admin writes to the API.
    setSession({ role: 'admin', email, adminPassword: password })
    return { ok: true }
  }

  function logout() {
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loginAsPlayer, loginAsAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
