import { useEffect, useMemo, useState } from 'react'
import { getAllTransactions } from '../services/inventoryService'
import { jsPDF } from 'jspdf'

function AnalysisPage({ onOpenDeepDive }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    getAllTransactions().then((data) => {
      setTransactions(data)
      setLoading(false)
    })
  }, [])

  // Filter transactions by search query + date range
  const filteredTransactions = useMemo(() => {
    let result = transactions

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(txn => new Date(txn.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(txn => new Date(txn.created_at) <= to)
    }

    // Text search
    const q = searchQuery.toLowerCase().trim()
    if (q) {
      result = result.filter((txn) => {
        const searchable = [
          txn.product_name,
          txn.party_name,
          txn.godown_name,
          txn.batch_code,
          txn.invoice_number,
          txn.notes,
          txn.transaction_type,
          txn.location_in_godown,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return searchable.includes(q)
      })
    }

    return result
  }, [transactions, searchQuery, dateFrom, dateTo])

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, dateFrom, dateTo])

  // Summary stats
  const stats = useMemo(() => {
    const buys = filteredTransactions.filter(t => t.transaction_type === 'buy' && !t.is_reversed)
    const sells = filteredTransactions.filter(t => t.transaction_type === 'sell' && !t.is_reversed)
    const reversed = filteredTransactions.filter(t => t.is_reversed)
    const totalBuyValue = buys.reduce((sum, t) => sum + (t.total_price || 0), 0)
    const totalSellValue = sells.reduce((sum, t) => sum + (t.total_price || 0), 0)
    return { buys: buys.length, sells: sells.length, reversed: reversed.length, totalBuyValue, totalSellValue }
  }, [filteredTransactions])

  // Download filtered transactions as PDF report
  const downloadReport = (txns, summary, filters) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    const contentWidth = pageWidth - margin * 2

    // Helper: draw a horizontal line
    const drawLine = (yPos) => {
      doc.setDrawColor(220, 220, 230)
      doc.setLineWidth(0.3)
      doc.line(margin, yPos, pageWidth - margin, yPos)
    }

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 50)
    doc.text('TileTrackr Trade Report', margin, 22)

    // Date range subtitle
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 120)
    let periodLabel = 'All Time'
    if (filters.dateFrom && filters.dateTo) {
      periodLabel = `${new Date(filters.dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(filters.dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    } else if (filters.dateFrom) {
      periodLabel = `From ${new Date(filters.dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} onwards`
    } else if (filters.dateTo) {
      periodLabel = `Up to ${new Date(filters.dateTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    }
    doc.text(`Period: ${periodLabel}`, margin, 30)
    if (filters.searchQuery) {
      doc.text(`Search filter: "${filters.searchQuery}"`, margin, 36)
    }
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, filters.searchQuery ? 42 : 36)

    let y = filters.searchQuery ? 50 : 44
    drawLine(y)
    y += 8

    // Summary section
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 50)
    doc.text('Summary', margin, y)
    y += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 50, 70)
    const summaryData = [
      ['Total Transactions', String(txns.length)],
      ['Purchases', `${summary.buys} trades  |  Rs. ${summary.totalBuyValue.toLocaleString('en-IN')}`],
      ['Sales', `${summary.sells} trades  |  Rs. ${summary.totalSellValue.toLocaleString('en-IN')}`],
      ['Net Profit/Loss', `Rs. ${(summary.totalSellValue - summary.totalBuyValue).toLocaleString('en-IN')}`],
      ['Reversed', `${summary.reversed} transactions`],
    ]
    summaryData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(value, margin + 42, y)
      y += 5.5
    })

    y += 4
    drawLine(y)
    y += 8

    // Transaction table
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 50)
    doc.text(`Transactions (${txns.length})`, margin, y)
    y += 8

    // Table header
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 100)
    doc.setFillColor(245, 246, 250)
    doc.rect(margin, y - 4, contentWidth, 7, 'F')
    const cols = [margin, margin + 20, margin + 36, margin + 82, margin + 118, margin + 140, margin + 160]
    doc.text('DATE', cols[0], y)
    doc.text('TYPE', cols[1], y)
    doc.text('PRODUCT', cols[2], y)
    doc.text('PARTY', cols[3], y)
    doc.text('QTY', cols[4], y)
    doc.text('AMOUNT (Rs.)', cols[5], y)
    y += 7

    // Table rows
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 40, 60)
    doc.setFontSize(7.5)
    txns.forEach((txn, idx) => {
      if (y > 275) {
        doc.addPage()
        y = 20
        // Repeat header on new page
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(80, 80, 100)
        doc.setFillColor(245, 246, 250)
        doc.rect(margin, y - 4, contentWidth, 7, 'F')
        doc.text('DATE', cols[0], y)
        doc.text('TYPE', cols[1], y)
        doc.text('PRODUCT', cols[2], y)
        doc.text('PARTY', cols[3], y)
        doc.text('QTY', cols[4], y)
        doc.text('AMOUNT (Rs.)', cols[5], y)
        y += 7
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(40, 40, 60)
      }

      // Alternate row background
      if (idx % 2 === 0) {
        doc.setFillColor(252, 252, 255)
        doc.rect(margin, y - 3.5, contentWidth, 5.5, 'F')
      }

      const date = new Date(txn.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      doc.text(date, cols[0], y)
      doc.text(txn.transaction_type === 'buy' ? 'BUY' : txn.transaction_type === 'return_in' ? 'RETURN' : 'SELL', cols[1], y)
      doc.text((txn.product_name || '-').substring(0, 28), cols[2], y)
      doc.text((txn.party_name || '-').substring(0, 22), cols[3], y)
      doc.text(String(txn.quantity || 0), cols[4], y)
      doc.text(txn.total_price ? `Rs. ${txn.total_price.toLocaleString('en-IN')}` : '-', cols[5], y)
      y += 5.5
    })

    // Footer
    y += 6
    drawLine(y)
    y += 6
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Report contains ${txns.length} transactions for period: ${periodLabel}`, margin, y)

    // File name with date range
    let filename = 'TileTrackr_Report'
    if (filters.dateFrom) filename += `_from_${filters.dateFrom}`
    if (filters.dateTo) filename += `_to_${filters.dateTo}`
    if (!filters.dateFrom && !filters.dateTo) filename += `_${new Date().toISOString().split('T')[0]}`
    doc.save(`${filename}.pdf`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">Search and review all trade history</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenDeepDive}
            className="group relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="relative">
              <path d="M12 2l1.09 3.26L16 6l-2.91.74L12 10l-1.09-3.26L8 6l2.91-.74L12 2z" fill="currentColor" opacity="0.9"/>
              <path d="M19 11l.74 2.22L22 14l-2.26.78L19 17l-.74-2.22L16 14l2.26-.78L19 11z" fill="currentColor" opacity="0.6"/>
              <path d="M6 15l.5 1.5L8 17l-1.5.5L6 19l-.5-1.5L4 17l1.5-.5L6 15z" fill="currentColor" opacity="0.4"/>
            </svg>
            <span className="relative">Deep Dive</span>
          </button>
          <button
            type="button"
            onClick={() => downloadReport(filteredTransactions, stats, { dateFrom, dateTo, searchQuery })}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v7M4 7l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download Report
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Purchases</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.buys}</p>
          <p className="text-xs text-slate-400 mt-0.5">₹{stats.totalBuyValue.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sales</p>
          <p className="text-xl font-bold text-red-600 mt-1">{stats.sells}</p>
          <p className="text-xs text-slate-400 mt-0.5">₹{stats.totalSellValue.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Net</p>
          <p className={`text-xl font-bold mt-1 ${stats.totalSellValue - stats.totalBuyValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ₹{(stats.totalSellValue - stats.totalBuyValue).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Sell - Buy</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reversed</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{stats.reversed}</p>
          <p className="text-xs text-slate-400 mt-0.5">transactions</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="5" stroke="#94a3b8" strokeWidth="1.5"/>
            <path d="M11 11l3.5 3.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search trades by product, party, invoice, godown, batch…"
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 shadow-apple-xs focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 block">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-apple-xs focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 block">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-apple-xs focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
        {/* Quick presets */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { const d = new Date().toISOString().split('T')[0]; setDateFrom(d); setDateTo(d) }}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) }}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            7 days
          </button>
          <button
            type="button"
            onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) }}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            30 days
          </button>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {filteredTransactions.length === transactions.length
            ? `${transactions.length} total trades`
            : `${filteredTransactions.length} of ${transactions.length} trades`}
        </p>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[2.5px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
      ) : paginatedTransactions.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm font-semibold text-slate-600">
            {searchQuery ? 'No trades match your search' : 'No transactions yet'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery ? 'Try a different search term' : 'Trades will appear here once recorded'}
          </p>
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        REVERSED
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      {new Date(txn.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
                    <span><span className="font-semibold text-slate-700">{txn.quantity}</span> {Number(txn.quantity) === 1 ? txn.unit : txn.unit === 'box' ? 'boxes' : (txn.unit + 's')}</span>
                    {txn.godown_name && <span>• {txn.godown_name}</span>}
                    {txn.location_in_godown && <span>• {txn.location_in_godown}</span>}
                    {txn.batch_code && <span>• Batch: {txn.batch_code}</span>}
                    {txn.invoice_number && <span>• Inv: {txn.invoice_number}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {txn.total_price ? (
                    <>
                      <p className="text-lg font-bold text-slate-900">₹{txn.total_price.toLocaleString()}</p>
                      {txn.unit_price && (
                        <p className="text-xs text-slate-400">@ ₹{txn.unit_price}/{txn.unit}</p>
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
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AnalysisPage
