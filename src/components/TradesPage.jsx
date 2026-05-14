import { useEffect, useMemo, useRef, useState } from 'react'
import { getAllTiles, createTransaction, getAllTransactions, reverseTransaction, deleteTransaction, createGoodsReturn, addInventoryEntry, getTileInventory, getAllGodowns, getAllCategories, createCategory, createProduct, getProductFieldOptions, getFilterOptions, addFilterOption } from '../services/inventoryService'
import { formatQty } from '../utils/formatQty'

function getPackageCount(value, fallback) {
  const source = value ?? fallback
  if (source == null || source === '') return null
  if (typeof source === 'number') return Number.isFinite(source) && source > 0 ? Math.round(source) : null
  const match = String(source).match(/\d+/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function getMappedInventoryRows(snapshot) {
  return (snapshot?.batches || [])
    .flatMap((batch) => (batch.godowns || []).map((row) => ({
      ...row,
      batch_code: batch.batch_code,
    })))
    .filter((row) => Number(row.boxes) > 0)
    .sort((a, b) => {
      if (b.boxes !== a.boxes) return b.boxes - a.boxes
      return (a.batch_code || '').localeCompare(b.batch_code || '')
    })
}

function TradesPage({ onTransactionCreated }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalType, setModalType] = useState('buy')
  const [currentPage, setCurrentPage] = useState(1)
  const [reverseConfirm, setReverseConfirm] = useState(null)
  const [reversing, setReversing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [returnModal, setReturnModal] = useState(null)
  const [returnForm, setReturnForm] = useState({ quantity: '', condition: 'good', reason: '' })
  const [returning, setReturning] = useState(false)
  const [returnError, setReturnError] = useState('')
  const ITEMS_PER_PAGE = 10

  const loadTransactions = async () => {
    setLoading(true)
    const data = await getAllTransactions()
    setTransactions(data)
    setLoading(false)
  }

  useEffect(() => { loadTransactions() }, [])

  const handleTransactionCreated = () => {
    setShowAddModal(false)
    loadTransactions()
    if (onTransactionCreated) onTransactionCreated()
  }

  const openModal = (type) => {
    setModalType(type)
    setShowAddModal(true)
  }

  const handleReverse = async () => {
    if (!reverseConfirm) return
    setReversing(true)
    const ok = await reverseTransaction(reverseConfirm)
    setReversing(false)
    setReverseConfirm(null)
    if (ok) {
      loadTransactions()
      if (onTransactionCreated) onTransactionCreated()
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm || deleteInput !== 'delete') return
    setDeleting(true)
    const ok = await deleteTransaction(deleteConfirm.id)
    setDeleting(false)
    setDeleteConfirm(null)
    setDeleteInput('')
    if (ok) {
      loadTransactions()
      if (onTransactionCreated) onTransactionCreated()
    }
  }

  const openReturnModal = (txn) => {
    setReturnModal(txn)
    setReturnForm({ quantity: '', condition: 'good', reason: '' })
    setReturnError('')
  }

  const handleReturn = async () => {
    if (!returnModal) return
    const qty = Number(returnForm.quantity)
    if (!qty || qty <= 0) { setReturnError('"Return Quantity" is required. Please enter the number of boxes being returned.'); return }
    if (qty > returnModal.quantity) { setReturnError(`"Return Quantity" exceeds the sold quantity. Maximum is ${returnModal.quantity}.`); return }
    setReturning(true)
    setReturnError('')
    const ok = await createGoodsReturn({
      originalTxn: returnModal,
      quantity: qty,
      condition: returnForm.condition,
      reason: returnForm.reason.trim(),
      godown_id: returnModal.godown_id,
      batch_code: returnModal.batch_code,
      location_in_godown: returnModal.location_in_godown,
    })
    setReturning(false)
    if (ok) {
      setReturnModal(null)
      loadTransactions()
      if (onTransactionCreated) onTransactionCreated()
    } else {
      setReturnError('Failed to process return. Try again.')
    }
  }

  // Pagination
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <div className="space-y-6">
      {showAddModal && (
        <AddTransactionModal
          initialType={modalType}
          onClose={() => setShowAddModal(false)}
          onCreated={handleTransactionCreated}
        />
      )}

      {/* Reverse Confirmation Modal */}
      {reverseConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !reversing && setReverseConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-apple-modal w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Reverse Transaction?</h3>
            <p className="text-sm text-slate-600">
              This will mark the transaction as reversed and {reverseConfirm.transaction_type === 'buy' ? 'subtract' : 'add back'}{' '}
              <span className="font-semibold">{reverseConfirm.quantity} {reverseConfirm.unit || 'boxes'}</span> of{' '}
              <span className="font-semibold">{reverseConfirm.product_name}</span>.
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setReverseConfirm(null)} disabled={reversing} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleReverse} disabled={reversing} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50">
                {reversing ? 'Reversing…' : 'Yes, Reverse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && (setDeleteConfirm(null), setDeleteInput(''))} />
          <div className="relative bg-white rounded-2xl shadow-apple-modal w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-600">Delete Transaction</h3>
            <p className="text-sm text-slate-600">
              This will <span className="font-semibold text-red-600">permanently delete</span> the {deleteConfirm.transaction_type} of{' '}
              <span className="font-semibold">{deleteConfirm.quantity} {deleteConfirm.unit || 'boxes'}</span> of{' '}
              <span className="font-semibold">{deleteConfirm.product_name}</span>.
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              This will NOT adjust inventory. Use "Reverse" if you need to undo the stock change. This action is irreversible.
            </p>
            <div>
              <label className="label">Type <span className="font-bold text-red-600">delete</span> to confirm</label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="delete"
                className="input-modern"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setDeleteConfirm(null); setDeleteInput('') }} disabled={deleting} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting || deleteInput !== 'delete'} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {deleting ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goods Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !returning && setReturnModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-apple-modal w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Goods Return</h3>
                <p className="text-xs text-slate-400">Customer returning goods</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-slate-800">{returnModal.product_name}</p>
              <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
                <span>Sold: <span className="font-semibold text-slate-700">{returnModal.quantity} {returnModal.unit || 'boxes'}</span></span>
                {returnModal.party_name && <span>To: {returnModal.party_name}</span>}
                {returnModal.batch_code && <span>Batch: {returnModal.batch_code}</span>}
              </div>
            </div>

            <div>
              <label className="label">Return Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0.01"
                max={returnModal.quantity}
                step="0.01"
                value={returnForm.quantity}
                onChange={(e) => setReturnForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder={`Max ${returnModal.quantity}`}
                className="input-modern"
              />
            </div>

            <div>
              <label className="label">Condition</label>
              <div className="flex gap-2">
                {['good', 'damaged', 'defective'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setReturnForm(f => ({ ...f, condition: c }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                      returnForm.condition === c
                        ? c === 'good' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : c === 'damaged' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-red-50 border-red-300 text-red-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Reason (optional)</label>
              <input
                type="text"
                value={returnForm.reason}
                onChange={(e) => setReturnForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Wrong size, Broken tiles"
                className="input-modern"
              />
            </div>

            {returnError && <p className="text-xs font-medium text-red-500">{returnError}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setReturnModal(null)} disabled={returning} className="btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={handleReturn} disabled={returning || !returnForm.quantity} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50">
                {returning ? 'Processing…' : 'Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">Record buy/sell transactions and manage stock automatically.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 mt-1">
          <button type="button" onClick={() => openModal('buy')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold shadow-apple-xs hover:bg-emerald-600 transition-all duration-200 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Buy
          </button>
          <button type="button" onClick={() => openModal('sell')} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold shadow-apple-xs hover:bg-red-600 transition-all duration-200 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Sell
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[2.5px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-semibold text-slate-600">No transactions yet</p>
          <p className="text-xs text-slate-400 mt-1">Click Buy or Sell to record your first transaction</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedTransactions.map((txn) => (
            <div key={txn.id} className={`card p-5 hover:shadow-apple-sm transition-shadow ${txn.is_reversed ? 'opacity-60 border-dashed' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      txn.transaction_type === 'buy'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : txn.transaction_type === 'return_in'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {txn.transaction_type === 'buy' ? '↓ Buy' : txn.transaction_type === 'return_in' ? '↩ Return' : '↑ Sell'}
                    </span>
                    {txn.is_reversed && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">REVERSED</span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      {new Date(txn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{txn.product_name}</p>
                  {txn.party_name && (
                    <p className="text-xs text-slate-500 mt-1">{txn.transaction_type === 'buy' ? 'From' : 'To'}: {txn.party_name}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                    <span><span className="font-semibold text-slate-700">{txn.quantity}</span> {Number(txn.quantity) === 1 ? txn.unit : txn.unit === 'box' ? 'boxes' : (txn.unit + 's')}</span>
                    {txn.godown_name && <span>• {txn.godown_name}</span>}
                    {txn.location_in_godown && <span>• {txn.location_in_godown}</span>}
                    {txn.batch_code && <span>• Batch: {txn.batch_code}</span>}
                    {txn.invoice_number && <span>• Inv: {txn.invoice_number}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                  {txn.total_price ? (
                    <>
                      <p className="text-lg font-bold text-slate-900">₹{txn.total_price.toLocaleString()}</p>
                      {txn.unit_price && <p className="text-xs text-slate-400">@ ₹{txn.unit_price}/{txn.unit}</p>}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No price</p>
                  )}
                  {!txn.is_reversed ? (
                    <div className="flex flex-col items-end gap-1">
                      {txn.transaction_type === 'sell' && (
                        <button
                          type="button"
                          onClick={() => openReturnModal(txn)}
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          Goods Return
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setReverseConfirm(txn)}
                        className="text-[10px] font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        Reverse
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(txn)}
                      className="text-[10px] font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {txn.notes && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">{txn.notes}</p>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">← Prev</button>
              <span className="text-xs text-slate-500 tabular-nums">Page {currentPage} of {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors">Next →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMBO INPUT — Type to filter existing options, or add new ones inline
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ComboInput({ value, onChange, options = [], placeholder, onAdd }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value || '')
  const ref = useRef(null)

  useEffect(() => { setSearch(value || '') }, [value])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase().trim()))
  const exactMatch = options.some((o) => o.toLowerCase() === search.toLowerCase().trim())
  const showAdd = search.trim() && !exactMatch && typeof onAdd === 'function'

  const handleSelect = (opt) => {
    onChange(opt)
    setSearch(opt)
    setOpen(false)
  }

  const handleAdd = async () => {
    const trimmed = search.trim()
    if (!trimmed) return
    if (onAdd) await onAdd(trimmed)
    onChange(trimmed)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="input-modern"
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showAdd) && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-apple-sm max-h-[160px] overflow-y-auto">
          {filtered.slice(0, 20).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${opt === value ? 'bg-indigo-50 font-medium' : 'text-slate-700'}`}
            >
              {opt}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onClick={handleAdd}
              className="w-full text-left px-3 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 border-t border-slate-100 flex items-center gap-1.5"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Add "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADD TRANSACTION MODAL — Multi-product cart, searchable product, multi-batch sell
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AddTransactionModal({ initialType, onClose, onCreated }) {
  const [products, setProducts] = useState([])
  const [godowns, setGodowns] = useState([])
  const [categories, setCategories] = useState([])
  const [filterOptions, setFilterOptions] = useState({ brands: [], sizes: [], finishes: [], grades: [] })
  const [inventorySnapshot, setInventorySnapshot] = useState(null)
  const [inventoryLoading, setInventoryLoading] = useState(false)

  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const productSearchRef = useRef(null)
  const dropdownRef = useRef(null)

  // Product mode: existing vs new (new only available for buy)
  const [productMode, setProductMode] = useState('existing')

  // Sell unit (box vs piece)
  const [sellUnit, setSellUnit] = useState('box')

  // Multi-batch allocation for sell
  const [batchAllocations, setBatchAllocations] = useState({})

  // Cart system
  const [cartItems, setCartItems] = useState([])
  const [addingToCart, setAddingToCart] = useState(false)

  const [form, setForm] = useState({
    product_id: '',
    transaction_type: initialType || 'buy',
    quantity: '',
    sell_unit: 'box',
    unit_price: '',
    total_price: '',
    party_name: '',
    invoice_number: '',
    godown_id: '',
    batch_code: '',
    location_in_godown: '',
    notes: '',
    // New product fields
    product_name: '',
    brand: '',
    size: '',
    finish: '',
    grade: '',
    unit: 'box',
    package_spec: '',
    category_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllTiles().then(setProducts)
    getAllGodowns().then(setGodowns)
    getAllCategories().then(setCategories)
    // Merge filter_options table + unique values from products table
    Promise.all([getFilterOptions(), getProductFieldOptions()]).then(([filterOpts, productOpts]) => {
      const merge = (filterArr, productArr) => {
        const filterValues = (filterArr || []).map(o => typeof o === 'string' ? o : o.value).filter(Boolean)
        const productValues = (productArr || []).filter(Boolean)
        return [...new Set([...filterValues, ...productValues])].sort()
      }
      setFilterOptions({
        brands: merge(filterOpts.brands, productOpts.brands),
        sizes: merge(filterOpts.sizes, productOpts.sizes),
        finishes: merge(filterOpts.finishes, productOpts.finishes),
        grades: merge(filterOpts.grades, productOpts.grades),
      })
    })
  }, [])

  // Close product dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedProduct = products.find(p => p.id === form.product_id)

  const mappedInventoryRows = useMemo(
    () => getMappedInventoryRows(inventorySnapshot),
    [inventorySnapshot]
  )

  // Filter products by search
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    if (!q) return products
    return products.filter(p => {
      const searchable = [p.product_name, p.brand, p.size, p.finish, p.grade].filter(Boolean).join(' ').toLowerCase()
      return searchable.includes(q)
    })
  }, [products, productSearch])

  // Load inventory when product selected
  useEffect(() => {
    if (!form.product_id) {
      setInventorySnapshot(null)
      setBatchAllocations({})
      return
    }
    let cancelled = false
    const load = async () => {
      setInventoryLoading(true)
      const snapshot = await getTileInventory(form.product_id)
      if (cancelled) return
      setInventorySnapshot(snapshot)
      setBatchAllocations({})

      // For buy, pre-fill first godown/batch
      if (form.transaction_type === 'buy') {
        const rows = getMappedInventoryRows(snapshot)
        const firstRow = rows[0]
        if (firstRow) {
          setForm(f => ({ ...f, godown_id: firstRow.godown_id, batch_code: firstRow.batch_code, location_in_godown: firstRow.location_in_godown || '' }))
        }
      }
      setInventoryLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [form.product_id])

  // Auto-calculate total price
  useEffect(() => {
    if (form.quantity && form.unit_price) {
      const total = Number(form.quantity) * Number(form.unit_price)
      setForm(f => ({ ...f, total_price: total.toFixed(2) }))
    }
  }, [form.quantity, form.unit_price])

  // Select product from search
  const selectProduct = (product) => {
    setForm(f => ({ ...f, product_id: product.id }))
    setProductSearch(product.product_name + (product.size ? ` · ${product.size}` : ''))
    setProductDropdownOpen(false)
  }

  // Reset product fields
  const resetProductFields = () => {
    setForm(f => ({
      ...f,
      product_id: '',
      quantity: '',
      sell_unit: 'box',
      unit_price: '',
      total_price: '',
      godown_id: '',
      batch_code: '',
      location_in_godown: '',
      product_name: '',
      brand: '',
      size: '',
      finish: '',
      grade: '',
      unit: 'box',
      package_spec: '',
      category_id: '',
    }))
    setProductSearch('')
    setBatchAllocations({})
    setInventorySnapshot(null)
    setProductMode('existing')
    setSellUnit('box')
  }

  // Validate & add current product to cart (returns the item or null)
  const handleAddToCart = async () => {
    setError('')
    setAddingToCart(true)

    let productId = form.product_id
    let productName = selectedProduct?.product_name || form.product_name
    let productUnit = selectedProduct?.unit || form.unit || 'box'
    const normalizedPackageCount = getPackageCount(form.package_spec)

    // New product mode (BUY only)
    if (productMode === 'new' && form.transaction_type === 'buy') {
      if (!form.product_name.trim()) { setError('"Product Name" is required. Please fill this field.'); setAddingToCart(false); return null }
      if (!form.unit.trim()) { setError('"Unit" is required. Please select a unit for this product.'); setAddingToCart(false); return null }

      const normalized = (v) => (v || '').trim().toLowerCase()
      const duplicateProduct = products.find((p) => (
        normalized(p.product_name) === normalized(form.product_name) &&
        normalized(p.brand) === normalized(form.brand) &&
        normalized(p.size) === normalized(form.size) &&
        normalized(p.finish) === normalized(form.finish) &&
        normalized(p.grade) === normalized(form.grade) &&
        normalized(p.unit) === normalized(form.unit)
      ))

      if (duplicateProduct) {
        setError('This product already exists. Select from "Existing Product".')
        setAddingToCart(false)
        return null
      }

      const newProduct = await createProduct({
        product_name: form.product_name.trim(),
        brand: form.brand || null,
        size: form.size || null,
        finish: form.finish || null,
        grade: form.grade || null,
        unit: form.unit || 'box',
        category_id: form.category_id || null,
        package_spec: form.package_spec || '1',
      })

      if (!newProduct) {
        setError('Failed to create product.')
        setAddingToCart(false)
        return null
      }

      productId = newProduct.id
      productName = form.product_name.trim()
      productUnit = form.unit
      const updatedProducts = await getAllTiles()
      setProducts(updatedProducts)
    } else {
      if (!productId) { setError('"Product" is required. Please search and select a product.'); setAddingToCart(false); return null }
    }

    if (!form.quantity || Number(form.quantity) <= 0) { setError('"Quantity" is required. Please enter a quantity greater than 0.'); setAddingToCart(false); return null }

    // SELL validations
    if (form.transaction_type === 'sell') {
      const allocEntries = Object.entries(batchAllocations).filter(([, v]) => Number(v) > 0)
      if (allocEntries.length === 0) { setError('"Batch Allocation" is required. Please allocate quantity from at least one batch below.'); setAddingToCart(false); return null }

      const piecesPerBox = getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)
      for (const [key, qty] of allocEntries) {
        const row = mappedInventoryRows.find(r => `${r.godown_id}|${r.batch_code}` === key)
        if (!row) { setError('A selected batch was not found.'); setAddingToCart(false); return null }
        let qtyInBoxes = Number(qty)
        if (sellUnit === 'piece') {
          if (!piecesPerBox) { setError('Cannot sell by piece - no package spec.'); setAddingToCart(false); return null }
          qtyInBoxes = Number(qty) / piecesPerBox
        }
        if (qtyInBoxes > row.boxes) {
          setError(`Cannot sell ${qty} from ${row.godown_name} · ${row.batch_code}. Only ${row.boxes} boxes available.`)
          setAddingToCart(false)
          return null
        }
      }

      const totalAllocated = allocEntries.reduce((s, [, v]) => s + Number(v), 0)
      if (totalAllocated !== Number(form.quantity)) {
        setError(`Total allocated (${totalAllocated}) doesn't match quantity (${form.quantity}).`)
        setAddingToCart(false)
        return null
      }
    }

    // BUY validations
    if (form.transaction_type === 'buy') {
      if (!form.godown_id && !form.batch_code) { setError('"Godown" and "Batch Code" are required. Please fill both fields.'); setAddingToCart(false); return null }
      if (!form.godown_id) { setError('"Godown" is required. Please select a godown.'); setAddingToCart(false); return null }
      if (!form.batch_code) { setError('"Batch Code" is required. Please enter a batch code.'); setAddingToCart(false); return null }
    }

    // Build cart item
    const cartItem = {
      id: Date.now() + Math.random(),
      product_id: productId,
      product_name: productName,
      product_unit: productUnit,
      product_size: selectedProduct?.size || form.size || '',
      quantity: Number(form.quantity),
      sell_unit: sellUnit,
      unit_price: form.unit_price ? Number(form.unit_price) : null,
      total_price: form.total_price ? Number(form.total_price) : null,
      godown_id: form.godown_id,
      batch_code: form.batch_code,
      location_in_godown: form.location_in_godown,
      batchAllocations: form.transaction_type === 'sell' ? { ...batchAllocations } : null,
      mappedRows: form.transaction_type === 'sell' ? [...mappedInventoryRows] : null,
      package_spec: selectedProduct?.package_spec || (normalizedPackageCount != null ? String(normalizedPackageCount) : null),
    }

    setCartItems(prev => [...prev, cartItem])
    resetProductFields()
    setAddingToCart(false)
    return cartItem
  }

  const removeCartItem = (itemId) => {
    setCartItems(prev => prev.filter(i => i.id !== itemId))
  }

  // Submit ALL items (auto-adds current product if cart empty)
  const handleSubmitAll = async () => {
    setError('')

    let itemsToSubmit = [...cartItems]

    // If cart is empty but product fields filled, auto-add
    if (itemsToSubmit.length === 0) {
      const hasProduct = form.product_id || (productMode === 'new' && form.product_name.trim())
      if (!hasProduct) { setError('No product selected. Please select or add a product before submitting.'); return }
      const addedItem = await handleAddToCart()
      if (!addedItem) return
      itemsToSubmit = [addedItem]
    }

    setSaving(true)

    for (const item of itemsToSubmit) {
      let quantityInBoxes = item.quantity
      let notesForItem = form.notes.trim()

      if (form.transaction_type === 'sell' && item.sell_unit === 'piece') {
        const piecesPerBox = getPackageCount(item.package_spec)
        if (piecesPerBox) quantityInBoxes = item.quantity / piecesPerBox
        const pieceNote = `Sold ${item.quantity} pieces (${quantityInBoxes.toFixed(2)} boxes)`
        notesForItem = notesForItem ? `${pieceNote}. ${notesForItem}` : pieceNote
      }

      const allocEntries = item.batchAllocations
        ? Object.entries(item.batchAllocations).filter(([, v]) => Number(v) > 0)
        : []

      let primaryGodownId = item.godown_id
      let primaryBatchCode = item.batch_code
      let primaryLocation = item.location_in_godown

      if (form.transaction_type === 'sell' && allocEntries.length > 0) {
        const [firstKey] = allocEntries[0]
        const [gId, bCode] = firstKey.split('|')
        const firstRow = (item.mappedRows || []).find(r => r.godown_id === gId && r.batch_code === bCode)
        primaryGodownId = gId
        primaryBatchCode = bCode
        primaryLocation = firstRow?.location_in_godown || ''

        if (allocEntries.length > 1) {
          const batchDetails = allocEntries.map(([key, qty]) => {
            const row = (item.mappedRows || []).find(r => `${r.godown_id}|${r.batch_code}` === key)
            return `${row?.godown_name || '?'} · ${row?.batch_code || '?'}: ${qty} ${item.sell_unit === 'piece' ? 'pcs' : (item.product_unit || 'boxes')}`
          }).join(', ')
          const mixNote = `Multi-batch: ${batchDetails}`
          notesForItem = notesForItem ? `${mixNote}. ${notesForItem}` : mixNote
        }
      }

      const txnData = {
        product_id: item.product_id,
        transaction_type: form.transaction_type,
        quantity: quantityInBoxes,
        unit_price: item.unit_price,
        total_price: item.total_price,
        party_name: form.party_name.trim() || null,
        invoice_number: form.invoice_number.trim() || null,
        godown_id: primaryGodownId || null,
        batch_code: primaryBatchCode?.trim() || null,
        location_in_godown: primaryLocation?.trim() || null,
        notes: notesForItem || null,
      }

      const success = await createTransaction(txnData)
      if (!success) {
        setSaving(false)
        setError(`Failed to create transaction for ${item.product_name}.`)
        return
      }

      // Update inventory
      if (form.transaction_type === 'sell') {
        const piecesPerBox = getPackageCount(item.package_spec)
        for (const [key, qty] of allocEntries) {
          const [gId, bCode] = key.split('|')
          const row = (item.mappedRows || []).find(r => r.godown_id === gId && r.batch_code === bCode)
          let boxesToSubtract = Number(qty)
          if (item.sell_unit === 'piece' && piecesPerBox) {
            boxesToSubtract = Number(qty) / piecesPerBox
          }
          await addInventoryEntry({
            tile_id: item.product_id,
            godown_id: gId,
            batch_code: bCode,
            location_in_godown: row?.location_in_godown || null,
            boxes: -boxesToSubtract,
            price: item.unit_price || 0,
          })
        }
      } else {
        await addInventoryEntry({
          tile_id: item.product_id,
          godown_id: item.godown_id,
          batch_code: item.batch_code.trim(),
          location_in_godown: item.location_in_godown?.trim() || null,
          boxes: item.quantity,
          price: item.unit_price || 0,
        })
      }
    }

    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-apple-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">admin</p>
            <h2 className="text-lg font-bold text-slate-900">
              {form.transaction_type === 'buy' ? 'New Purchase' : 'New Sale'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmitAll() }} className="px-6 py-5 space-y-4">

          {/* Transaction type toggle */}
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
            {['buy', 'sell'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setForm(f => ({ ...f, transaction_type: t, product_id: '' })); setProductSearch(''); setProductMode('existing'); setBatchAllocations({}); setInventorySnapshot(null); setSellUnit('box') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${form.transaction_type === t ? 'bg-white text-slate-900 shadow-apple-xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'buy' ? '↓ Purchase' : '↑ Sale'}
              </button>
            ))}
          </div>

          {/* Product Mode toggle (only for buy) */}
          {form.transaction_type === 'buy' && (
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
              {['existing', 'new'].map((m) => (
                <button key={m} type="button" onClick={() => { setProductMode(m); if (m === 'new') { setForm(f => ({ ...f, product_id: '' })); setProductSearch(''); setInventorySnapshot(null) } }}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${productMode === m ? 'bg-white text-slate-900 shadow-apple-xs' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {m === 'existing' ? 'Existing Product' : 'New Product'}
                </button>
              ))}
            </div>
          )}

          {/* EXISTING PRODUCT: Searchable selector */}
          {productMode === 'existing' && (
            <div className="relative" ref={dropdownRef}>
              <label className="label">Product <span className="text-red-500">*</span></label>
              <input
                ref={productSearchRef}
                type="text"
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setProductDropdownOpen(true); if (!e.target.value) setForm(f => ({ ...f, product_id: '' })) }}
                onFocus={() => setProductDropdownOpen(true)}
                placeholder="Search by name, brand, size…"
                className="input-modern"
                autoComplete="off"
              />
              {productDropdownOpen && filteredProducts.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-apple-sm max-h-[220px] overflow-y-auto">
                  {filteredProducts.slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${form.product_id === p.id ? 'bg-indigo-50' : ''}`}
                    >
                      <p className="text-sm font-medium text-slate-800 truncate">{p.product_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.brand && <span className="text-[10px] text-slate-400">{p.brand}</span>}
                        {p.size && <span className="text-[10px] text-slate-400">· {p.size}</span>}
                        {getPackageCount(p.package_spec, p.pieces_per_box) != null && (
                          <span className="text-[10px] text-slate-400">{getPackageCount(p.package_spec, p.pieces_per_box)} pcs/box</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NEW PRODUCT fields (buy only) */}
          {productMode === 'new' && form.transaction_type === 'buy' && (
            <div className="space-y-3 p-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">New Product Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.product_name} onChange={(e) => setForm(f => ({ ...f, product_name: e.target.value }))} className="input-modern" placeholder="e.g. Marble White" />
                </div>
                <div>
                  <label className="label">Brand</label>
                  <ComboInput
                    value={form.brand}
                    onChange={(v) => setForm(f => ({ ...f, brand: v }))}
                    options={filterOptions.brands || []}
                    placeholder="Type or select brand"
                    onAdd={async (v) => { await addFilterOption('brand', v); setFilterOptions(prev => ({ ...prev, brands: [...new Set([...prev.brands, v])].sort() })) }}
                  />
                </div>
                <div>
                  <label className="label">Size</label>
                  <ComboInput
                    value={form.size}
                    onChange={(v) => setForm(f => ({ ...f, size: v }))}
                    options={filterOptions.sizes || []}
                    placeholder="Type or select size"
                    onAdd={async (v) => { await addFilterOption('size', v); setFilterOptions(prev => ({ ...prev, sizes: [...new Set([...prev.sizes, v])].sort() })) }}
                  />
                </div>
                <div>
                  <label className="label">Finish</label>
                  <ComboInput
                    value={form.finish}
                    onChange={(v) => setForm(f => ({ ...f, finish: v }))}
                    options={filterOptions.finishes || []}
                    placeholder="Type or select finish"
                    onAdd={async (v) => { await addFilterOption('finish', v); setFilterOptions(prev => ({ ...prev, finishes: [...new Set([...prev.finishes, v])].sort() })) }}
                  />
                </div>
                <div>
                  <label className="label">Grade</label>
                  <ComboInput
                    value={form.grade}
                    onChange={(v) => setForm(f => ({ ...f, grade: v }))}
                    options={filterOptions.grades || []}
                    placeholder="Type or select grade"
                    onAdd={async (v) => { await addFilterOption('grade', v); setFilterOptions(prev => ({ ...prev, grades: [...new Set([...prev.grades, v])].sort() })) }}
                  />
                </div>
                <div>
                  <label className="label">Unit <span className="text-red-500">*</span></label>
                  <select value={form.unit} onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))} className="input-modern">
                    <option value="box">Box</option>
                    <option value="piece">Piece</option>
                    <option value="sqft">Sq Ft</option>
                    <option value="sqm">Sq M</option>
                  </select>
                </div>
                <div>
                  <label className="label">Pcs/Box</label>
                  <input type="number" min="1" value={form.package_spec} onChange={(e) => setForm(f => ({ ...f, package_spec: e.target.value }))} className="input-modern" placeholder="e.g. 5" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <ComboInput
                    value={categories.find(c => c.id === form.category_id)?.name || ''}
                    onChange={(v) => {
                      const match = categories.find(c => c.name.toLowerCase() === v.toLowerCase())
                      setForm(f => ({ ...f, category_id: match ? match.id : '' }))
                    }}
                    options={categories.map(c => c.name)}
                    placeholder="Type or select category"
                    onAdd={async (v) => {
                      const created = await createCategory(v)
                      if (created) {
                        const updated = await getAllCategories()
                        setCategories(updated)
                        setForm(f => ({ ...f, category_id: created.id }))
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sell unit toggle (piece/box) for sell mode */}
          {form.transaction_type === 'sell' && selectedProduct && getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box) && (
            <div>
              <label className="label">Sell By</label>
              <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                <button type="button" onClick={() => setSellUnit('box')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${sellUnit === 'box' ? 'bg-white text-slate-900 shadow-apple-xs' : 'text-slate-500'}`}>
                  Box ({selectedProduct?.unit || 'box'})
                </button>
                <button type="button" onClick={() => setSellUnit('piece')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${sellUnit === 'piece' ? 'bg-white text-slate-900 shadow-apple-xs' : 'text-slate-500'}`}>
                  Piece ({getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)}/box)
                </button>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="label">Quantity <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="1"
              step={sellUnit === 'piece' ? '1' : '0.01'}
              value={form.quantity}
              onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder={sellUnit === 'piece' ? 'Number of pieces' : `in ${selectedProduct?.unit || form.unit || 'box'}s`}
              className="input-modern"
            />
          </div>

          {/* SELL: Multi-batch allocation */}
          {form.transaction_type === 'sell' && form.product_id && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available Stock</p>
                {inventoryLoading && <span className="text-[11px] text-slate-400">Loading…</span>}
              </div>

              {!inventoryLoading && mappedInventoryRows.length > 0 && (
                <>
                  {getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box) != null && (
                    <div className="bg-white rounded-xl px-3 py-2 border border-slate-100">
                      <p className="text-[11px] text-slate-400">Package Spec</p>
                      <p className="text-sm font-semibold text-slate-700">{getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)} pcs/box</p>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400">Allocate from batches:</p>
                  <div className="space-y-2">
                    {mappedInventoryRows.map((row) => {
                      const key = `${row.godown_id}|${row.batch_code}`
                      const allocated = batchAllocations[key] || ''
                      return (
                        <div key={key} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{row.godown_name} · {row.batch_code}</p>
                            <p className="text-[11px] text-slate-400">
                              {row.location_in_godown ? `${row.location_in_godown} · ` : ''}{formatQty(row.boxes, getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box), selectedProduct?.unit || 'box')} available
                            </p>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={sellUnit === 'piece' ? row.boxes * (getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box) || 1) : row.boxes}
                            step="1"
                            value={allocated}
                            onChange={(e) => {
                              setBatchAllocations(prev => ({ ...prev, [key]: e.target.value }))
                            }}
                            placeholder="0"
                            className="input-modern w-20 text-center text-sm py-1.5"
                          />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Total allocated: {Object.values(batchAllocations).reduce((s, v) => s + (Number(v) || 0), 0)} {sellUnit === 'piece' ? 'pcs' : (selectedProduct?.unit || 'boxes')}
                  </p>
                </>
              )}

              {!inventoryLoading && mappedInventoryRows.length === 0 && (
                <p className="text-sm text-amber-600">No stock found for this product.</p>
              )}
            </div>
          )}

          {/* BUY: Godown + Batch */}
          {form.transaction_type === 'buy' && (productMode === 'existing' ? form.product_id : form.product_name) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Godown <span className="text-red-500">*</span></label>
                <select value={form.godown_id} onChange={(e) => setForm(f => ({ ...f, godown_id: e.target.value }))} className="input-modern" required>
                  <option value="">Select godown</option>
                  {godowns.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Batch Code <span className="text-red-500">*</span></label>
                <input type="text" value={form.batch_code} onChange={(e) => setForm(f => ({ ...f, batch_code: e.target.value }))} className="input-modern" placeholder="e.g. BATCH-001" required />
              </div>
              <div className="col-span-2">
                <label className="label">Location in Godown</label>
                <select
                  className="input-modern"
                  value={form.location_in_godown}
                  onChange={(e) => setForm(f => ({ ...f, location_in_godown: e.target.value }))}
                >
                  <option value="">Select location</option>
                  {(godowns.find(g => g.id === form.godown_id)?.locations || []).filter(Boolean).map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unit Price</label>
              <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="₹ per unit" className="input-modern" />
            </div>
            <div>
              <label className="label">Total Price</label>
              <input type="number" min="0" step="0.01" value={form.total_price} onChange={(e) => setForm(f => ({ ...f, total_price: e.target.value }))} placeholder="₹ total" className="input-modern" />
            </div>
          </div>

          {/* Add to list button */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addingToCart || inventoryLoading}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-300 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-all disabled:opacity-50"
          >
            {addingToCart ? 'Adding…' : '+ Add to list'}
          </button>

          {/* Cart items */}
          {cartItems.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100/80 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items ({cartItems.length})</p>
                <p className="text-xs font-bold text-slate-700">Total: ₹{cartItems.reduce((s, i) => s + (i.total_price || 0), 0).toLocaleString()}</p>
              </div>
              <ul className="divide-y divide-slate-200 max-h-[200px] overflow-y-auto">
                {cartItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.product_name}
                        {item.product_size && <span className="text-slate-400 ml-1">· {item.product_size}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {item.quantity} {item.sell_unit === 'piece' ? 'pcs' : (item.product_unit || 'boxes')}
                        {item.unit_price ? ` @ ₹${item.unit_price}` : ''}
                        {item.total_price ? ` = ₹${item.total_price.toLocaleString()}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeCartItem(item.id)} className="ml-2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg width="9" height="9" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Shared fields: Party + Invoice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{form.transaction_type === 'buy' ? 'Supplier' : 'Customer'}</label>
              <input type="text" value={form.party_name} onChange={(e) => setForm(f => ({ ...f, party_name: e.target.value }))} placeholder="Party name" className="input-modern" />
            </div>
            <div>
              <label className="label">Invoice Number</label>
              <input type="text" value={form.invoice_number} onChange={(e) => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="e.g. INV-2024-001" className="input-modern" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional details..." className="input-modern resize-none" rows={2} />
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              type="submit"
              disabled={saving || addingToCart}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Saving...' : cartItems.length > 0 ? `Submit ${cartItems.length} item${cartItems.length !== 1 ? 's' : ''}` : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TradesPage
