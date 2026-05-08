import { useState, useEffect, useRef } from 'react'
import SearchBar from './SearchBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { searchTiles, getLatestTiles, getTileInventory, getAllCategories, createCategory, createProduct, getProductFieldOptions, getAllGodowns, addInventoryEntry } from '../services/inventoryService'

const EMPTY_FORM = {
  product_name: '', brand: '', size: '', finish: '', unit: 'box', category_id: '',
  // Initial stock (all optional)
  godown_id: '', batch_code: '', qty: '', price: '',
}

/**
 * Combobox: shows a text input + dropdown of existing suggestions.
 * The user can pick a suggestion OR type their own value.
 */
function ComboField({ label, value, onChange, suggestions = [], placeholder = '', transformInput }) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState(value)
  const containerRef          = useRef(null)

  // Keep internal query in sync if parent resets the value
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(query.toLowerCase())
  )

  const select = (val) => {
    const transformed = transformInput ? transformInput(val) : val
    setQuery(transformed)
    onChange(transformed)
    setOpen(false)
  }

  const handleInput = (e) => {
    const inputValue = e.target.value
    const transformed = transformInput ? transformInput(inputValue) : inputValue
    setQuery(transformed)
    onChange(transformed)
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="label">{label}</label>
      <div className={`flex items-center gap-2 input-modern pr-2 ${ open ? 'ring-2 ring-indigo-500/20 border-indigo-400' : '' }`}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
        />
        {query && (
          <button type="button" onClick={() => select('')}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-xl shadow-apple-lg border border-slate-100 overflow-hidden">
          {/* Existing options */}
          {filtered.length > 0 && (
            <div className="max-h-40 overflow-y-auto py-1">
              {filtered.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); select(s) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    s === value ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* "Add new" row – shown when user typed something not in list */}
          {query.trim() && !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(query.trim()) }}
                className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors flex items-center gap-2"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add &ldquo;{query.trim()}&rdquo;
              </button>
            </div>
          )}

          {filtered.length === 0 && !query.trim() && (
            <p className="text-xs text-slate-400 px-4 py-3">No existing values — type to add new</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * CategoryComboField: Similar to ComboField but creates categories in DB when new ones are added
 */
function CategoryComboField({ label, value, onChange, categories = [] }) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [creating, setCreating] = useState(false)
  const containerRef          = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  )

  const select = (categoryId) => {
    onChange(categoryId)
    setQuery('')
    setOpen(false)
  }

  const handleCreateNew = async () => {
    const trimmed = query.trim()
    if (!trimmed || creating) return

    setCreating(true)
    const newCategory = await createCategory(trimmed)
    setCreating(false)

    if (newCategory) {
      // Notify parent to refresh categories list
      onChange(newCategory.id, true) // Pass true to indicate refresh needed
      setQuery('')
      setOpen(false)
    }
  }

  const selectedCategory = categories.find((c) => c.id === value)
  const displayText = selectedCategory ? selectedCategory.name : 'Select or create new'

  return (
    <div ref={containerRef} className="relative">
      <label className="label">{label}</label>
      <div className={`flex items-center gap-2 input-modern pr-2 cursor-pointer ${ open ? 'ring-2 ring-indigo-500/20 border-indigo-400' : '' }`}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 text-sm text-slate-900">
          {selectedCategory ? selectedCategory.name : <span className="text-slate-400">Select or create new</span>}
        </span>
        {value && (
          <button type="button" onClick={(e) => { e.stopPropagation(); select('') }}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white rounded-xl shadow-apple-lg border border-slate-100 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or type new category..."
              className="w-full px-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-100 outline-none text-slate-900 placeholder:text-slate-400 focus:border-indigo-300"
              autoFocus
            />
          </div>

          {/* Existing categories */}
          {filtered.length > 0 && (
            <div className="max-h-40 overflow-y-auto py-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); select(c.id) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    c.id === value ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-slate-700'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Create new category */}
          {query.trim() && !categories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={creating}
                className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {creating ? 'Creating...' : `Create "${query.trim()}"`}
              </button>
            </div>
          )}

          {filtered.length === 0 && !query.trim() && (
            <p className="text-xs text-slate-400 px-4 py-3">Type to search or create new category</p>
          )}
        </div>
      )}
    </div>
  )
}

function AddProductModal({ onClose, onCreated }) {
  const [form, setForm]       = useState(EMPTY_FORM)
  const [categories, setCategories] = useState([])
  const [godowns, setGodowns] = useState([])
  const [options, setOptions] = useState({ brands: [], sizes: [], finishes: [], units: [] })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const loadCategories = async () => {
    const cats = await getAllCategories()
    setCategories(cats)
  }

  useEffect(() => {
    loadCategories()
    getProductFieldOptions().then(setOptions)
    getAllGodowns().then(setGodowns)
  }, [])

  const set = (field) => (val, shouldRefresh) => {
    setForm((f) => ({ ...f, [field]: val }))
    if (shouldRefresh && field === 'category_id') {
      loadCategories() // Refresh categories when a new one is created
    }
  }
  const setSelect = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setInput  = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_name.trim()) { setError('Product name is required.'); return }

    // Validate stock section only if partially filled
    const hasStock = form.qty !== ''
    if (hasStock) {
      if (!form.godown_id)           { setError('Please select a godown for the initial stock.'); return }
      if (!form.batch_code.trim())   { setError('Batch / lot number is required when adding stock.'); return }
      if (isNaN(Number(form.qty)) || Number(form.qty) <= 0) { setError('Quantity must be a positive number.'); return }
    }

    setSaving(true)
    setError('')

    const product = await createProduct({
      product_name: form.product_name.trim(),
      brand:        form.brand,
      size:         form.size,
      finish:       form.finish,
      unit:         form.unit,
      category_id:  form.category_id || null,
    })

    if (!product) { setSaving(false); setError('Failed to save product. Please try again.'); return }

    if (hasStock) {
      await addInventoryEntry({
        tile_id:    product.id,
        godown_id:  form.godown_id,
        batch_code: form.batch_code.trim(),
        boxes:      Number(form.qty),
        price:      form.price !== '' ? Number(form.price) : 0,
      })
    }

    setSaving(false)
    onCreated(product)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-apple-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">admin</p>
            <h2 className="text-lg font-bold text-slate-900">Add New Product</h2>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Product name */}
          <div>
            <label className="label">Product Name <span className="text-red-500">*</span></label>
            <input
              className="input-modern"
              value={form.product_name}
              onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              placeholder="e.g. Glossy White Floor Tile"
              autoFocus
            />
          </div>

          {/* Brand + Category */}
          <div className="grid grid-cols-2 gap-3">
            <ComboField
              label="Brand"
              value={form.brand}
              onChange={set('brand')}
              suggestions={options.brands}
              placeholder="Select or type new"
            />
            <CategoryComboField
              label="Category"
              value={form.category_id}
              onChange={set('category_id')}
              categories={categories}
            />
          </div>

          {/* Size + Finish */}
          <div className="grid grid-cols-2 gap-3">
            <ComboField
              label="Size"
              value={form.size}
              onChange={set('size')}
              suggestions={options.sizes}
              placeholder="e.g. 12*12 or 24*48"
              transformInput={(val) => val.replace(/\*/g, '×')}
            />
            <ComboField
              label="Finish"
              value={form.finish}
              onChange={set('finish')}
              suggestions={options.finishes}
              placeholder="Select or type new"
            />
          </div>

          {/* Unit */}
          <ComboField
            label="Unit"
            value={form.unit}
            onChange={set('unit')}
            suggestions={options.units.length > 0 ? options.units : ['box', 'piece', 'sqft', 'sqm']}
            placeholder="Select or type new"
          />

          {/* ── Initial Stock ── */}
          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Initial Stock <span className="text-xs font-normal text-slate-400 ml-1">(optional)</span></p>
              <p className="text-xs text-slate-400 mt-0.5">Fill in to record opening stock right away.</p>
            </div>

            {/* Godown + Batch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Godown</label>
                <select className="input-modern" value={form.godown_id} onChange={setSelect('godown_id')}>
                  <option value="">— Select —</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Batch / Lot No.</label>
                <input className="input-modern" value={form.batch_code} onChange={setInput('batch_code')} placeholder="e.g. B2024-01" />
              </div>
            </div>

            {/* Qty + Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity</label>
                <input className="input-modern" type="number" min="1" value={form.qty} onChange={setInput('qty')} placeholder="0" />
              </div>
              <div>
                <label className="label">Price per unit <span className="text-slate-400 font-normal">(optional)</span></label>
                <input className="input-modern" type="number" min="0" step="0.01" value={form.price} onChange={setInput('price')} placeholder="0.00" />
              </div>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UpdateInventoryPage({ onQuickAdd, onProductCreated }) {
  const [query, setQuery]         = useState('')
  const debouncedQuery            = useDebouncedValue(query, 200)
  const [tiles, setTiles]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadingId, setLoadingId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadTiles = async (q) => {
    setLoading(true)
    const data = q ? await searchTiles(q) : await getLatestTiles(30)
    setTiles(data)
    setLoading(false)
  }

  useEffect(() => { loadTiles(debouncedQuery) }, [debouncedQuery])

  const handleTileSelect = async (tile) => {
    setLoadingId(tile.id)
    const data = await getTileInventory(tile.id)
    setLoadingId(null)
    if (data) onQuickAdd(data)
  }

  const handleProductCreated = (product) => {
    setShowAddModal(false)
    if (onProductCreated) onProductCreated()
    // Refresh list so the new product appears right away
    loadTiles(debouncedQuery)
  }

  return (
    <div className="space-y-6">
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleProductCreated}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Update Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Select a tile to add or update its stock.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex-shrink-0 flex items-center gap-2 mt-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Product
        </button>
      </div>

      <SearchBar query={query} onChange={setQuery} />

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[2.5px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
      ) : tiles.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-semibold text-slate-600">No tiles found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => handleTileSelect(tile)}
              disabled={loadingId === tile.id}
              className="w-full text-left card px-5 py-4 flex items-center gap-4 hover:shadow-apple-sm hover:border-slate-200 transition-all duration-200 disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center">
                {loadingId === tile.id ? (
                  <div className="w-4 h-4 border-[2px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    {(tile.brand || tile.product_name || '?')[0]}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {tile.brand && <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-none mb-1">{tile.brand}</p>}
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {tile.product_name || tile.name}
                </p>
              </div>

              {tile.size && (
                <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-500 flex-shrink-0">
                  {tile.size}
                </span>
              )}

              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" aria-hidden="true">
                <path d="M4.5 2l4 4-4 4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default UpdateInventoryPage
