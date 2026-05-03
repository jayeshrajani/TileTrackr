import { useState } from 'react'
import { updateInventoryEntry } from '../services/inventoryService'

function ExpandableTileCard({ tile, batches, totalBoxes, onToggleFavorite, onQuickAdd, isAdminLoggedIn, onCollapse, onStockUpdated }) {
  const [editMap, setEditMap] = useState({})
  const [loadingMap, setLoadingMap] = useState({})
  const [saveError, setSaveError] = useState(null)

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

  return (
    <div className="px-5 pb-6 pt-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {tile.brand && <p className="caption mb-1">{tile.brand}</p>}
          <h2 className="text-xl font-semibold text-apple-text-1 tracking-tight leading-snug">
            {tile.product_name || tile.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="flex-shrink-0 btn-secondary px-3 py-1.5 text-xs"
        >
          Close
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Size', value: tile.size },
          { label: 'Total Stock', value: `${totalBoxes} boxes` },
          tile.finish ? { label: 'Finish', value: tile.finish } : null,
          tile.category ? { label: 'Category', value: tile.category } : null,
        ].filter(Boolean).map(({ label, value }) => (
          <div key={label} className="bg-apple-gray rounded-xl px-4 py-3">
            <p className="caption mb-1">{label}</p>
            <p className="text-sm font-semibold text-apple-text-1">{value}</p>
          </div>
        ))}
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
          Add / Update Stock
        </button>
      )}

      {/* ── Batch breakdown ── */}
      {saveError && (
        <p className="text-xs font-medium text-apple-red bg-red-50 rounded-xl px-4 py-2.5">{saveError}</p>
      )}
      {batches.length > 0 && (
        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold text-apple-text-2">Stock by Batch</p>
          {batches.map((batch) => (
            <div key={batch.batch_code} className="bg-apple-gray rounded-xl p-4 space-y-3">
              <p className="caption">{batch.batch_code}</p>
              {batch.godowns.length === 0 ? (
                <p className="text-xs text-apple-text-3">No stock in any godown.</p>
              ) : (
                <div className="space-y-2">
                  {batch.godowns.map((row) => {
                    const edit = editMap[row.inventory_id]
                    const isLoading = loadingMap[row.inventory_id]
                    return (
                      <div
                        key={row.inventory_id}
                        className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs font-medium text-apple-text-2">{row.godown_name}</p>
                          <div className="flex gap-4 mt-1.5">
                            <span className="text-xs text-apple-text-3">
                              <span className="font-semibold text-apple-text-1">{row.boxes}</span> boxes
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
