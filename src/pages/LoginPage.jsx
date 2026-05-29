import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'

// Normalize names for comparison: lowercase, trim, collapse internal whitespace.
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export default function LoginPage() {
  const { loginAsPlayer } = useAuth()
  const { roster, activeStore } = useData()
  const nav = useNavigate()

  const [buyerName, setBuyerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [forSomeoneElse, setForSomeoneElse] = useState(false)
  const [err, setErr] = useState('')

  const sortedRoster = [...roster].sort((a, b) => a.name.localeCompare(b.name))

  function submit(e) {
    e.preventDefault()
    setErr('')
    const name = buyerName.trim()

    // Require a first and last name (at least two words).
    if (name.split(/\s+/).filter(Boolean).length < 2) {
      setErr('Please enter your first and last name.')
      return
    }
    if (!playerId) {
      setErr('Please select the team player this order is for.')
      return
    }
    // Ordering for yourself → your name must match the selected player exactly.
    if (!forSomeoneElse) {
      const player = roster.find((p) => p.id === playerId)
      if (player && norm(name) !== norm(player.name)) {
        setErr(
          `That name doesn't match "${player.name}". If you're picking up for someone else, ` +
          `check the box above — otherwise enter the player's name exactly.`
        )
        return
      }
    }
    loginAsPlayer(playerId, name, !forSomeoneElse)
    nav('/shop')
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white ring-2 ring-brand-500 mb-3 shadow-md p-1.5">
          <img src="/logo.png" alt="Bowdoin Hockey logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-bold">Bowdoin Women's Hockey</h1>
        <p className="text-stone-600 mt-1">{activeStore?.name ?? 'Lululemon Team Order'}</p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-1">Sign in to order</h2>
        <p className="text-sm text-stone-500 mb-5">
          Enter your full name, then pick the player on the team this order is being picked
          up under. Family &amp; friends can order on a player's behalf.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Your full name</label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="First and last name"
              className="input"
              autoFocus
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forSomeoneElse}
              onChange={(e) => setForSomeoneElse(e.target.checked)}
              className="accent-brand-600 w-4 h-4 cursor-pointer"
            />
            I'm ordering on behalf of a team player (family / friend)
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">
              {forSomeoneElse ? 'Player to pick up the order' : 'Which player are you?'}
            </label>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="select"
            >
              <option value="">Select a player…</option>
              {sortedRoster.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {roster.length === 0 && (
              <p className="text-amber-600 text-sm mt-1">
                No players on the roster yet — ask an admin to add the team roster.
              </p>
            )}
          </div>

          {err && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
          )}

          <button type="submit" className="btn btn-primary btn-lg w-full">
            <ShoppingBag size={18} />
            Continue to shop
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-stone-400 mt-4">
        Admins can sign in using the link in the top-right corner.
      </p>
    </div>
  )
}
