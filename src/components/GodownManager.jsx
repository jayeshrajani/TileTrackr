import { useEffect, useState } from 'react'
import {
  createGodown,
  deleteGodown,
  getGodownInventoryCount,
  getLocationInventoryCount,
  updateGodownLocations,
} from '../services/inventoryService'

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
    <div className="modal-root" aria-modal="true" role="alertdialog">
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={phase !== 'deleting' ? onCancel : undefined} />

      <div className="modal-panel sm:max-w-sm">

        <div className="p-6 space-y-5">
          {/* Icon + Title */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${ phase === 'blocked' ? 'bg-amber-50' : 'bg-red-50' }`}>
            {phase === 'blocked' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 leading-snug">
              {phase === 'blocked' ? 'Cannot delete godown' : `Delete "${godown.name}"?`}
            </h2>
            <p className="text-[13px] text-slate-500">{godown.name}</p>
          </div>

          {/* Body */}
          {phase === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
              Checking stock data…
            </div>
          )}

          {phase === 'blocked' && info && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                This godown still has active stock. Remove or reassign it before deleting.
              </p>
              {/* Impact summary */}
              <div className="rounded-xl bg-amber-50 border border-amber-200/70 divide-y divide-amber-200/70">
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[13px] text-amber-800">Products affected</span>
                  <span className="text-sm font-semibold text-amber-900 tabular-nums">{info.products}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[13px] text-amber-800">Stock entries</span>
                  <span className="text-sm font-semibold text-amber-900 tabular-nums">{info.rows}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[13px] text-amber-800">Total stock (boxes)</span>
                  <span className="text-sm font-semibold text-amber-900 tabular-nums">{info.stock.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {(phase === 'safe' || phase === 'deleting') && (
            <p className="text-sm text-slate-600 leading-relaxed">
              This godown has <span className="font-semibold text-slate-900">no stock</span> and will be permanently removed.
              This action <span className="font-semibold text-red-600">cannot be undone</span>.
            </p>
          )}

          {/* Actions */}
          <div className={`grid gap-3 pt-1 ${phase === 'blocked' || phase === 'loading' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {phase !== 'deleting' && (
              <button type="button" onClick={onCancel} className="btn-secondary py-3">
                {phase === 'blocked' ? 'OK, got it' : 'Cancel'}
              </button>
            )}
            {(phase === 'safe' || phase === 'deleting') && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={phase === 'deleting'}
                className={`btn-danger py-3 ${phase === 'deleting' ? 'col-span-2' : ''}`}
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

function GodownManager({ godowns, onGodownDeleted, onGodownAdded, onGodownUpdated }) {
  const [name, setName]               = useState('')
  const [loading, setLoading]         = useState(false)
  const [pendingGodown, setPendingGodown] = useState(null)
  const [locationDrafts, setLocationDrafts] = useState({})
  const [locationError, setLocationError] = useState('')
  const [savingLocationFor, setSavingLocationFor] = useState('')
  const [deletingLocationKey, setDeletingLocationKey] = useState('')

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

  const updateLocationDraft = (godownId, value) => {
    setLocationDrafts((current) => ({
      ...current,
      [godownId]: value,
    }))
  }

  const handleAddLocation = async (godownId) => {
    const godown = godowns.find((item) => item.id === godownId)
    const trimmed = (locationDrafts[godownId] || '').trim()
    if (!trimmed || !godown) return

    const currentLocations = Array.isArray(godown.locations) ? godown.locations : []
    if (currentLocations.some((location) => location.toLowerCase() === trimmed.toLowerCase())) {
      setLocationError('This location already exists in that godown.')
      return
    }

    setSavingLocationFor(godownId)
    setLocationError('')
    const result = await updateGodownLocations(godownId, [...currentLocations, trimmed])
    setSavingLocationFor('')

    if (!result.ok) {
      const missingColumn = result.error?.code === '42703'
      setLocationError(
        missingColumn
          ? 'Add a locations jsonb column to the godowns table to save predefined locations here.'
          : 'Could not save this location right now.'
      )
      return
    }

    updateLocationDraft(godownId, '')
    if (onGodownUpdated) onGodownUpdated()
  }

  const handleDeleteLocation = async (godownId, locationName) => {
    const godown = godowns.find((item) => item.id === godownId)
    if (!godown) return

    const locationKey = `${godownId}:${locationName}`
    setDeletingLocationKey(locationKey)
    setLocationError('')

    // Check if any products exist in this sublocation
    const { count } = await getLocationInventoryCount(godownId, locationName)
    if (count > 0) {
      setDeletingLocationKey('')
      setLocationError(`Cannot delete "${locationName}" — products still exist in this location.`)
      return
    }

    const currentLocations = Array.isArray(godown.locations) ? godown.locations : []
    const nextLocations = currentLocations.filter((location) => location !== locationName)

    const result = await updateGodownLocations(godownId, nextLocations)
    setDeletingLocationKey('')

    if (!result.ok) {
      const missingColumn = result.error?.code === '42703'
      setLocationError(
        missingColumn
          ? 'Add a locations jsonb column to the godowns table to save predefined locations here.'
          : 'Could not delete this saved location right now.'
      )
      return
    }

    if (onGodownUpdated) onGodownUpdated()
  }

  return (
    <div className="space-y-5">
      {pendingGodown && (
        <DeleteModal
          godown={pendingGodown}
          onCancel={() => setPendingGodown(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* Page header */}
      <div>
        <h1 className="page-title">Godowns</h1>
        <p className="page-subtitle">Manage each godown and its saved internal locations.</p>
      </div>

      {locationError && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-amber-900">{locationError}</p>
          <p className="text-[13px] text-amber-800 mt-1">Recommended schema: add a locations jsonb column on godowns instead of creating a separate locations table.</p>
        </div>
      )}

      {/* Godown list */}
      {godowns.length === 0 ? (
        <div className="card py-16 px-6 text-center">
          <p className="text-sm font-semibold text-slate-700">No godowns added yet</p>
          <p className="text-[13px] text-slate-500 mt-1">Add your first storage location below</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {godowns.map((godown) => {
            const locationCount = Array.isArray(godown.locations) ? godown.locations.length : 0
            return (
            <div
              key={godown.id}
              className="card p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-clay-50 text-clay-700 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900 truncate">{godown.name}</p>
                    <p className="text-[13px] text-slate-500">
                      {locationCount} saved location{locationCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn hover:text-red-600 hover:bg-red-50 -mr-1.5"
                  onClick={() => setPendingGodown(godown)}
                  aria-label={`Delete ${godown.name}`}
                  title="Delete godown"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M7 6l1 14h8l1-14"/></svg>
                </button>
              </div>

              <div className="space-y-3">
                {Array.isArray(godown.locations) && godown.locations.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {godown.locations.map((location) => {
                      const locationKey = `${godown.id}:${location}`
                      return (
                      <span
                        key={locationKey}
                        className="inline-flex items-center gap-0.5 h-8 pl-3 pr-1 rounded-full bg-slate-100 text-[13px] font-medium text-slate-700"
                      >
                        {location}
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(godown.id, location)}
                          disabled={deletingLocationKey === locationKey}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 transition-colors hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Delete ${location}`}
                        >
                          {deletingLocationKey === locationKey ? '…' : (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          )}
                        </button>
                      </span>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[13px] text-slate-500">
                    No saved locations yet.
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={locationDrafts[godown.id] || ''}
                    onChange={(event) => updateLocationDraft(godown.id, event.target.value)}
                    placeholder="Add location, e.g. A Rack 3"
                    aria-label={`New location in ${godown.name}`}
                    className="input-modern flex-1 min-w-0"
                    disabled={savingLocationFor === godown.id}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddLocation(godown.id)}
                    disabled={savingLocationFor === godown.id || !(locationDrafts[godown.id] || '').trim()}
                    className="btn-secondary flex-shrink-0 px-4"
                  >
                    {savingLocationFor === godown.id ? '…' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Add godown form */}
      <div className="card p-4 sm:p-5">
        <p className="text-[15px] font-semibold text-slate-900 mb-3">Add new godown</p>
        <form onSubmit={onAdd} className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Main Warehouse"
            aria-label="Godown name"
            className="input-modern flex-1 min-w-0"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary flex-shrink-0 px-5"
          >
            {loading ? '…' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default GodownManager
