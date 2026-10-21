import { useState, useEffect, useRef } from 'react'
import SearchBar from './SearchBar'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { getSwatchStyle } from '../utils/tileVisual'
import { searchTiles, getLatestTiles, getTileInventory, getAllCategories, createCategory, createProduct, getProductFieldOptions, getAllGodowns, addInventoryEntry, getAllTiles, updateProduct, deleteProduct } from '../services/inventoryService'

const EMPTY_FORM = {
  product_name: '', brand: '', size: '', finish: '', grade: '', unit: 'box', category_id: '',
  package_spec: '',
  // Initial stock (all optional)
  godown_id: '', batch_code: '', location_in_godown: '', qty: '',
}

const parsePackageCount = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  }
  const match = String(value).match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
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
    <div ref={containerRef} className={`relative ${open ? 'z-40' : 'z-0'}`}>
      <label className="label">{label}</label>
      <div className={`flex items-center gap-2 input-modern pr-2 ${ open ? 'ring-4 ring-clay-500/10 border-clay-500' : '' }`}>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
        />
        <div className="flex items-center flex-shrink-0 -my-1">
          {query && (
            <button type="button" onClick={() => select('')}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label={`Clear ${label}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label={`Toggle ${label} options`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            >
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-apple-lg border border-slate-100 overflow-hidden">
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
    <div ref={containerRef} className={`relative ${open ? 'z-40' : 'z-0'}`}>
      <label className="label">{label}</label>
      <div className={`flex items-center gap-2 input-modern pr-2 cursor-pointer ${ open ? 'ring-4 ring-clay-500/10 border-clay-500' : '' }`}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 text-sm text-slate-900">
          {selectedCategory ? selectedCategory.name : <span className="text-slate-400">Select or create new</span>}
        </span>
        <div className="ml-2 flex items-center gap-1.5 flex-shrink-0">
          {value && (
            <button type="button" onClick={(e) => { e.stopPropagation(); select('') }}
              className="text-slate-400 hover:text-slate-600"
              aria-label={`Clear ${label}`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-apple-lg border border-slate-100 overflow-hidden">
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
  const [existingProducts, setExistingProducts] = useState([])
  const [options, setOptions] = useState({ brands: [], sizes: [], finishes: [], grades: [], units: [], packageSpecs: [] })
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
    getAllTiles().then(setExistingProducts)
  }, [])

  const normalized = (value) => (value || '').trim().toLowerCase()
  const normalizedPackageCount = parsePackageCount(form.package_spec)
  const normalizedCategoryId = form.category_id || null
  const productNameSuggestions = [...new Set(existingProducts.map((product) => product.product_name).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const selectedGodown = godowns.find((godown) => godown.id === form.godown_id)
  const godownLocations = Array.isArray(selectedGodown?.locations) ? selectedGodown.locations : []

  const matchingProduct = existingProducts.find((product) => (
    normalized(product.product_name) === normalized(form.product_name) &&
    normalized(product.brand) === normalized(form.brand) &&
    normalized(product.size) === normalized(form.size) &&
    normalized(product.finish) === normalized(form.finish) &&
    normalized(product.grade) === normalized(form.grade) &&
    normalized(product.unit) === normalized(form.unit) &&
    parsePackageCount(product.package_spec ?? product.pieces_per_box) === normalizedPackageCount &&
    (product.category_id || null) === normalizedCategoryId
  ))

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

    if (matchingProduct) {
      setError('This product has already been added. You can update or edit it instead.')
      return
    }

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
      brand:        form.brand || null,
      size:         form.size || null,
      finish:       form.finish || null,
      grade:        form.grade || null,
      unit:         form.unit || 'box',
      package_spec: normalizedPackageCount != null ? String(normalizedPackageCount) : null,
      pieces_per_box: normalizedPackageCount,
      category_id:  form.category_id || null,
    })

    if (!product) { setSaving(false); setError('Failed to save product. Please try again.'); return }

    if (hasStock) {
      await addInventoryEntry({
        tile_id:    product.id,
        godown_id:  form.godown_id,
        batch_code: form.batch_code.trim(),
        location_in_godown: form.location_in_godown || null,
        boxes:      Number(form.qty),
      })
    }

    setSaving(false)
    onCreated(product)
  }

  return (
    <div className="modal-root" aria-modal="true" role="dialog" aria-labelledby="add-product-title">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel sm:max-w-3xl">

        {/* Header */}
        <div className="modal-header">
          <h2 id="add-product-title" className="text-lg font-semibold text-slate-900">Add New Product</h2>
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">

          {/* Product name */}
          <div>
            <ComboField
              label="Product Name"
              value={form.product_name}
              onChange={set('product_name')}
              suggestions={productNameSuggestions}
              placeholder="e.g. Glossy White Floor Tile"
            />
          </div>

          {/* Brand + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <ComboField
              label="Grade"
              value={form.grade}
              onChange={set('grade')}
              suggestions={options.grades}
              placeholder="Select or type new"
            />
          </div>

          {/* Unit + Packaging */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ComboField
              label="Unit"
              value={form.unit}
              onChange={set('unit')}
              suggestions={options.units.length > 0 ? options.units : ['box', 'piece', 'sqft', 'sqm']}
              placeholder="Select or type new"
            />
            <div>
              <label className="label">Package Spec (pieces/box)</label>
              <input
                className="input-modern"
                type="number"
                min="1"
                step="1"
                value={form.package_spec}
                onChange={setInput('package_spec')}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {/* ── Initial Stock ── */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Initial stock <span className="text-[13px] font-normal text-slate-500 ml-1">(optional)</span></p>
              <p className="text-[13px] text-slate-500 mt-0.5">Fill in to record opening stock right away.</p>
            </div>

            {/* Godown + Batch + Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="label">Godown</label>
                <select
                  className="input-modern"
                  value={form.godown_id}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      godown_id: event.target.value,
                      location_in_godown: '',
                    }))
                  }}
                >
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
              <div>
                <label className="label">Location <span className="text-slate-400 font-normal">(optional)</span></label>
                <select className="input-modern" value={form.location_in_godown} onChange={setSelect('location_in_godown')}>
                  <option value="">{form.godown_id ? 'Select location' : 'Select godown first'}</option>
                  {godownLocations.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
                {form.godown_id && godownLocations.length === 0 && (
                  <p className="mt-2 text-[13px] text-amber-700">No saved locations in this godown yet. Add them from the Godowns tab first.</p>
                )}
              </div>
            </div>

            {/* Qty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity</label>
                <input className="input-modern" type="number" inputMode="numeric" min="1" value={form.qty} onChange={setInput('qty')} placeholder="0" />
              </div>
            </div>
          </div>

          {error && <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5" role="alert">{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary py-3">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary py-3">
              {saving ? 'Saving…' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditProductModal({ tile, onClose, onSaved }) {
  const [form, setForm] = useState({
    product_name: tile.product_name || '',
    brand: tile.brand || '',
    size: tile.size || '',
    finish: tile.finish || '',
    grade: tile.grade || '',
    unit: tile.unit || 'box',
    package_spec: parsePackageCount(tile.package_spec ?? tile.pieces_per_box) || '',
    category_id: tile.category_id || '',
  })
  const [categories, setCategories] = useState([])
  const [existingProducts, setExistingProducts] = useState([])
  const [options, setOptions] = useState({ brands: [], sizes: [], finishes: [], grades: [], units: [], packageSpecs: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllCategories().then(setCategories)
    getProductFieldOptions().then(setOptions)
    getAllTiles().then(setExistingProducts)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_name.trim()) {
      setError('Product name is required.')
      return
    }

    // Check for duplicates (excluding the current product being edited)
    const normalized = (value) => (value || '').trim().toLowerCase()
    const normalizedPackageCount = parsePackageCount(form.package_spec)
    const normalizedCategoryId = form.category_id || null
    
    const duplicateProduct = existingProducts.find((product) => (
      product.id !== tile.id && // Exclude current product
      normalized(product.product_name) === normalized(form.product_name) &&
      normalized(product.brand) === normalized(form.brand) &&
      normalized(product.size) === normalized(form.size) &&
      normalized(product.finish) === normalized(form.finish) &&
      normalized(product.grade) === normalized(form.grade) &&
      normalized(product.unit) === normalized(form.unit) &&
      parsePackageCount(product.package_spec ?? product.pieces_per_box) === normalizedPackageCount &&
      (product.category_id || null) === normalizedCategoryId
    ))

    if (duplicateProduct) {
      setError('A product with these exact details already exists. Please modify at least one field to make it unique.')
      return
    }

    setSaving(true)
    setError('')
    const ok = await updateProduct(tile.id, {
      product_name: form.product_name.trim(),
      brand: form.brand || null,
      size: form.size || null,
      finish: form.finish || null,
      grade: form.grade || null,
      unit: form.unit || 'box',
      package_spec: normalizedPackageCount != null ? String(normalizedPackageCount) : null,
      pieces_per_box: normalizedPackageCount,
      category_id: form.category_id || null,
    })
    setSaving(false)

    if (ok) {
      onSaved()
    } else {
      setError('Failed to update product. Please try again.')
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="edit-product-title-2">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel sm:max-w-lg">
        <div className="modal-header">
          <h2 id="edit-product-title-2" className="text-lg font-semibold text-slate-900">Edit Product</h2>
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
          <ComboField
            label="Product Name"
            value={form.product_name}
            onChange={(value) => setForm((current) => ({ ...current, product_name: value }))}
            suggestions={[]}
            placeholder="e.g. Glossy White Floor Tile"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            <ComboField
              label="Brand"
              value={form.brand}
              onChange={(value) => setForm((current) => ({ ...current, brand: value }))}
              suggestions={options.brands}
              placeholder="Select or type new"
            />
            <CategoryComboField
              label="Category"
              value={form.category_id}
              onChange={(value) => setForm((current) => ({ ...current, category_id: value }))}
              categories={categories}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            <ComboField
              label="Size"
              value={form.size}
              onChange={(value) => setForm((current) => ({ ...current, size: value }))}
              suggestions={options.sizes}
              placeholder="e.g. 12*12 or 24*48"
              transformInput={(value) => value.replace(/\*/g, '×')}
            />
            <ComboField
              label="Finish"
              value={form.finish}
              onChange={(value) => setForm((current) => ({ ...current, finish: value }))}
              suggestions={options.finishes}
              placeholder="Select or type new"
            />
            <ComboField
              label="Grade"
              value={form.grade}
              onChange={(value) => setForm((current) => ({ ...current, grade: value }))}
              suggestions={options.grades}
              placeholder="Select or type new"
            />
            <ComboField
              label="Unit"
              value={form.unit}
              onChange={(value) => setForm((current) => ({ ...current, unit: value }))}
              suggestions={options.units.length > 0 ? options.units : ['box', 'piece', 'sqft', 'sqm']}
              placeholder="Select or type new"
            />
            <div>
              <label className="label">Package Spec (pieces/box)</label>
              <input
                className="input-modern"
                type="number"
                min="1"
                step="1"
                value={form.package_spec}
                onChange={(event) => setForm((current) => ({ ...current, package_spec: event.target.value }))}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {error && <p className="text-[13px] font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5" role="alert">{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary py-3">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary py-3">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteProductModal({ tile, onClose, onConfirm, deleting }) {
  return (
    <div className="modal-root" role="alertdialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel sm:max-w-sm">
        <div className="p-6 space-y-5">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900 leading-snug">Delete &quot;{tile.product_name || tile.name}&quot;?</h2>
            <p className="text-[13px] text-slate-500">{tile.brand}{tile.size ? ` · ${tile.size}` : ''}</p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">This action <span className="font-semibold text-red-600">cannot be undone</span>. Use edit if you only need to change product details.</p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary py-3" disabled={deleting}>Cancel</button>
            <button
              type="button"
              onClick={onConfirm}
              className="btn-danger py-3"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UpdateInventoryPage({ onQuickAdd, onProductCreated, onDataChange }) {
  const [query, setQuery]         = useState('')
  const debouncedQuery            = useDebouncedValue(query, 200)
  const [tiles, setTiles]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadingId, setLoadingId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTile, setEditingTile] = useState(null)
  const [deletingTile, setDeletingTile] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
    if (onDataChange) onDataChange()
    // Refresh list so the new product appears right away
    loadTiles(debouncedQuery)
  }

  const handleProductUpdated = async () => {
    setEditingTile(null)
    if (onProductCreated) onProductCreated()
    if (onDataChange) onDataChange()
    await loadTiles(debouncedQuery)
  }

  const handleProductDeleted = async () => {
    if (!deletingTile) return
    setIsDeleting(true)
    const result = await deleteProduct(deletingTile.id)
    setIsDeleting(false)
    if (!result.ok) {
      window.alert(result.message)
      return
    }
    setDeletingTile(null)
    if (onProductCreated) onProductCreated()
    if (onDataChange) onDataChange()
    await loadTiles(debouncedQuery)
  }

  return (
    <div className="space-y-6">
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleProductCreated}
        />
      )}
      {editingTile && (
        <EditProductModal
          tile={editingTile}
          onClose={() => setEditingTile(null)}
          onSaved={handleProductUpdated}
        />
      )}
      {deletingTile && (
        <DeleteProductModal
          tile={deletingTile}
          onClose={() => { if (!isDeleting) setDeletingTile(null) }}
          onConfirm={handleProductDeleted}
          deleting={isDeleting}
        />
      )}

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Update Inventory</h1>
          <p className="page-subtitle">Select a tile to add or update its stock.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex-shrink-0 px-4"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="hidden xs:inline">Add Product</span>
          <span className="xs:hidden">Add</span>
        </button>
      </div>

      <SearchBar query={query} onChange={setQuery} />

      {loading ? (
        <div className="card divide-y divide-slate-100 overflow-hidden" aria-busy="true" aria-label="Loading products">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-slate-100" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : tiles.length === 0 ? (
        <div className="card py-16 px-6 text-center">
          <p className="text-sm font-semibold text-slate-700">No tiles found</p>
          <p className="text-[13px] text-slate-500 mt-1">Try adjusting your search</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className="w-full pl-4 pr-2 sm:pr-3 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="relative w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden ring-1 ring-inset ring-black/5" style={getSwatchStyle(tile)}>
                {loadingId === tile.id && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                    <div className="w-4 h-4 border-[2px] border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleTileSelect(tile)}
                disabled={loadingId === tile.id}
                className="flex-1 min-w-0 text-left disabled:opacity-60 py-0.5"
              >
                <p className="text-[15px] font-semibold text-slate-900 truncate">
                  {tile.product_name || tile.name}
                </p>
                <p className="text-[13px] text-slate-500 truncate mt-0.5">
                  {[
                    tile.brand,
                    tile.size,
                    parsePackageCount(tile.package_spec ?? tile.pieces_per_box) != null ? `${parsePackageCount(tile.package_spec ?? tile.pieces_per_box)} pcs/box` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </button>

              <div className="flex items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingTile(tile)}
                  className="icon-btn"
                  aria-label={`Edit ${tile.product_name || tile.name}`}
                  title="Edit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4ZM13.5 6.5l4 4"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingTile(tile)}
                  className="icon-btn hover:text-red-600 hover:bg-red-50"
                  aria-label={`Delete ${tile.product_name || tile.name}`}
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M7 6l1 14h8l1-14"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleTileSelect(tile)}
                  disabled={loadingId === tile.id}
                  className="icon-btn disabled:opacity-60"
                  aria-label={`Open update for ${tile.product_name || tile.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UpdateInventoryPage
