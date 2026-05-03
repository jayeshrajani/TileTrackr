import { useState, useEffect } from 'react'
import { createGodown, deleteGodown, getGodownInventoryCount } from '../services/inventoryService'

function DeleteModal({ godown, onCancel, onDeleted }) {
  const [phase, setPhase]     = useState('loading') // loading | safe | blocked | deleting
  const [info, setInfo]       = useState(null)       // { rows, stock, products }

  useEffect(() => {
    getGodownInventoryCount(godown.id).then((data) => {
      setInfo(data)
      setPhase(data.stock > 0 ? 'blocked' : 'safe')
    })
  }, [godown.id])

  const handleDelete = async () => {
    setPhase('deleting')
    const ok = await deleteGodown(godown.id)
    if (ok) onDeleted()
    else setPhase('safe') // put back if Supabase rejects (e.g. FK restrict)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={phase !== 'deleting' ? onCancel : undefined} />

      <div className="relative bg-white rounded-3xl shadow-apple-modal w-full max-w-sm overflow-hidden">

        {/* Coloured top bar */}
        <div className={`h-1.5 w-full ${ phase === 'blocked' ? 'bg-amber-400' : 'bg-apple-red' }`} />

        <div className="p-7 space-y-5">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center ${ phase === 'blocked' ? 'bg-amber-50' : 'bg-red-50' }`}>
              {phase === 'blocked' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <polyline points="3 6 5 6 21 6" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M19 6l-1 14H6L5 6" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 11v6M14 11v6" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M9 6V4h6v2" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-apple-text-1 leading-snug">
                {phase === 'blocked' ? 'Cannot Delete Godown' : `Delete "${godown.name}"?`}
              </h2>
              <p className="text-xs text-apple-text-3 mt-0.5">{godown.name}</p>
            </div>
          </div>

          {/* Body */}
          {phase === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-apple-text-3">
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
              Checking stock data…
            </div>
          )}

          {phase === 'blocked' && info && (
            <div className="space-y-3">
              <p className="text-sm text-apple-text-2">
                This godown still has active stock. Remove or reassign it before deleting.
              </p>
              {/* Impact summary */}
              <div className="rounded-2xl bg-amber-50 border border-amber-100 divide-y divide-amber-100">
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-amber-700 font-medium">Products affected</span>
                  <span className="text-sm font-bold text-amber-900">{info.products}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-amber-700 font-medium">Stock entries</span>
                  <span className="text-sm font-bold text-amber-900">{info.rows}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-xs text-amber-700 font-medium">Total stock (boxes)</span>
                  <span className="text-sm font-bold text-amber-900">{info.stock.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {(phase === 'safe' || phase === 'deleting') && (
            <div className="space-y-3">
              <p className="text-sm text-apple-text-2">
                This godown has <span className="font-semibold">no stock</span> and will be permanently removed.
                This action <span className="font-semibold text-apple-red">cannot be undone</span>.
              </p>
              {/* Visual warning stripe */}
              <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <circle cx="8" cy="8" r="7" stroke="#ff3b30" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 11h.01" stroke="#ff3b30" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-xs text-red-600 font-medium">Deleting a godown is irreversible.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {phase !== 'deleting' && (
              <button type="button" onClick={onCancel} className="btn-secondary flex-1">
                {phase === 'blocked' ? 'OK, got it' : 'Cancel'}
              </button>
            )}
            {(phase === 'safe' || phase === 'deleting') && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={phase === 'deleting'}
                className="flex-1 px-4 py-2.5 rounded-xl bg-apple-red text-white text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {phase === 'deleting' ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
                ) : 'Delete Godown'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GodownManager({ godowns, onGodownDeleted, onGodownAdded }) {
  const [name, setName]               = useState('')
  const [loading, setLoading]         = useState(false)
  const [pendingGodown, setPendingGodown] = useState(null)

  const onAdd = async (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    await createGodown(trimmed)
    setName('')
    setLoading(false)
    if (onGodownAdded) onGodownAdded()
  }

  const handleDeleted = () => {
    setPendingGodown(null)
    if (onGodownDeleted) onGodownDeleted()
  }

  return (
    <div className="space-y-8">
      {pendingGodown && (
        <DeleteModal
          godown={pendingGodown}
          onCancel={() => setPendingGodown(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Page header */}
      <div>
        <p className="caption mb-1.5">Storage Locations</p>
        <h1 className="text-[28px] font-bold tracking-tight text-apple-text-1">Godowns</h1>
      </div>

      {/* Godown list */}
      {godowns.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-medium text-apple-text-2">No godowns added yet</p>
          <p className="text-xs text-apple-text-3 mt-1">Add your first storage location below</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {godowns.map((godown) => (
            <div
              key={godown.id}
              className="card px-5 py-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-apple-blue-light flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 6l6-4 6 4v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6z" stroke="#0071e3" strokeWidth="1.4" fill="none"/>
                    <path d="M5 13V8h4v5" stroke="#0071e3" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-apple-text-1 truncate">{godown.name}</p>
              </div>
              <button
                className="btn-danger px-3 py-1.5 text-xs flex-shrink-0"
                onClick={() => setPendingGodown(godown)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add godown form */}
      <div className="card p-6">
        <p className="text-sm font-semibold text-apple-text-1 mb-4">Add New Godown</p>
        <form onSubmit={onAdd} className="flex gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Main Warehouse"
            className="input-modern flex-1"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary flex-shrink-0 px-6"
          >
            {loading ? '…' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default GodownManager
