import { useState, useEffect, useRef } from 'react'
import { updateInventoryEntry, updateProduct, getProductFieldOptions, deleteProduct, getAllCategories, createCategory, getAllTiles } from '../services/inventoryService'
import { formatQty } from '../utils/formatQty'
import { getStockStatus, getSwatchStyle } from '../utils/tileVisual'

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

function ExpandableTileCard({ tile, batches, totalBoxes, onToggleFavorite, onQuickAdd, isAdminLoggedIn, onCollapse, onStockUpdated, onDataChange }) {
  const [editMap, setEditMap] = useState({})
  const [loadingMap, setLoadingMap] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [editingUnit, setEditingUnit] = useState(false)
  const [newUnit, setNewUnit] = useState(tile?.unit || 'box')
  const [savingUnit, setSavingUnit] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [existingUnits, setExistingUnits] = useState([])
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false)
  const unitDropdownRef = useRef(null)

  const unit = tile?.unit || 'box'
  const unitPlural = unit.endsWith('s') ? unit : `${unit}s`

  // Sync newUnit when tile changes
  useEffect(() => {
    setNewUnit(tile?.unit || 'box')
    setEditingUnit(false)
  }, [tile?.id, tile?.unit])

  // Load existing units when entering edit mode
  useEffect(() => {
    if (editingUnit) {
      getProductFieldOptions().then(options => {
        const units = options.units.length > 0 ? options.units : ['box', 'piece', 'sqft', 'sqm']
        setExistingUnits(units)
      })
    }
  }, [editingUnit])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target)) {
        setUnitDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const startEdit = (row) => {
    setSaveError(null)
    setEditMap((prev) => ({
      ...prev,
      [row.inventory_id]: { boxes: row.boxes, location: row.location_in_godown || '' },
    }))
  }

  const onEditChange = (inventoryId, field, value) => {
    setEditMap((prev) => ({
      ...prev,
      [inventoryId]: { ...prev[inventoryId], [field]: field === 'boxes' ? Number(value) : value },
    }))
  }

  const saveEdit = async (inventoryId) => {
    const edited = editMap[inventoryId]
    if (!edited || edited.boxes < 0) return
    setSaveError(null)
    setLoadingMap(prev => ({ ...prev, [inventoryId]: true }))
    const ok = await updateInventoryEntry({ 
      inventory_id: inventoryId, 
      boxes: edited.boxes,
      location_in_godown: edited.location || null
    })
    setLoadingMap(prev => ({ ...prev, [inventoryId]: false }))
    if (ok) {
      setEditMap((prev) => { const next = { ...prev }; delete next[inventoryId]; return next })
      if (onStockUpdated) onStockUpdated()
    } else {
      setSaveError('Failed to save. Please try again.')
    }
  }

  const saveUnit = async () => {
    if (!newUnit.trim()) return
    setSavingUnit(true)
    setSaveError(null)
    const ok = await updateProduct(tile.id, { unit: newUnit.trim() })
    setSavingUnit(false)
    if (ok) {
      setEditingUnit(false)
      setUnitDropdownOpen(false)
      if (onStockUpdated) onStockUpdated()
    } else {
      setSaveError('Failed to update unit. Please try again.')
    }
  }

  const handleDeleteProduct = async () => {
    const result = await deleteProduct(tile.id)
    if (result.ok) {
      setShowDeleteModal(false)
      if (onDataChange) onDataChange() // Refresh entire tiles list and close card
    } else {
      setSaveError(result.message || 'Failed to delete product. Please try again.')
    }
  }

  const status = getStockStatus(totalBoxes)

  return (
    <div>
      {/* ── Swatch hero ── */}
      <div className="relative h-40 lg:h-56" style={getSwatchStyle(tile)}>
        <span className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/5" aria-hidden="true" />
        <button
          type="button"
          onClick={onCollapse}
          className="absolute right-3 top-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-apple-sm flex items-center justify-center text-slate-700 hover:bg-white transition-colors"
          aria-label="Close details"
        >
          <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        <span className="absolute left-4 bottom-4 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/95 backdrop-blur text-xs font-medium text-slate-800 shadow-apple-xs">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>

    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="min-w-0">
        {tile.brand && <p className="text-[13px] font-medium text-slate-500 mb-0.5">{tile.brand}</p>}
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight leading-snug">
          {tile.product_name || tile.name}
        </h2>
      </div>

      {/* ── Admin actions ── */}
      {isAdminLoggedIn && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <button
            type="button"
            onClick={onQuickAdd}
            className="btn-primary py-3"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Update Stock
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="btn-secondary px-4 py-3"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="btn-base px-4 py-3 text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label: 'Size', value: tile.size },
          { label: 'Total Stock', value: formatQty(totalBoxes, parsePackageCount(tile.package_spec ?? tile.pieces_per_box), unit) },
          parsePackageCount(tile.package_spec ?? tile.pieces_per_box)
            ? { label: 'Pack', value: `${parsePackageCount(tile.package_spec ?? tile.pieces_per_box)} pcs/box` }
            : null,
          tile.finish ? { label: 'Finish', value: tile.finish } : null,
          tile.category ? { label: 'Category', value: tile.category } : null,
          tile.grade ? { label: 'Grade', value: tile.grade } : null,
        ].filter(Boolean).map(({ label, value }) => (
          <div key={label} className="bg-slate-50 rounded-xl px-3.5 py-3 min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">{label}</p>
            <p className="text-[15px] font-semibold text-slate-900 truncate tabular-nums">{value || '—'}</p>
          </div>
        ))}
        
        {/* Unit field - editable by admin */}
        <div className={`bg-slate-50 rounded-xl px-3.5 py-3 relative min-w-0 ${isAdminLoggedIn && editingUnit ? 'col-span-2 sm:col-span-1' : ''}`}>
          <p className="text-xs text-slate-500 mb-0.5">Unit</p>
          {isAdminLoggedIn && editingUnit ? (
            <div className="flex items-center gap-2">
              <div ref={unitDropdownRef} className="relative flex-1">
                <input
                  type="text"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  onFocus={() => setUnitDropdownOpen(true)}
                  className="input-modern py-1.5 px-2.5 text-sm w-full pr-7"
                  disabled={savingUnit}
                  placeholder="box, piece..."
                />
                <button
                  type="button"
                  onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label="Show units"
                >
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className={`transition-transform ${unitDropdownOpen ? 'rotate-180' : ''}`}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {unitDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-xl shadow-apple-lg border border-slate-200/80 overflow-hidden min-w-[160px]">
                    {/* Existing units */}
                    {existingUnits.filter(u => u.toLowerCase().includes(newUnit.toLowerCase())).length > 0 && (
                      <div className="max-h-32 overflow-y-auto py-1">
                        {existingUnits
                          .filter(u => u.toLowerCase().includes(newUnit.toLowerCase()))
                          .map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => {
                                setNewUnit(u)
                                setUnitDropdownOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                                u === newUnit ? 'text-clay-700 font-medium bg-clay-50' : 'text-slate-700'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                      </div>
                    )}
                    
                    {/* Add new option */}
                    {newUnit.trim() && !existingUnits.some((u) => u.toLowerCase() === newUnit.trim().toLowerCase()) && (
                      <div className="border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setUnitDropdownOpen(false)}
                          className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 font-medium hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                        >
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          Use "{newUnit.trim()}"
                        </button>
                      </div>
                    )}
                    
                    {existingUnits.filter(u => u.toLowerCase().includes(newUnit.toLowerCase())).length === 0 && !newUnit.trim() && (
                      <p className="text-xs text-slate-400 px-3 py-2">Type to add custom unit</p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={saveUnit}
                disabled={savingUnit || !newUnit.trim()}
                className="btn-primary w-8 h-8 p-0 flex-shrink-0 rounded-lg"
                aria-label="Save unit"
              >
                {savingUnit ? '…' : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUnit(false)
                  setNewUnit(unit)
                  setUnitDropdownOpen(false)
                }}
                disabled={savingUnit}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 flex-shrink-0"
                aria-label="Cancel"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-semibold text-slate-900">{unit}</p>
              {isAdminLoggedIn && (
                <button
                  type="button"
                  onClick={() => setEditingUnit(true)}
                  className="text-[13px] text-clay-700 hover:text-clay-800 font-medium -my-1 py-1"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Batch breakdown ── */}
      {saveError && (
        <p className="text-[13px] font-medium text-red-700 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100" role="alert">{saveError}</p>
      )}
      {batches.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-slate-900">Stock by batch</p>
          {batches.map((batch) => (
            <div key={batch.batch_code} className="rounded-xl border border-slate-200/80 overflow-hidden">
              <p className="px-4 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200/80">Batch {batch.batch_code}</p>
              {batch.godowns.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">No stock in any godown.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {batch.godowns.map((row) => {
                    const edit = editMap[row.inventory_id]
                    const isLoading = loadingMap[row.inventory_id]
                    return (
                      <div
                        key={row.inventory_id}
                        className="px-4 py-3 bg-white"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-slate-500 truncate">{row.godown_name}{row.location_in_godown ? ` · ${row.location_in_godown}` : ''}</p>
                            <p className="text-[15px] font-semibold text-slate-900 tabular-nums mt-0.5">
                              {formatQty(row.boxes, parsePackageCount(tile.package_spec ?? tile.pieces_per_box), unit)}
                            </p>
                          </div>

                          {isAdminLoggedIn && !edit && (
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="btn-ghost px-3 py-2 text-[13px]"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {isAdminLoggedIn && edit && (
                          <div className="mt-3 grid grid-cols-[88px_1fr_auto] gap-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              value={edit.boxes}
                              onChange={(e) => onEditChange(row.inventory_id, 'boxes', e.target.value)}
                              className="input-modern py-2 px-3"
                              disabled={isLoading}
                              placeholder="Qty"
                              aria-label="Quantity"
                            />
                            <input
                              type="text"
                              value={edit.location || ''}
                              onChange={(e) => onEditChange(row.inventory_id, 'location', e.target.value)}
                              className="input-modern py-2 px-3 min-w-0"
                              disabled={isLoading}
                              placeholder="Location"
                              aria-label="Location"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit(row.inventory_id)}
                              disabled={isLoading}
                              className="btn-primary px-4 py-2"
                            >
                              {isLoading ? '…' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div className="modal-root" role="alertdialog" aria-modal="true">
          <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)} />
          <div className="modal-panel sm:max-w-sm">
            <div className="p-6 space-y-5">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900 leading-snug">
                  Delete "{tile.product_name || tile.name}"?
                </h2>
                <p className="text-[13px] text-slate-500">{tile.brand} · {tile.size}</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                This action <span className="font-semibold text-red-600">cannot be undone</span>. All associated inventory records will also be deleted.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" onClick={() => setShowDeleteModal(false)} className="btn-secondary py-3">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProduct}
                  className="btn-danger py-3"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Product Modal ── */}
      {showEditModal && (
        <EditProductModal
          tile={tile}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false)
            if (onDataChange) onDataChange() // Refresh entire tiles list to show updated product
          }}
        />
      )}
    </div>
    </div>
  )
}

// EditProductModal Component
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

  const loadCategories = async () => {
    const cats = await getAllCategories()
    setCategories(cats)
  }

  useEffect(() => {
    loadCategories()
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
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel sm:max-w-lg">
        
        {/* Header */}
        <div className="modal-header">
          <h2 id="edit-product-title" className="text-lg font-semibold text-slate-900">Edit Product</h2>
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
            <div>
              <label className="label">Brand</label>
              <input
                className="input-modern"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder="Brand name"
                list="brand-options"
              />
              <datalist id="brand-options">
                {options.brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input-modern"
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Size + Finish */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Size</label>
              <input
                className="input-modern"
                value={form.size}
                onChange={(e) => setForm((f) => ({ ...f, size: e.target.value.replace(/\*/g, '×') }))}
                placeholder="e.g. 12×12"
                list="size-options"
              />
              <datalist id="size-options">
                {options.sizes.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Finish</label>
              <input
                className="input-modern"
                value={form.finish}
                onChange={(e) => setForm((f) => ({ ...f, finish: e.target.value }))}
                placeholder="e.g. Glossy"
                list="finish-options"
              />
              <datalist id="finish-options">
                {options.finishes.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Grade + Unit + Packaging */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Grade</label>
              <input
                className="input-modern"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                placeholder="e.g. Premium"
                list="grade-options"
              />
              <datalist id="grade-options">
                {options.grades.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Unit</label>
              <input
                className="input-modern"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="box, piece, sqft..."
                list="unit-options"
              />
              <datalist id="unit-options">
                {(options.units.length > 0 ? options.units : ['box', 'piece', 'sqft', 'sqm']).map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Package Spec (pieces/box)</label>
              <input
                className="input-modern"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={form.package_spec}
                onChange={(e) => setForm((f) => ({ ...f, package_spec: e.target.value }))}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {error && <p className="text-[13px] font-medium text-red-600" role="alert">{error}</p>}

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary py-3">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary py-3">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ExpandableTileCard
