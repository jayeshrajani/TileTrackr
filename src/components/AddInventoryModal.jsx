import { useState } from 'react'

function AddInventoryModal({ tile, batches, godowns, onClose, onSave }) {
  const [mode, setMode] = useState(batches.length > 0 ? 'existing' : 'new')
  const [batchId, setBatchId] = useState(batches[0]?.batch_code ?? '')
  const [newBatchCode, setNewBatchCode] = useState('')
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? '')
  const [location, setLocation] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  const unit = tile?.unit || 'box'
  const unitPlural = unit === 'box' ? 'boxes' : unit.endsWith('s') ? unit : `${unit}s`
  const selectedGodown = godowns.find((godown) => godown.id === godownId)
  const godownLocations = Array.isArray(selectedGodown?.locations) ? selectedGodown.locations : []

  // Get current stock for selected batch/godown
  const getCurrentStock = () => {
    if (mode === 'existing' && batchId) {
      const batch = batches.find(b => b.batch_code === batchId)
      if (batch) {
        const godownStock = batch.godowns?.find(g => g.godown_id === godownId)
        return godownStock?.boxes || 0
      }
    }
    return 0
  }

  const currentStock = getCurrentStock()
  const newStock = currentStock + quantity

  const incrementQuantity = () => setQuantity(q => q + 1)
  const decrementQuantity = () => {
    setQuantity(q => {
      const newVal = q - 1
      // Prevent going below negative of current stock
      if (mode === 'existing' && newVal < -currentStock) {
        return -currentStock
      }
      return newVal
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaveError('')
    if (!godownId) { setSaveError('Please select a godown.'); return }
    if (quantity === 0) { setSaveError(`Please add or subtract stock.`); return }
    if (mode === 'existing' && !batchId) { setSaveError('Please select a batch.'); return }
    if (mode === 'new' && !newBatchCode.trim()) { setSaveError('Please enter a batch code.'); return }
    
    // Validate subtraction doesn't go negative
    if (quantity < 0 && mode === 'existing') {
      if (Math.abs(quantity) > currentStock) {
        setSaveError(`Cannot subtract ${Math.abs(quantity)} ${unitPlural}. Only ${currentStock} ${unitPlural} available.`)
        return
      }
    }
    
    // Prevent subtraction on new batch
    if (quantity < 0 && mode === 'new') {
      setSaveError('Cannot subtract stock from a new batch. Please use an existing batch.')
      return
    }

    setLoading(true)
    const ok = await onSave({
      tile_id: tile.id,
      batch_code: mode === 'new' ? newBatchCode.trim() : batchId,
      godown_id: godownId,
      location_in_godown: location || null,
      boxes: quantity,
    })
    setLoading(false)
    if (ok === false) setSaveError('Failed to save. Check console for details.')
  }

  return (
    <div className="modal-root z-40" role="dialog" aria-modal="true" aria-labelledby="update-stock-title">
      <div className="modal-backdrop" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="modal-panel sm:max-w-md"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="min-w-0">
            <h2 id="update-stock-title" className="text-lg font-semibold text-slate-900 tracking-tight">Update Stock</h2>
            {tile && (
              <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                {tile.product_name || tile.name}{tile.size ? ` · ${tile.size}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="icon-btn -mr-2"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">
        {/* Batch type toggle */}
        <div className="flex p-1 bg-slate-100 rounded-xl gap-1" role="tablist" aria-label="Batch type">
            {['existing', 'new'].map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setQuantity(0) // Reset quantity when switching modes
                }}
                disabled={loading || (m === 'existing' && batches.length === 0)}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-40 ${
                  mode === m
                    ? 'bg-white text-slate-900 shadow-apple-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'existing' ? 'Existing Batch' : 'New Batch'}
              </button>
            ))}
        </div>

        {/* Batch fields */}
        <div className="space-y-4">
          {mode === 'existing' && batches.length > 0 && (
            <div>
              <label className="label">Select Batch</label>
              <select
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value)
                  setQuantity(0) // Reset quantity when changing batch
                }}
                className="input-modern"
                disabled={loading}
              >
                {batches.map((batch) => (
                  <option key={batch.batch_code} value={batch.batch_code}>
                    {batch.batch_code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'new' && (
            <div>
              <label className="label">Batch Code</label>
              <input
                value={newBatchCode}
                onChange={(e) => setNewBatchCode(e.target.value)}
                placeholder="e.g. BATCH-001"
                className="input-modern"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="label">Godown</label>
            <select
              value={godownId}
              onChange={(e) => {
                setGodownId(e.target.value)
                setLocation('')
                setQuantity(0) // Reset quantity when changing godown
              }}
              className="input-modern"
              disabled={loading}
            >
              {godowns.map((godown) => (
                <option key={godown.id} value={godown.id}>
                  {godown.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Location in Godown <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span></label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input-modern"
              disabled={loading}
            >
              <option value="">{godownId ? 'Select location' : 'Select a godown first'}</option>
              {godownLocations.map((godownLocation) => (
                <option key={godownLocation} value={godownLocation}>
                  {godownLocation}
                </option>
              ))}
            </select>
            {godownId && godownLocations.length === 0 && (
              <p className="mt-2 text-[13px] text-amber-700">No saved locations in this godown yet. Add them from the Godowns tab first.</p>
            )}
          </div>

          {/* Quantity adjuster with +/- buttons */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="label mb-0">Adjust Quantity</label>
              {mode === 'existing' && (
                <p className="text-[13px] text-slate-500">
                  Current: <span className="font-semibold text-slate-900 tabular-nums">{currentStock} {unitPlural}</span>
                </p>
              )}
            </div>
            
            {/* +/- Controls */}
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={decrementQuantity}
                disabled={loading || (mode === 'new' && quantity <= 0) || (mode === 'existing' && quantity <= -currentStock)}
                className="w-14 h-14 rounded-xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Decrease quantity"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0
                    if (mode === 'new' && val < 0) return
                    if (mode === 'existing' && val < -currentStock) return
                    setQuantity(val)
                  }}
                  className="input-modern h-14 text-center !text-xl font-semibold tabular-nums pr-14"
                  disabled={loading}
                  aria-label="Quantity change"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 pointer-events-none">{unitPlural}</span>
              </div>
              
              <button
                type="button"
                onClick={incrementQuantity}
                disabled={loading}
                className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 active:bg-slate-700 transition-colors disabled:opacity-40"
                aria-label="Increase quantity"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            {(quantity !== 0 || mode === 'existing') && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-[13px]">
                <span className={`font-medium ${quantity > 0 ? 'text-emerald-700' : quantity < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  {quantity > 0 ? `Adding ${quantity} ${unitPlural}` : quantity < 0 ? `Subtracting ${Math.abs(quantity)} ${unitPlural}` : 'No change yet'}
                </span>
                {mode === 'existing' && (
                  <span className="text-slate-500">
                    New: <span className={`font-semibold tabular-nums ${newStock < 0 ? 'text-red-600' : 'text-slate-900'}`}>{newStock} {unitPlural}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {saveError && (
          <p className="text-[13px] font-medium text-red-700 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100" role="alert">{saveError}</p>
        )}

        {/* Actions */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary py-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || quantity === 0}
            className={`btn-base py-3 text-white ${
              quantity > 0
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : quantity < 0
                ? 'bg-red-600 hover:bg-red-700'
                : '!bg-slate-100 !text-slate-400'
            }`}
          >
            {loading ? 'Saving…' : quantity === 0 ? 'No Change' : quantity > 0 ? `Add ${quantity} ${unitPlural}` : `Subtract ${Math.abs(quantity)} ${unitPlural}`}
          </button>
        </div>
        </div>
      </form>
    </div>
  )
}

export default AddInventoryModal
