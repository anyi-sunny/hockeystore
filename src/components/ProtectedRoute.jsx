import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/" replace />
  if (adminOnly && session.role !== 'admin') return <Navigate to="/shop" replace />
  return children
}
