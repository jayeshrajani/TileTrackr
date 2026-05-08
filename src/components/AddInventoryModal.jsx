import { useState } from 'react'

function AddInventoryModal({ tile, batches, godowns, onClose, onSave }) {
  const [mode, setMode] = useState(batches.length > 0 ? 'existing' : 'new')
  const [batchId, setBatchId] = useState(batches[0]?.batch_code ?? '')
  const [newBatchCode, setNewBatchCode] = useState('')
  const [shade, setShade] = useState('')
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? '')
  const [quantity, setQuantity] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  const unit = tile?.unit || 'box'
  const unitPlural = unit.endsWith('s') ? unit : `${unit}s`

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
      boxes: quantity,
    })
    setLoading(false)
    if (ok === false) setSaveError('Failed to save. Check console for details.')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-2xl shadow-apple-modal p-7 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Update Stock</h2>
            {tile && (
              <p className="text-sm text-slate-500 mt-0.5">
                {tile.product_name || tile.name}{tile.size ? ` · ${tile.size}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Batch type toggle */}
        <div>
          <label className="label">Batch Type</label>
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
            {['existing', 'new'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setQuantity(0) // Reset quantity when switching modes
                }}
                disabled={loading || (m === 'existing' && batches.length === 0)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize disabled:opacity-40 ${
                  mode === m
                    ? 'bg-white text-slate-900 shadow-apple-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'existing' ? 'Existing Batch' : 'New Batch'}
              </button>
            ))}
          </div>
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
            <>
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
              <div>
                <label className="label">Shade <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span></label>
                <input
                  value={shade}
                  onChange={(e) => setShade(e.target.value)}
                  placeholder="e.g. Light Gray"
                  className="input-modern"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div>
            <label className="label">Godown</label>
            <select
              value={godownId}
              onChange={(e) => {
                setGodownId(e.target.value)
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

          {/* Quantity adjuster with +/- buttons */}
          <div>
            <label className="label">Adjust Quantity</label>
            
            {/* Current Stock Display */}
            {mode === 'existing' && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 mb-3 border border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Current Stock</p>
                <p className="text-2xl font-bold text-slate-900">{currentStock} <span className="text-base font-medium text-slate-400">{unitPlural}</span></p>
              </div>
            )}
            
            {/* +/- Controls */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={decrementQuantity}
                disabled={loading || (mode === 'new' && quantity <= 0) || (mode === 'existing' && quantity <= -currentStock)}
                className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-apple-xs"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
              
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0
                      if (mode === 'new' && val < 0) return
                      if (mode === 'existing' && val < -currentStock) return
                      setQuantity(val)
                    }}
                    className="input-modern text-center text-lg font-bold"
                    disabled={loading}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{unitPlural}</span>
                </div>
                {mode === 'existing' && (
                  <div className="mt-2 text-center">
                    <p className="text-xs text-slate-400">
                      New Stock: <span className={`font-bold ${newStock < 0 ? 'text-red-500' : newStock > currentStock ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {newStock} {unitPlural}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={incrementQuantity}
                disabled={loading}
                className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors disabled:opacity-40 shadow-apple-xs"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            {quantity !== 0 && (
              <div className="mt-3 text-center">
                <p className={`text-sm font-semibold ${quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {quantity > 0 ? `Adding ${quantity} ${unitPlural}` : `Subtracting ${Math.abs(quantity)} ${unitPlural}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {saveError && (
          <p className="text-xs font-medium text-red-600 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">{saveError}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1 justify-center py-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || quantity === 0}
            className={`flex-1 justify-center py-3 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
              quantity > 0
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 border-emerald-500 shadow-apple-xs'
                : quantity < 0
                ? 'bg-red-500 text-white hover:bg-red-600 border-red-500 shadow-apple-xs'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {loading ? 'Saving…' : quantity === 0 ? 'No Change' : quantity > 0 ? `Add ${quantity} ${unitPlural}` : `Subtract ${Math.abs(quantity)} ${unitPlural}`}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddInventoryModal
