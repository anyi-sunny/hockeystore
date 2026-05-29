import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider, useData } from './contexts/DataContext'
import { apiConfigured } from './api'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import ShopPage from './pages/ShopPage'
import OrderSummaryPage from './pages/OrderSummaryPage'
import RosterPage from './pages/admin/RosterPage'
import DashboardPage from './pages/admin/DashboardPage'

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Toaster richColors position="top-center" />
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
            <Gate>
              <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
                <Route path="/summary" element={<ProtectedRoute><OrderSummaryPage /></ProtectedRoute>} />
                <Route path="/admin/roster" element={<ProtectedRoute adminOnly><RosterPage /></ProtectedRoute>} />
                <Route path="/admin/dashboard" element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Gate>
          </main>
        </div>
      </DataProvider>
    </AuthProvider>
  )
}

// Blocks rendering until the initial data load finishes, and surfaces
// connection/config problems instead of rendering empty pages.
function Gate({ children }) {
  const { loading, error, refresh } = useData()

  if (!apiConfigured) {
    return (
      <Notice title="Backend not configured">
        <code className="text-xs">VITE_API_URL</code> is not set. Deploy the backend
        (<code className="text-xs">cd infra &amp;&amp; npm run deploy</code>) and add the
        API URL to <code className="text-xs">.env</code>, then restart the dev server.
      </Notice>
    )
  }
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-500 gap-3">
        <span className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        Loading…
      </div>
    )
  }
  if (error) {
    return (
      <Notice title="Couldn't reach the server">
        {error}
        <button onClick={refresh} className="btn btn-ghost btn-sm mt-3">Try again</button>
      </Notice>
    )
  }
  return children
}

function Notice({ title, children }) {
  return (
    <div className="max-w-md mx-auto mt-12 bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900">
      <p className="font-semibold mb-1">{title}</p>
      <div>{children}</div>
    </div>
  )
}
