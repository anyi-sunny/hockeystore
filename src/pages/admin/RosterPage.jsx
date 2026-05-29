import { useState } from 'react'
import { UserPlus, Pencil, Trash2, Check, X, Copy, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '../../contexts/DataContext'

export default function RosterPage() {
  const { roster, activeStore, addPlayer, updatePlayer, removePlayer, orders } = useData()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const sorted = [...roster].sort((a, b) => a.name.localeCompare(b.name))

  async function add(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      const p = await addPlayer(name)
      setNewName('')
      toast.success(`Added ${name}${p?.code ? ` · code ${p.code}` : ''}`)
    } catch (err) { toast.error(err.message || 'Could not add player.') }
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

  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); toast.success(label) }
    catch { toast.error('Copy failed — your browser blocked clipboard access.') }
  }

  function copyAll() {
    const lines = sorted.map((p) => `${p.name}: ${p.code ?? '—'}`)
    const text =
      `Bowdoin Women's Hockey — ${activeStore?.name ?? 'Lulu Order'} access codes\n` +
      `Sign in at the team store with your code. Players: use yours. ` +
      `Family & friends: ask your player to share theirs.\n\n` +
      lines.join('\n')
    copy(text, 'Code list copied — paste it to share with the team')
  }

  const orderCount = (playerId) => orders.filter((o) => o.playerId === playerId).length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h1 className="text-2xl font-bold">Team Roster</h1>
        <button onClick={copyAll} disabled={sorted.length === 0} className="btn btn-ghost btn-sm">
          <ClipboardList size={15} /> Copy code list
        </button>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        Each player gets a private access code (auto-generated). Share the list with the team —
        players sign in with their own code, and family/friends use the player's code. Use full
        names so self-ordering name checks line up.
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
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
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
                  <span className="flex-1 min-w-0 truncate">{p.name}</span>
                  <button onClick={() => copy(p.code ?? '', `${p.name}'s code copied`)}
                    disabled={!p.code}
                    title="Copy code"
                    className="inline-flex items-center gap-1.5 font-mono text-sm tracking-widest bg-stone-100 hover:bg-brand-50 text-stone-700 rounded-md px-2 py-1 transition-colors cursor-pointer disabled:opacity-50">
                    {p.code ?? '——————'} <Copy size={13} className="text-stone-400" />
                  </button>
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
