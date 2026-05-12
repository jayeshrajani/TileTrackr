import { useEffect, useMemo, useState } from 'react'
import { getAllTiles, createTransaction, getAllTransactions, addInventoryEntry, getTileInventory, getAllGodowns, getAllCategories, createProduct, getProductFieldOptions } from '../services/inventoryService'
import { jsPDF } from 'jspdf'

function getMappedInventoryRows(snapshot) {
  return (snapshot?.batches || [])
    .flatMap((batch) => (batch.godowns || []).map((row) => ({
      ...row,
      batch_code: batch.batch_code,
    })))
    .filter((row) => Number(row.boxes) > 0)
    .sort((left, right) => {
      if (right.boxes !== left.boxes) return right.boxes - left.boxes
      return (left.batch_code || '').localeCompare(right.batch_code || '')
    })
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

function TradesPage({ onTransactionCreated }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalType, setModalType] = useState('buy')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const loadTransactions = async () => {
    setLoading(true)
    const data = await getAllTransactions()
    setTransactions(data)
    setLoading(false)
  }

  useEffect(() => {
    loadTransactions()
  }, [])

  const handleTransactionCreated = () => {
    setShowAddModal(false)
    loadTransactions()
    // Refresh parent data (home page tiles with updated stock)
    if (onTransactionCreated) {
      onTransactionCreated()
    }
  }

  const openModal = (type) => {
    setModalType(type)
    setShowAddModal(true)
  }

  const generateDailyReport = (date) => {
    const reportDate = new Date(date)
    const dateStr = reportDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    
    // Filter transactions for selected date
    const dailyTransactions = transactions.filter(txn => {
      const txnDate = new Date(txn.created_at)
      return txnDate.toDateString() === reportDate.toDateString()
    })

    if (dailyTransactions.length === 0) {
      alert(`No transactions found for ${dateStr}`)
      return
    }

    // Create PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPos = 20

    // Header
    doc.setFontSize(20)
    doc.setFont(undefined, 'bold')
    doc.text('TileTrackr - Daily Trade Report', pageWidth / 2, yPos, { align: 'center' })
    
    yPos += 10
    doc.setFontSize(12)
    doc.setFont(undefined, 'normal')
    doc.text(dateStr, pageWidth / 2, yPos, { align: 'center' })
    
    yPos += 15
    doc.setDrawColor(200, 200, 200)
    doc.line(15, yPos, pageWidth - 15, yPos)
    yPos += 10

    // Summary Statistics
    const buyTransactions = dailyTransactions.filter(t => t.transaction_type === 'buy')
    const sellTransactions = dailyTransactions.filter(t => t.transaction_type === 'sell')
    const totalBuyValue = buyTransactions.reduce((sum, t) => sum + (t.total_price || 0), 0)
    const totalSellValue = sellTransactions.reduce((sum, t) => sum + (t.total_price || 0), 0)

    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('Summary:', 15, yPos)
    yPos += 7
    
    doc.setFont(undefined, 'normal')
    doc.text(`Total Transactions: ${dailyTransactions.length}`, 15, yPos)
    yPos += 6
    doc.text(`Purchases: ${buyTransactions.length} (Rs. ${totalBuyValue.toLocaleString()})`, 15, yPos)
    yPos += 6
    doc.text(`Sales: ${sellTransactions.length} (Rs. ${totalSellValue.toLocaleString()})`, 15, yPos)
    yPos += 6
    doc.setTextColor(totalSellValue - totalBuyValue >= 0 ? 0 : 255, totalSellValue - totalBuyValue >= 0 ? 150 : 0, 0)
    doc.text(`Net: Rs. ${(totalSellValue - totalBuyValue).toLocaleString()}`, 15, yPos)
    doc.setTextColor(0, 0, 0)
    
    yPos += 12
    doc.line(15, yPos, pageWidth - 15, yPos)
    yPos += 10

    // Transaction Details
    doc.setFont(undefined, 'bold')
    doc.text('Transaction Details:', 15, yPos)
    yPos += 8

    dailyTransactions.forEach((txn, index) => {
      // Check if we need a new page
      if (yPos > pageHeight - 30) {
        doc.addPage()
        yPos = 20
      }

      // Transaction header
      doc.setFontSize(10)
      doc.setFont(undefined, 'bold')
      const typeColor = txn.transaction_type === 'buy' ? [16, 185, 129] : [239, 68, 68]
      doc.setTextColor(...typeColor)
      doc.text(`${index + 1}. ${txn.transaction_type === 'buy' ? 'PURCHASE' : 'SALE'}`, 15, yPos)
      doc.setTextColor(0, 0, 0)
      
      // Amount
      if (txn.total_price) {
        doc.setFont(undefined, 'bold')
        doc.text(`Rs. ${txn.total_price.toLocaleString()}`, pageWidth - 15, yPos, { align: 'right' })
      }
      yPos += 6

      // Product details
      doc.setFont(undefined, 'normal')
      doc.setFontSize(9)
      doc.text(`Product: ${txn.product_name || 'N/A'}`, 20, yPos)
      yPos += 5
      if (txn.package_spec) {
        doc.text(`Package: ${txn.package_spec}`, 20, yPos)
        yPos += 5
      }
      doc.text(`Quantity: ${txn.quantity} ${txn.unit || 'box'}(s)`, 20, yPos)
      if (txn.unit_price) {
        doc.text(`@ Rs. ${txn.unit_price}/${txn.unit || 'box'}`, 80, yPos)
      }
      yPos += 5
      
      // Location details
      const locationParts = []
      if (txn.godown_name) locationParts.push(txn.godown_name)
      if (txn.batch_code) locationParts.push(`Batch: ${txn.batch_code}`)
      if (txn.location_in_godown) locationParts.push(txn.location_in_godown)
      if (locationParts.length > 0) {
        doc.text(`Location: ${locationParts.join(' | ')}`, 20, yPos)
        yPos += 5
      }
      
      // Party details
      if (txn.party_name) {
        doc.text(`${txn.transaction_type === 'buy' ? 'Supplier' : 'Customer'}: ${txn.party_name}`, 20, yPos)
        yPos += 5
      }
      
      if (txn.invoice_number) {
        doc.text(`Invoice: ${txn.invoice_number}`, 20, yPos)
        yPos += 5
      }
      
      if (txn.notes) {
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        const notesLines = doc.splitTextToSize(`Notes: ${txn.notes}`, pageWidth - 40)
        doc.text(notesLines, 20, yPos)
        yPos += notesLines.length * 4
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(9)
      }
      
      yPos += 3
      doc.setDrawColor(230, 230, 230)
      doc.line(15, yPos, pageWidth - 15, yPos)
      yPos += 7
    })

    // Footer on last page
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' })

    // Save PDF
    const fileName = `TileTrackr_Daily_Report_${date}.pdf`
    doc.save(fileName)
    setShowDatePicker(false)
  }

  const handleDownloadReport = () => {
    generateDailyReport(selectedDate)
  }

  return (
    <div className="space-y-6">
      {showAddModal && (
        <AddTransactionModal
          initialType={modalType}
          onClose={() => setShowAddModal(false)}
          onCreated={handleTransactionCreated}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-1">Record buy/sell transactions and manage stock automatically.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 mt-1">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-semibold shadow-apple-xs hover:bg-indigo-600 transition-all duration-200 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Report
          </button>
          <button
            type="button"
            onClick={() => openModal('buy')}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold shadow-apple-xs hover:bg-emerald-600 transition-all duration-200 flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Buy
          </button>
          <button
            type="button"
            onClick={() => openModal('sell')}
            className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold shadow-apple-xs hover:bg-red-600 transition-all duration-200 flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Sell
          </button>
        </div>
      </div>

      {/* Date Picker Modal for Report */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDatePicker(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-apple-modal p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Download Daily Report</h3>
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="label">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="input-modern"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="btn-primary flex-1"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <p className="text-xs text-slate-400 mt-1">Click "New Transaction" to record your first buy or sell</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((txn) => (
            <div key={txn.id} className="card p-5 hover:shadow-apple-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      txn.transaction_type === 'buy' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {txn.transaction_type === 'buy' ? '↓ Buy' : '↑ Sell'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{txn.product_name}</p>
                  {txn.package_spec && (
                    <p className="text-xs text-slate-500 mt-1">Package: {txn.package_spec}</p>
                  )}
                  {txn.party_name && (
                    <p className="text-xs text-slate-500 mt-1">
                      {txn.transaction_type === 'buy' ? 'From' : 'To'}: {txn.party_name}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                    <span><span className="font-semibold text-slate-700">{txn.quantity}</span> {txn.unit}s</span>
                    {txn.godown_name && <span>• {txn.godown_name}</span>}
                    {txn.location_in_godown && <span>• {txn.location_in_godown}</span>}
                    {txn.batch_code && <span>• Batch: {txn.batch_code}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {txn.total_price ? (
                    <>
                      <p className="text-lg font-bold text-slate-900">₹{txn.total_price.toLocaleString()}</p>
                      {txn.unit_price && (
                        <p className="text-xs text-slate-400 mt-0.5">@ ₹{txn.unit_price}/{txn.unit}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No price</p>
                  )}
                </div>
              </div>
              {txn.notes && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">{txn.notes}</p>
                </div>
              )}
              {txn.invoice_number && (
                <div className="mt-2">
                  <span className="inline-flex items-center text-xs text-slate-400">
                    Invoice: <span className="font-mono ml-1 text-slate-600">{txn.invoice_number}</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddTransactionModal({ initialType, onClose, onCreated }) {
  const [products, setProducts] = useState([])
  const [godowns, setGodowns] = useState([])
  const [categories, setCategories] = useState([])
  const [fieldOptions, setFieldOptions] = useState({ brands: [], sizes: [], finishes: [], grades: [], units: [], packageSpecs: [] })
  const [inventorySnapshot, setInventorySnapshot] = useState(null)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [productMode, setProductMode] = useState('existing') // 'existing' or 'new'
  const [form, setForm] = useState({
    product_id: '',
    transaction_type: initialType || 'buy',
    quantity: '',
    sell_unit: 'box', // 'box' or 'piece'
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
    getProductFieldOptions().then(setFieldOptions)
  }, [])

  const selectedProduct = products.find(p => p.id === form.product_id)
  const mappedInventoryRows = useMemo(
    () => getMappedInventoryRows(inventorySnapshot),
    [inventorySnapshot]
  )
  
  // Find the selected batch/location row based on form values
  const selectedInventoryRow = useMemo(() => {
    if (!form.godown_id || !form.batch_code) return null
    return mappedInventoryRows.find(
      row => row.godown_id === form.godown_id && row.batch_code === form.batch_code
    ) || null
  }, [mappedInventoryRows, form.godown_id, form.batch_code])
  
  const currentStock = selectedInventoryRow?.boxes || 0
  const totalStock = inventorySnapshot?.totalBoxes || 0

  useEffect(() => {
    if (!form.product_id) {
      setInventorySnapshot(null)
      setForm((current) => ({
        ...current,
        godown_id: '',
        batch_code: '',
        location_in_godown: '',
        quantity: '',
      }))
      return
    }

    let cancelled = false

    const loadInventory = async () => {
      setInventoryLoading(true)
      const snapshot = await getTileInventory(form.product_id)
      if (cancelled) return

      setInventorySnapshot(snapshot)
      
      // For SELL transactions, pre-select the first batch with stock
      // For BUY transactions, leave empty so user can choose
      if (form.transaction_type === 'sell') {
        const preferredRow = getMappedInventoryRows(snapshot)[0] || null
        setForm((current) => ({
          ...current,
          godown_id: preferredRow?.godown_id || '',
          batch_code: preferredRow?.batch_code || '',
          location_in_godown: preferredRow?.location_in_godown || '',
        }))
      } else {
        // For buy, let user choose batch/godown
        setForm((current) => ({
          ...current,
          godown_id: '',
          batch_code: '',
          location_in_godown: '',
        }))
      }
      
      setInventoryLoading(false)
    }

    loadInventory()

    return () => {
      cancelled = true
    }
  }, [form.product_id, form.transaction_type])

  // Auto-calculate total price
  useEffect(() => {
    if (form.quantity && form.unit_price) {
      const total = Number(form.quantity) * Number(form.unit_price)
      setForm(f => ({ ...f, total_price: total.toFixed(2) }))
    }
  }, [form.quantity, form.unit_price])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    let productId = form.product_id
    const normalizedPackageCount = getPackageCount(form.package_spec)

    // For new product mode (only available for BUY), create the product first
    if (productMode === 'new' && form.transaction_type === 'buy') {
      if (!form.product_name.trim()) { setError('Please enter product name'); return }
      if (!form.unit.trim()) { setError('Please select a unit'); return }

      // Check for duplicates before creating
      const normalized = (value) => (value || '').trim().toLowerCase()
      const normalizedCategoryId = form.category_id || null
      
      const duplicateProduct = products.find((product) => (
        normalized(product.product_name) === normalized(form.product_name) &&
        normalized(product.brand) === normalized(form.brand) &&
        normalized(product.size) === normalized(form.size) &&
        normalized(product.finish) === normalized(form.finish) &&
        normalized(product.grade) === normalized(form.grade) &&
        normalized(product.unit) === normalized(form.unit) &&
        getPackageCount(product.package_spec, product.pieces_per_box) === normalizedPackageCount &&
        (product.category_id || null) === normalizedCategoryId
      ))

      if (duplicateProduct) {
        setError('This product already exists. Please select it from "Existing Product" or modify the details to make it unique.')
        return
      }

      setSaving(true)
      
      const newProduct = await createProduct({
        product_name: form.product_name.trim(),
        brand: form.brand || null,
        size: form.size || null,
        finish: form.finish || null,
        grade: form.grade || null,
        unit: form.unit || 'box',
        package_spec: normalizedPackageCount != null ? String(normalizedPackageCount) : null,
        pieces_per_box: normalizedPackageCount,
        category_id: form.category_id || null,
      })

      if (!newProduct) {
        setSaving(false)
        setError('Failed to create product. Please try again.')
        return
      }

      productId = newProduct.id
      setSaving(false)
    } else {
      // Existing product mode validation
      if (!productId) { setError('Please select a product'); return }
    }

    if (!form.quantity || Number(form.quantity) <= 0) { setError('Please enter a valid quantity'); return }
    
    // For SELL, validate batch/location is selected and has enough stock
    if (form.transaction_type === 'sell') {
      if (!form.godown_id || !form.batch_code) {
        setError('Please select a batch/location to sell from.')
        return
      }
      if (!selectedInventoryRow) {
        setError('Selected batch/location not found.')
        return
      }
      
      // Calculate quantity in boxes for validation
      let quantityInBoxes = Number(form.quantity)
      if (form.sell_unit === 'piece') {
        const piecesPerBox = getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)
        if (!piecesPerBox || piecesPerBox <= 0) {
          setError('Cannot sell by piece - package specification not set for this product.')
          return
        }
        quantityInBoxes = Number(form.quantity) / piecesPerBox
      }
      
      if (quantityInBoxes > currentStock) {
        const displayUnit = form.sell_unit === 'piece' ? 'pieces' : (selectedProduct?.unit || 'boxes')
        const availableDisplay = form.sell_unit === 'piece' 
          ? currentStock * getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)
          : currentStock
        setError(`Cannot sell ${Number(form.quantity)} ${displayUnit}. Only ${availableDisplay} ${displayUnit} available in this batch.`)
        return
      }
    }
    
    // For BUY, ensure batch/godown is specified
    if (form.transaction_type === 'buy') {
      if (!form.godown_id || !form.batch_code) {
        setError('Please specify godown and batch code for the purchase.')
        return
      }
    }

    setSaving(true)

    // Get product details for snapshot
    const productForSnapshot = productMode === 'new' 
      ? { product_name: form.product_name, unit: form.unit, package_spec: normalizedPackageCount != null ? `${normalizedPackageCount} pcs/box` : null }
      : selectedProduct

    // Calculate actual quantity in boxes for inventory
    let quantityInBoxes = Number(form.quantity)
    let notesWithUnit = form.notes.trim()
    
    console.log('Before calculation:', { 
      transaction_type: form.transaction_type, 
      sell_unit: form.sell_unit, 
      quantity: form.quantity,
      quantityInBoxes 
    })
    
    if (form.transaction_type === 'sell' && form.sell_unit === 'piece') {
      const piecesPerBox = getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)
      quantityInBoxes = Number(form.quantity) / piecesPerBox
      console.log('Selling by piece:', { piecesPerBox, quantityInBoxes })
      // Add note about piece sale
      const pieceNote = `Sold ${Number(form.quantity)} pieces (${quantityInBoxes.toFixed(2)} boxes)`
      notesWithUnit = notesWithUnit ? `${pieceNote}. ${notesWithUnit}` : pieceNote
    }

    // Create transaction record
    const txnData = {
      product_id: productId,
      transaction_type: form.transaction_type,
      quantity: quantityInBoxes, // Always store in boxes (will be decimal for piece sales)
      product_package_spec_snapshot: productForSnapshot?.package_spec || null,
      unit_price: form.unit_price ? Number(form.unit_price) : null,
      total_price: form.total_price ? Number(form.total_price) : null,
      party_name: form.party_name.trim() || null,
      invoice_number: form.invoice_number.trim() || null,
      godown_id: form.godown_id || null,
      batch_code: form.batch_code.trim() || null,
      location_in_godown: form.location_in_godown.trim() || null,
      notes: notesWithUnit || null,
    }

    const success = await createTransaction(txnData)

    if (!success) {
      setSaving(false)
      setError('Failed to create transaction. Please try again.')
      return
    }

    // Update inventory automatically (always in boxes)
    const inventoryChange = form.transaction_type === 'buy' 
      ? Number(form.quantity) 
      : -quantityInBoxes

    console.log('Inventory update:', { 
      transaction_type: form.transaction_type,
      inventoryChange,
      quantityInBoxes,
      godown_id: form.godown_id,
      batch_code: form.batch_code.trim()
    })

    await addInventoryEntry({
      tile_id: productId,
      godown_id: form.godown_id,
      batch_code: form.batch_code.trim(),
      location_in_godown: form.location_in_godown.trim() || null,
      boxes: inventoryChange,
      price: form.unit_price ? Number(form.unit_price) : 0,
    })

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
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Product Mode Toggle (only for BUY) */}
          {form.transaction_type === 'buy' && (
            <div>
              <label className="label">Product Type</label>
              <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                {['existing', 'new'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setProductMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                      productMode === mode
                        ? 'bg-white text-slate-900 shadow-apple-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode === 'existing' ? 'Existing Product' : 'New Product'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Existing Product Selection */}
          {(productMode === 'existing' || form.transaction_type === 'sell') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product <span className="text-red-500">*</span></label>
                  <select
                    value={form.product_id}
                    onChange={(e) => setForm(f => ({ ...f, product_id: e.target.value }))}
                    className="input-modern"
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} {p.size ? `· ${p.size}` : ''} {getPackageCount(p.package_spec, p.pieces_per_box) != null ? `· ${getPackageCount(p.package_spec, p.pieces_per_box)} pcs/box` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Quantity <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step={form.sell_unit === 'piece' ? '1' : '1'}
                    value={form.quantity}
                    onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder={form.transaction_type === 'sell' && form.sell_unit === 'piece' ? 'e.g. 24' : (selectedProduct?.unit ? `in ${selectedProduct.unit}s` : 'e.g. 100')}
                    className="input-modern"
                    required
                  />
                </div>
              </div>
              {form.transaction_type === 'sell' && getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box) && (
                <div>
                  <label className="label">Sell by</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, sell_unit: 'box', quantity: '' }))}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                        form.sell_unit === 'box'
                          ? 'bg-indigo-500 text-white shadow-apple-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Box
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, sell_unit: 'piece', quantity: '' }))}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                        form.sell_unit === 'piece'
                          ? 'bg-indigo-500 text-white shadow-apple-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Piece ({getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)}/box)
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* New Product Fields (only for BUY + new mode) */}
          {productMode === 'new' && form.transaction_type === 'buy' && (
            <>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3">
                <p className="text-xs font-semibold text-indigo-700 mb-1">Adding New Product</p>
                <p className="text-xs text-indigo-600">Fill in product details below. It will be added to your inventory.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.product_name}
                    onChange={(e) => setForm(f => ({ ...f, product_name: e.target.value }))}
                    placeholder="e.g. Ceramic Tile"
                    className="input-modern"
                    required
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="input-modern"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Brand</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Kajaria"
                    className="input-modern"
                    list="brands-list"
                  />
                  <datalist id="brands-list">
                    {fieldOptions.brands.map((b, idx) => <option key={idx} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Size</label>
                  <input
                    type="text"
                    value={form.size}
                    onChange={(e) => setForm(f => ({ ...f, size: e.target.value }))}
                    placeholder="e.g. 600x600"
                    className="input-modern"
                    list="sizes-list"
                  />
                  <datalist id="sizes-list">
                    {fieldOptions.sizes.map((s, idx) => <option key={idx} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Unit <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="e.g. box"
                    className="input-modern"
                    list="units-list"
                    required
                  />
                  <datalist id="units-list">
                    {fieldOptions.units.map((u, idx) => <option key={idx} value={u} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="label">Package Spec (pieces/box)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.package_spec}
                    onChange={(e) => setForm(f => ({ ...f, package_spec: e.target.value }))}
                    placeholder="e.g. 4"
                    className="input-modern"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Finish</label>
                  <input
                    type="text"
                    value={form.finish}
                    onChange={(e) => setForm(f => ({ ...f, finish: e.target.value }))}
                    placeholder="e.g. Glossy"
                    className="input-modern"
                    list="finishes-list"
                  />
                  <datalist id="finishes-list">
                    {fieldOptions.finishes.map((f, idx) => <option key={idx} value={f} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Grade</label>
                  <input
                    type="text"
                    value={form.grade}
                    onChange={(e) => setForm(f => ({ ...f, grade: e.target.value }))}
                    placeholder="e.g. Premium"
                    className="input-modern"
                    list="grades-list"
                  />
                  <datalist id="grades-list">
                    {fieldOptions.grades.map((g, idx) => <option key={idx} value={g} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="label">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder={form.unit ? `in ${form.unit}s` : 'e.g. 100'}
                  className="input-modern"
                  required
                />
              </div>
            </>
          )}

          {form.product_id && productMode === 'existing' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock Information</p>
                {inventoryLoading && <span className="text-[11px] text-slate-400">Loading…</span>}
              </div>

              {!inventoryLoading && mappedInventoryRows.length > 0 ? (
                <>
                  {/* Total Stock Display */}
                  <div className="flex items-baseline gap-4">
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">Total Stock</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {totalStock}
                        <span className="ml-1 text-sm font-medium text-slate-400">{selectedProduct?.unit || 'boxes'}</span>
                      </p>
                    </div>
                    {getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box) != null && (
                      <div>
                        <p className="text-[11px] text-slate-400 mb-1">Package</p>
                        <p className="text-sm font-semibold text-slate-700">{getPackageCount(selectedProduct?.package_spec, selectedProduct?.pieces_per_box)} pcs/box</p>
                      </div>
                    )}
                    {mappedInventoryRows.length > 1 && (
                      <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                        Across {mappedInventoryRows.length} locations
                      </div>
                    )}
                  </div>

                  {/* Batch/Location Selector for SELL */}
                  {form.transaction_type === 'sell' && (
                    <div>
                      <label className="label">Select Batch/Location to Sell From <span className="text-red-500">*</span></label>
                      <select
                        value={form.godown_id && form.batch_code ? `${form.godown_id}|${form.batch_code}` : ''}
                        onChange={(e) => {
                          if (!e.target.value) {
                            setForm(f => ({ ...f, godown_id: '', batch_code: '', location_in_godown: '' }))
                            return
                          }
                          const [godownId, batchCode] = e.target.value.split('|')
                          const row = mappedInventoryRows.find(r => r.godown_id === godownId && r.batch_code === batchCode)
                          setForm(f => ({
                            ...f,
                            godown_id: godownId,
                            batch_code: batchCode,
                            location_in_godown: row?.location_in_godown || '',
                          }))
                        }}
                        className="input-modern"
                        required
                      >
                        <option value="">Choose batch/location</option>
                        {mappedInventoryRows.map((row, idx) => (
                          <option key={idx} value={`${row.godown_id}|${row.batch_code}`}>
                            {row.godown_name} · Batch {row.batch_code} {row.location_in_godown ? `· ${row.location_in_godown}` : ''} — {row.boxes} {selectedProduct?.unit || 'boxes'} available
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Batch/Location Input for BUY */}
                  {form.transaction_type === 'buy' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Godown <span className="text-red-500">*</span></label>
                          <select
                            value={form.godown_id}
                            onChange={(e) => {
                              setForm(f => ({ ...f, godown_id: e.target.value, location_in_godown: '' }))
                            }}
                            className="input-modern"
                            required
                          >
                            <option value="">Select godown</option>
                            {godowns.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Batch Code <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={form.batch_code}
                            onChange={(e) => setForm(f => ({ ...f, batch_code: e.target.value }))}
                            placeholder="e.g. B001"
                            className="input-modern"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Location in Godown <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span></label>
                        <select
                          value={form.location_in_godown}
                          onChange={(e) => setForm(f => ({ ...f, location_in_godown: e.target.value }))}
                          className="input-modern"
                        >
                          <option value="">{form.godown_id ? 'Select location' : 'Select a godown first'}</option>
                          {form.godown_id && godowns.find(g => g.id === form.godown_id)?.locations?.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                        {form.godown_id && (!godowns.find(g => g.id === form.godown_id)?.locations || godowns.find(g => g.id === form.godown_id)?.locations?.length === 0) && (
                          <p className="mt-2 text-xs text-amber-600">No saved locations in this godown yet. Add them from the Godowns tab first.</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Selected Batch Details */}
                  {selectedInventoryRow && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        {form.transaction_type === 'sell' ? 'Selling From' : 'Selected Location'}
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400 mb-1">Godown</p>
                          <p className="font-semibold text-slate-700">{selectedInventoryRow.godown_name}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Batch</p>
                          <p className="font-semibold text-slate-700">{selectedInventoryRow.batch_code}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Available</p>
                          <p className="font-semibold text-emerald-600">{currentStock} {selectedProduct?.unit || 'boxes'}</p>
                        </div>
                      </div>
                      {selectedInventoryRow.location_in_godown && (
                        <p className="text-xs text-slate-500 mt-2">
                          Location: {selectedInventoryRow.location_in_godown}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : !inventoryLoading ? (
                <p className="text-sm text-amber-600">No stock found for this product. {form.transaction_type === 'buy' ? 'You can still proceed with the purchase.' : 'Cannot sell without stock.'}</p>
              ) : null}
            </div>
          )}

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unit Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm(f => ({ ...f, unit_price: e.target.value }))}
                placeholder="₹ per unit"
                className="input-modern"
              />
            </div>
            <div>
              <label className="label">Total Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.total_price}
                onChange={(e) => setForm(f => ({ ...f, total_price: e.target.value }))}
                placeholder="₹ total"
                className="input-modern"
              />
            </div>
          </div>

          {/* Party Name + Invoice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{form.transaction_type === 'buy' ? 'Supplier' : 'Customer'}</label>
              <input
                type="text"
                value={form.party_name}
                onChange={(e) => setForm(f => ({ ...f, party_name: e.target.value }))}
                placeholder="Party name"
                className="input-modern"
              />
            </div>
            <div>
              <label className="label">Invoice Number</label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                placeholder="e.g. INV-2024-001"
                className="input-modern"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional details..."
              className="input-modern resize-none"
              rows={2}
            />
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button 
              type="submit" 
              disabled={saving || inventoryLoading || (form.transaction_type === 'sell' && !selectedInventoryRow)} 
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {saving ? 'Saving...' : form.transaction_type === 'buy' ? 'Create Purchase' : 'Create Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TradesPage
