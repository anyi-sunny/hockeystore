import { useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Snowflake, LogOut, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import AdminLoginModal from './AdminLoginModal'

export default function Header() {
  const { session, logout } = useAuth()
  const { roster, activeStore } = useData()
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()

  const player = session?.role === 'player' ? roster.find(p => p.id === session.playerId) : null
  const onLoginPage = loc.pathname === '/'

  function handleLogout() {
    logout()
    nav('/')
  }

  return (
    <header className="bg-gradient-to-r from-stone-900 via-stone-900 to-brand-950 text-white shadow-md">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <Link
          to={session ? (session.role === 'admin' ? '/admin/dashboard' : '/shop') : '/'}
          className="flex items-center gap-2.5 group"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600 group-hover:bg-brand-500 transition-colors">
            <Snowflake size={18} />
          </span>
          <span className="font-semibold tracking-wide flex flex-col leading-tight">
            <span className="text-[10px] text-stone-400">BOWDOIN WOMEN'S HOCKEY</span>
            <span className="group-hover:text-brand-200 transition-colors">{(activeStore?.name ?? 'Lulu Order').toUpperCase()}</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          {session?.role === 'player' && (
            <>
              <HeaderLink to="/shop">Shop</HeaderLink>
              <HeaderLink to="/summary">My Order</HeaderLink>
              <span className="text-stone-300 text-sm hidden sm:inline ml-1 mr-1">
                {session.buyerName}{player && session.buyerName !== player.name ? ` → ${player.name}` : ''}
              </span>
              <SignOut onClick={handleLogout} />
            </>
          )}
          {session?.role === 'admin' && (
            <>
              <HeaderLink to="/admin/dashboard">Dashboard</HeaderLink>
              <HeaderLink to="/admin/roster">Roster</HeaderLink>
              <HeaderLink to="/shop">Shop</HeaderLink>
              <span className="text-stone-300 text-sm hidden md:inline ml-1 mr-1">Admin · {session.email}</span>
              <SignOut onClick={handleLogout} />
            </>
          )}
          {!session && onLoginPage && (
            <button
              onClick={() => setShowAdminLogin(true)}
              className="inline-flex items-center gap-1.5 text-sm border border-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-800 hover:border-stone-500 transition-colors cursor-pointer"
            >
              <Lock size={14} /> Admin login
            </button>
          )}
        </nav>
      </div>
      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} />}
    </header>
  )
}

function SignOut({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-stone-300 hover:text-white hover:bg-stone-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
    >
      <LogOut size={14} /> Sign out
    </button>
  )
}

function HeaderLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
          isActive
            ? 'text-white font-medium bg-white/10'
            : 'text-stone-300 hover:text-white hover:bg-stone-800'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
