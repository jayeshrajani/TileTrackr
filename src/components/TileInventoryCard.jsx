import { useState } from 'react'
import { updateInventoryEntry } from '../services/inventoryService'

function TileInventoryCard({ tileInventory, onQuickAdd }) {
  const { tile, batches, totalBoxes } = tileInventory
  const [editMap, setEditMap] = useState({})
  const [loadingMap, setLoadingMap] = useState({})
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

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
      <section className="border border-slate-200 bg-white p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-light mb-1">
                Brand
              </p>
              <p className="text-lg text-slate-900">{tile.brand}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-light mb-1">
                Product Name
              </p>
              <h2 className="text-3xl font-bold text-slate-900">
                {tile.product_name || tile.name}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-light mb-1">
                  Size
                </p>
                <p className="text-lg font-bold text-accent">{tile.size}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-light mb-1">
                  Current Stock
                </p>
                <p className="text-lg font-bold text-accent">{totalBoxes} boxes</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="flex-1 md:flex-none border border-slate-300 bg-slate-50 px-6 py-3 text-sm font-bold uppercase text-slate-900 tracking-wide transition hover:bg-slate-100"
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
        <section className="border border-slate-200 bg-white p-12 space-y-8">
          {/* Additional Attributes */}
          {(tile.finish || tile.category) && (
            <div className="grid grid-cols-2 gap-8">
              {tile.finish && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-light mb-2">
                    Finish
                  </p>
                  <p className="text-lg font-bold text-slate-900">{tile.finish}</p>
                </div>
              )}
              {tile.category && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-light mb-2">
                    Category
                  </p>
                  <p className="text-lg font-bold text-slate-900">{tile.category}</p>
                </div>
              )}
            </div>
          )}

          {/* Batch Stock Details */}
          {batches.length === 0 ? (
            <div className="border-t border-slate-200 pt-8">
              <p className="text-lg text-muted">No batches yet for this product.</p>
            </div>
          ) : (
            <div className="border-t border-slate-200 pt-8 space-y-8">
              <h3 className="text-2xl font-bold text-slate-900">Batch Stock</h3>
              {batches.map((batch) => (
                <article
                  key={batch.batch_code}
                  className="border border-slate-200 bg-white p-8"
                >
                  <div className="flex items-start justify-between gap-6 mb-8">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-light">
                        Batch Code
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {batch.batch_code}
                      </p>
                    </div>
                  </div>

                  {batch.godowns.length === 0 ? (
                    <p className="text-lg text-muted">No stock in any godown.</p>
                  ) : (
                    <div className="space-y-6">
                      {batch.godowns.map((row) => {
                        const edit = editMap[row.inventory_id]
                        const isLoading = loadingMap[row.inventory_id]
                        return (
                          <div
                            key={row.inventory_id}
                            className="border border-slate-200 bg-slate-50 p-6"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-light">
                                  Location
                                </p>
                                <p className="mt-2 text-xl font-bold text-slate-900">
                                  {row.godown_name}
                                </p>
                                <div className="mt-4 flex gap-8">
                                  <div>
                                    <p className="text-xs text-muted-light">Boxes</p>
                                    <p className="mt-1 text-2xl font-bold text-accent">
                                      {row.boxes}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-light">Total Pieces</p>
                                    <p className="mt-1 text-2xl font-bold text-accent">
                                      {row.total_pieces}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {edit ? (
                                <div className="flex flex-col gap-3">
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="text-xs font-bold uppercase tracking-widest text-muted-light">
                                        Boxes
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
                                    className="bg-accent text-white border border-accent px-6 py-3 text-sm font-bold uppercase tracking-wide transition hover:bg-accent-dark disabled:opacity-50"
                                  >
                                    {isLoading ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="text-sm font-bold uppercase text-accent tracking-wide transition hover:text-accent-dark"
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
