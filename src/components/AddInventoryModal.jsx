import { useState } from 'react'

function AddInventoryModal({ tile, batches, godowns, onClose, onSave }) {
  const [mode, setMode] = useState(batches.length > 0 ? 'existing' : 'new')
  const [batchId, setBatchId] = useState(batches[0]?.batch_code ?? '')
  const [newBatchCode, setNewBatchCode] = useState('')
  const [shade, setShade] = useState('')
  const [godownId, setGodownId] = useState(godowns[0]?.id ?? '')
  const [boxes, setBoxes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaveError('')
    if (!godownId) { setSaveError('Please select a godown.'); return }
    if (!boxes || Number(boxes) <= 0) { setSaveError('Boxes must be greater than 0.'); return }
    if (mode === 'existing' && !batchId) { setSaveError('Please select a batch.'); return }
    if (mode === 'new' && !newBatchCode.trim()) { setSaveError('Please enter a batch code.'); return }

    setLoading(true)
    const ok = await onSave({
      tile_id: tile.id,
      batch_code: mode === 'new' ? newBatchCode.trim() : batchId,
      godown_id: godownId,
      boxes: Number(boxes),
    })
    setLoading(false)
    if (ok === false) setSaveError('Failed to save. Check console for details.')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-3xl shadow-apple-modal p-7 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-apple-text-1 tracking-tight">Add Stock</h2>
            {tile && (
              <p className="text-sm text-apple-text-2 mt-0.5">
                {tile.product_name || tile.name}{tile.size ? ` · ${tile.size}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-7 h-7 rounded-full bg-apple-gray flex items-center justify-center hover:bg-apple-gray-2 transition-colors flex-shrink-0 -mt-0.5"
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Batch type toggle */}
        <div>
          <label className="label">Batch Type</label>
          <div className="flex p-1 bg-apple-gray rounded-xl gap-1">
            {['existing', 'new'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={loading || (m === 'existing' && batches.length === 0)}
                className={`flex-1 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 capitalize disabled:opacity-40 ${
                  mode === m
                    ? 'bg-white text-apple-text-1 shadow-apple-xs'
                    : 'text-apple-text-2 hover:text-apple-text-1'
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
                onChange={(e) => setBatchId(e.target.value)}
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
                <label className="label">Shade <span className="text-apple-text-3 font-normal normal-case tracking-normal">(optional)</span></label>
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
              onChange={(e) => setGodownId(e.target.value)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Boxes</label>
              <input
                type="number"
              min={1}
              value={boxes}
              onChange={(e) => setBoxes(e.target.value)}
              placeholder="0"
              className="input-modern"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {saveError && (
        <p className="text-xs font-medium text-apple-red bg-red-50 rounded-xl px-4 py-2.5">{saveError}</p>
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
            disabled={loading}
            className="btn-primary flex-1 justify-center py-3"
          >
            {loading ? 'Saving…' : 'Save Stock'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddInventoryModal
