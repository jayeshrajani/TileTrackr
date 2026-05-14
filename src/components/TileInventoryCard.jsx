import { useState } from 'react'
import { updateInventoryEntry } from '../services/inventoryService'
import { formatQty } from '../utils/formatQty'

function getGradeTagClass(grade) {
  const normalizedGrade = grade?.trim().toLowerCase()

  if (normalizedGrade === 'standard') {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (normalizedGrade === 'commercial') {
    return 'border border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border border-indigo-200 bg-indigo-50 text-indigo-600'
}

function getPackageCount(value, fallback) {
  const source = value ?? fallback
  if (source == null || source === '') return null
  if (typeof source === 'number') {
    return Number.isFinite(source) && source > 0 ? Math.round(source) : null
  }
  const match = String(source).match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function TileInventoryCard({ tileInventory, onQuickAdd }) {
  const { tile, batches, totalBoxes } = tileInventory
  const [editMap, setEditMap] = useState({})
  const [loadingMap, setLoadingMap] = useState({})
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const unit = tile?.unit || 'box'
  const unitPlural = unit.endsWith('s') ? unit : `${unit}s`
  const packageCount = getPackageCount(tile.package_spec, tile.pieces_per_box)

  const startEdit = (row) => {
    setEditMap((prev) => ({
      ...prev,
      [row.inventory_id]: {
        boxes: row.boxes,
        pieces_per_box: row.pieces_per_box,
      },
    }))
  }

  const onEditChange = (inventoryId, field, value) => {
    setEditMap((prev) => ({
      ...prev,
      [inventoryId]: {
        ...prev[inventoryId],
        [field]: Number(value),
      },
    }))
  }

  const saveEdit = async (inventoryId) => {
    const edited = editMap[inventoryId]
    if (!edited || edited.boxes < 0 || edited.pieces_per_box < 1) return
    
    setLoadingMap(prev => ({ ...prev, [inventoryId]: true }))
    await updateInventoryEntry({
      inventory_id: inventoryId,
      boxes: edited.boxes,
      pieces_per_box: edited.pieces_per_box,
    })
    setEditMap((prev) => {
      const next = { ...prev }
      delete next[inventoryId]
      return next
    })
    setLoadingMap(prev => ({ ...prev, [inventoryId]: false }))
  }

  return (
    <div className="space-y-6">
      {/* Basic Info Box */}
      <section className="card p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Brand
              </p>
              <p className="text-lg text-slate-800">{tile.brand}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Product Name
              </p>
              <h2 className="text-3xl font-bold text-slate-900">
                {tile.product_name || tile.name}
              </h2>
              {tile.grade && (
                <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getGradeTagClass(tile.grade)}`}>
                  {tile.grade}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Size
                </p>
                <p className="text-lg font-bold text-indigo-600">{tile.size}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Current Stock
                </p>
                <p className="text-lg font-bold text-indigo-600">{formatQty(totalBoxes, packageCount, unit)}</p>
              </div>
              {packageCount != null && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Package
                  </p>
                  <p className="text-lg font-bold text-indigo-600">{packageCount} pcs/box</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="flex-1 md:flex-none btn-secondary px-6 py-3"
            >
              {isDetailsOpen ? '▼ Details' : '▶ Details'}
            </button>
            <button
              type="button"
              onClick={onQuickAdd}
              className="btn-primary flex-1 md:flex-none"
            >
              Add Stock
            </button>
          </div>
        </div>
      </section>

      {/* Detailed Info - Collapsible */}
      {isDetailsOpen && (
        <section className="card p-8 space-y-8">
          {/* Additional Attributes */}
          {(tile.finish || tile.category || tile.grade || packageCount != null) && (
            <div className="grid grid-cols-2 gap-8">
              {tile.finish && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Finish
                  </p>
                  <p className="text-lg font-bold text-slate-800">{tile.finish}</p>
                </div>
              )}
              {tile.category && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Category
                  </p>
                  <p className="text-lg font-bold text-slate-800">{tile.category}</p>
                </div>
              )}
              {tile.grade && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Grade
                  </p>
                  <p className="text-lg font-bold text-slate-800">{tile.grade}</p>
                </div>
              )}
              {packageCount != null && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Package
                  </p>
                  <p className="text-lg font-bold text-slate-800">{packageCount} pcs/box</p>
                </div>
              )}
            </div>
          )}

          {/* Batch Stock Details */}
          {batches.length === 0 ? (
            <div className="border-t border-slate-100 pt-8">
              <p className="text-lg text-slate-400">No batches yet for this product.</p>
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-8 space-y-8">
              <h3 className="text-2xl font-bold text-slate-900">Batch Stock</h3>
              {batches.map((batch) => (
                <article
                  key={batch.batch_code}
                  className="border border-slate-100 bg-white rounded-xl p-6"
                >
                  <div className="flex items-start justify-between gap-6 mb-6">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Batch Code
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-900">
                        {batch.batch_code}
                      </p>
                    </div>
                  </div>

                  {batch.godowns.length === 0 ? (
                    <p className="text-lg text-slate-400">No stock in any godown.</p>
                  ) : (
                    <div className="space-y-4">
                      {batch.godowns.map((row) => {
                        const edit = editMap[row.inventory_id]
                        const isLoading = loadingMap[row.inventory_id]
                        return (
                          <div
                            key={row.inventory_id}
                            className="border border-slate-100 bg-slate-50 rounded-xl p-5"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                  Location
                                </p>
                                <p className="mt-2 text-xl font-bold text-slate-800">
                                  {row.godown_name}
                                </p>
                                <div className="mt-4 flex gap-8">
                                  <div>
                                    <p className="text-xs text-slate-400">Quantity</p>
                                    <p className="mt-1 text-2xl font-bold text-indigo-600">
                                      {formatQty(row.boxes, packageCount, unit)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400">Total Pieces</p>
                                    <p className="mt-1 text-2xl font-bold text-indigo-600">
                                      {row.total_pieces}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {edit ? (
                                <div className="flex flex-col gap-3">
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Quantity ({unitPlural})
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={edit.boxes}
                                        onChange={(event) =>
                                          onEditChange(
                                            row.inventory_id,
                                            'boxes',
                                            event.target.value
                                          )
                                        }
                                        className="input-modern"
                                        disabled={isLoading}
                                      />
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(row.inventory_id)}
                                    disabled={isLoading}
                                    className="btn-primary py-2.5"
                                  >
                                    {isLoading ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default TileInventoryCard
