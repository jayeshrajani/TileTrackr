import { useState, useEffect, useRef } from 'react'
import { updateInventoryEntry, updateProduct, getProductFieldOptions } from '../services/inventoryService'

function ExpandableTileCard({ tile, batches, totalBoxes, onToggleFavorite, onQuickAdd, isAdminLoggedIn, onCollapse, onStockUpdated }) {
  const [editMap, setEditMap] = useState({})
  const [loadingMap, setLoadingMap] = useState({})
  const [saveError, setSaveError] = useState(null)
  const [editingUnit, setEditingUnit] = useState(false)
  const [newUnit, setNewUnit] = useState(tile?.unit || 'box')
  const [savingUnit, setSavingUnit] = useState(false)
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
      [row.inventory_id]: { boxes: row.boxes },
    }))
  }

  const onEditChange = (inventoryId, value) => {
    setEditMap((prev) => ({
      ...prev,
      [inventoryId]: { boxes: Number(value) },
    }))
  }

  const saveEdit = async (inventoryId) => {
    const edited = editMap[inventoryId]
    if (!edited || edited.boxes < 0) return
    setSaveError(null)
    setLoadingMap(prev => ({ ...prev, [inventoryId]: true }))
    const ok = await updateInventoryEntry({ inventory_id: inventoryId, boxes: edited.boxes })
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

  return (
    <div className="px-5 pb-6 pt-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {tile.brand && <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{tile.brand}</p>}
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
            {tile.product_name || tile.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="flex-shrink-0 btn-secondary px-3 py-1.5 text-xs whitespace-nowrap w-full sm:w-auto"
        >
          Close
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Size', value: tile.size },
          { label: 'Total Stock', value: `${totalBoxes} ${unitPlural}` },
          tile.finish ? { label: 'Finish', value: tile.finish } : null,
          tile.category ? { label: 'Category', value: tile.category } : null,
        ].filter(Boolean).map(({ label, value }) => (
          <div key={label} className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-semibold text-slate-800">{value}</p>
          </div>
        ))}
        
        {/* Unit field - editable by admin */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Unit</p>
          {isAdminLoggedIn && editingUnit ? (
            <div className="flex items-center gap-2">
              <div ref={unitDropdownRef} className="relative flex-1">
                <input
                  type="text"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  onFocus={() => setUnitDropdownOpen(true)}
                  className="input-modern py-1 text-xs w-full pr-6"
                  disabled={savingUnit}
                  placeholder="box, piece..."
                />
                <button
                  type="button"
                  onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className={`transition-transform ${unitDropdownOpen ? 'rotate-180' : ''}`}>
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {unitDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-xl shadow-apple border border-slate-100 overflow-hidden max-w-[200px]">
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
                              className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 ${
                                u === newUnit ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-slate-700'
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
                className="btn-primary px-2 py-1 text-xs flex-shrink-0"
              >
                {savingUnit ? '...' : '✓'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUnit(false)
                  setNewUnit(unit)
                  setUnitDropdownOpen(false)
                }}
                disabled={savingUnit}
                className="btn-ghost px-2 py-1 text-xs flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{unit}</p>
              {isAdminLoggedIn && (
                <button
                  type="button"
                  onClick={() => setEditingUnit(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Admin action ── */}
      {isAdminLoggedIn && (
        <button
          type="button"
          onClick={onQuickAdd}
          className="btn-primary w-full justify-center py-3"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Update Stock
        </button>
      )}

      {/* ── Batch breakdown ── */}
      {saveError && (
        <p className="text-xs font-medium text-red-600 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">{saveError}</p>
      )}
      {batches.length > 0 && (
        <div className="space-y-3 pt-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock by Batch</p>
          {batches.map((batch) => (
            <div key={batch.batch_code} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{batch.batch_code}</p>
              {batch.godowns.length === 0 ? (
                <p className="text-xs text-slate-400">No stock in any godown.</p>
              ) : (
                <div className="space-y-2">
                  {batch.godowns.map((row) => {
                    const edit = editMap[row.inventory_id]
                    const isLoading = loadingMap[row.inventory_id]
                    return (
                      <div
                        key={row.inventory_id}
                        className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-4 border border-slate-100"
                      >
                        <div>
                          <p className="text-xs font-medium text-slate-500">{row.godown_name}</p>
                          <div className="flex gap-4 mt-1.5">
                            <span className="text-xs text-slate-400">
                              <span className="font-bold text-slate-800">{row.boxes}</span> {unitPlural}
                            </span>
                          </div>
                        </div>

                        {isAdminLoggedIn && (
                          edit ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={edit.boxes}
                                onChange={(e) => onEditChange(row.inventory_id, e.target.value)}
                                className="input-modern w-20 py-1.5 text-xs"
                                disabled={isLoading}
                              />
                              <button
                                type="button"
                                onClick={() => saveEdit(row.inventory_id)}
                                disabled={isLoading}
                                className="btn-primary px-3 py-1.5 text-xs"
                              >
                                {isLoading ? '…' : 'Save'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="btn-ghost px-3 py-1.5 text-xs"
                            >
                              Edit
                            </button>
                          )
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
    </div>
  )
}

export default ExpandableTileCard
