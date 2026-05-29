import { useState } from 'react'
import { Upload } from 'lucide-react'
import { api } from '../api'
import { useData } from '../contexts/DataContext'

const BLANK = {
  name: '',
  price: 0,
  imageUrl: '',
  sizes: [],
  embroideryAvailable: true,
  embroideryCost: 10,
  stock: {},
}

export default function ItemEditorModal({ item, onSave, onClose }) {
  const { adminPw } = useData()
  const [form, setForm] = useState(() => ({ ...BLANK, ...item }))
  const [sizesText, setSizesText] = useState((item?.sizes ?? []).join(', '))
  const [trackStock, setTrackStock] = useState(
    () => item?.stock && Object.keys(item.stock).length > 0
  )
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr('')
    setUploading(true)
    try {
      const url = await api.uploadImage(file, adminPw)
      setForm((f) => ({ ...f, imageUrl: url }))
    } catch (err) {
      setUploadErr(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const sizes = sizesText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function submit(e) {
    e.preventDefault()
    const stock = {}
    if (trackStock) {
      for (const size of sizes) {
        const v = form.stock?.[size]
        stock[size] = v === '' || v == null ? 0 : Number(v)
      }
    }
    onSave({
      ...form,
      name: form.name.trim(),
      price: Number(form.price) || 0,
      embroideryCost: Number(form.embroideryCost) || 0,
      sizes,
      stock,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card text-stone-900 p-6 w-full max-w-lg my-auto">
        <h2 className="text-lg font-semibold mb-4">{item ? 'Edit item' : 'Add item'}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required
              className="input" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Embroidery cost ($)</label>
              <input type="number" min="0" step="0.01" value={form.embroideryCost}
                disabled={!form.embroideryAvailable}
                onChange={(e) => set('embroideryCost', e.target.value)}
                className="input disabled:bg-stone-100" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.embroideryAvailable}
              onChange={(e) => set('embroideryAvailable', e.target.checked)}
              className="accent-brand-600 w-4 h-4 cursor-pointer" />
            Embroidery available for this item
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">Photo</label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                {form.imageUrl
                  ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-stone-300 text-xs">None</span>}
              </div>
              <div className="text-sm">
                <label className={`btn btn-ghost btn-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={14} />
                  {uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Upload image'}
                  <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
                </label>
                {form.imageUrl && !uploading && (
                  <button type="button" onClick={() => set('imageUrl', '')}
                    className="block text-red-600 hover:text-red-700 hover:underline mt-1.5 cursor-pointer transition-colors">Remove photo</button>
                )}
              </div>
            </div>
            {uploadErr && <p className="text-red-600 text-sm mt-1">{uploadErr}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sizes (comma separated)</label>
            <input value={sizesText} onChange={(e) => setSizesText(e.target.value)}
              placeholder="2, 4, 6, 8 or S, M, L"
              className="input" />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)}
              className="accent-brand-600 w-4 h-4 cursor-pointer" />
            Track stock per size
          </label>

          {trackStock && sizes.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {sizes.map((size) => (
                <div key={size}>
                  <label className="block text-xs text-stone-500 mb-0.5">{size}</label>
                  <input type="number" min="0" value={form.stock?.[size] ?? ''}
                    onChange={(e) => set('stock', { ...form.stock, [size]: e.target.value })}
                    className="input px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary">
              {item ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
