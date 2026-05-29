import { useState } from 'react'
import { UserPlus, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '../../contexts/DataContext'

export default function RosterPage() {
  const { roster, addPlayer, updatePlayer, removePlayer, orders } = useData()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const sorted = [...roster].sort((a, b) => a.name.localeCompare(b.name))

  async function add(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try { await addPlayer(name); setNewName(''); toast.success(`Added ${name}`) }
    catch (err) { toast.error(err.message || 'Could not add player.') }
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditName(p.name)
  }

  async function saveEdit(id) {
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    try { await updatePlayer(id, name); toast.success('Player updated') }
    catch (err) { toast.error(err.message || 'Could not update player.') }
    setEditingId(null)
  }

  async function remove(p, count) {
    if (count > 0) {
      if (!confirm(`${p.name} has ${count} order(s). Remove anyway?`)) return
    } else if (!confirm(`Remove ${p.name}?`)) return
    try { await removePlayer(p.id); toast.success(`Removed ${p.name}`) }
    catch (err) { toast.error(err.message || 'Could not remove player.') }
  }

  const orderCount = (playerId) => orders.filter((o) => o.playerId === playerId).length

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Team Roster</h1>
      <p className="text-stone-500 text-sm mb-6">
        Players added here appear in the sign-in list. Buyers choose a player to pick up
        their order. Use players' full names so self-ordering name checks line up.
      </p>

      <form onSubmit={add} className="flex gap-2 mb-6">
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a player by full name…"
          className="input flex-1" />
        <button type="submit" className="btn btn-primary"><UserPlus size={16} /> Add</button>
      </form>

      <div className="card divide-y divide-stone-100">
        {sorted.length === 0 && <p className="p-4 text-stone-500 text-sm">No players yet.</p>}
        {sorted.map((p) => {
          const count = orderCount(p.id)
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              {editingId === p.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                    className="input flex-1 py-1" />
                  <button onClick={() => saveEdit(p.id)} className="btn btn-success btn-sm"><Check size={14} /> Save</button>
                  <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1">{p.name}</span>
                  {count > 0 && (
                    <span className="text-xs text-stone-400">{count} order{count === 1 ? '' : 's'}</span>
                  )}
                  <button onClick={() => startEdit(p)}
                    className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => remove(p, count)}
                    className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer">
                    <Trash2 size={14} /> Remove
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-stone-400 mt-3">{roster.length} players on the roster.</p>
    </div>
  )
}
