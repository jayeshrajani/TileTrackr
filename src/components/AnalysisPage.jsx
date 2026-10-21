import { useEffect, useMemo, useState } from 'react'
import { getAllTransactions } from '../services/inventoryService'
import { jsPDF } from 'jspdf'
import TransactionCard, { TransactionList } from './TransactionCard'

const sumQty = (list) => list.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0)
const fmtQty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

const isoDaysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

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

  // Summary stats (quantities only)
  const stats = useMemo(() => {
    const buys = filteredTransactions.filter(t => t.transaction_type === 'buy' && !t.is_reversed)
    const sells = filteredTransactions.filter(t => t.transaction_type === 'sell' && !t.is_reversed)
    const returns = filteredTransactions.filter(t => t.transaction_type === 'return_in' && !t.is_reversed)
    const reversed = filteredTransactions.filter(t => t.is_reversed)
    const boughtQty = sumQty(buys)
    const soldQty = sumQty(sells)
    const returnedQty = sumQty(returns)
    return {
      buys: buys.length,
      sells: sells.length,
      reversed: reversed.length,
      boughtQty,
      soldQty,
      netQty: boughtQty + returnedQty - soldQty,
    }
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
      ['Purchases', `${summary.buys} trades  |  ${fmtQty(summary.boughtQty)} units in`],
      ['Sales', `${summary.sells} trades  |  ${fmtQty(summary.soldQty)} units out`],
      ['Net Units', `${fmtQty(summary.netQty)} (in - out)`],
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
    const cols = [margin, margin + 20, margin + 38, margin + 118, margin + 164]
    doc.text('DATE', cols[0], y)
    doc.text('TYPE', cols[1], y)
    doc.text('PRODUCT', cols[2], y)
    doc.text('PARTY', cols[3], y)
    doc.text('QTY', cols[4], y)
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
      doc.text((txn.product_name || '-').substring(0, 44), cols[2], y)
      doc.text((txn.party_name || '-').substring(0, 26), cols[3], y)
      doc.text(fmtQty(txn.quantity), cols[4], y)
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

  const presets = [
    { label: 'Today', from: isoDaysAgo(0) },
    { label: '7 days', from: isoDaysAgo(7) },
    { label: '30 days', from: isoDaysAgo(30) },
  ]
  const today = isoDaysAgo(0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Analysis</h1>
          <p className="page-subtitle">Search and review all trade history</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex flex-shrink-0">
          <button
            type="button"
            onClick={onOpenDeepDive}
            className="btn-primary px-4"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 21H4.6c-.56 0-.84 0-1.054-.109a1 1 0 0 1-.437-.437C3 20.24 3 19.96 3 19.4V3M7 14l4-4 4 4 6-6"/>
            </svg>
            Deep Dive
          </button>
          <button
            type="button"
            onClick={() => downloadReport(filteredTransactions, stats, { dateFrom, dateTo, searchQuery })}
            disabled={filteredTransactions.length === 0}
            className="btn-secondary px-4"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v7M4 7l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="sm:hidden">Report</span>
            <span className="hidden sm:inline">Download Report</span>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Purchases', value: stats.buys, sub: `${fmtQty(stats.boughtQty)} units in`, color: 'text-emerald-700' },
          { label: 'Sales', value: stats.sells, sub: `${fmtQty(stats.soldQty)} units out`, color: 'text-clay-700' },
          { label: 'Net units', value: `${stats.netQty > 0 ? '+' : ''}${fmtQty(stats.netQty)}`, sub: 'In − Out', color: stats.netQty >= 0 ? 'text-slate-900' : 'text-red-600' },
          { label: 'Reversed', value: stats.reversed, sub: 'transactions', color: 'text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-[13px] text-slate-500">{s.label}</p>
            <p className={`text-2xl font-semibold tracking-tight tabular-nums mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
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
          type="search"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search product, party, invoice…"
          aria-label="Search trades"
          className="w-full h-12 pl-11 pr-12 rounded-xl border border-slate-200 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 shadow-apple-xs outline-none focus:border-clay-500 focus:ring-4 focus:ring-clay-500/10 transition-[border-color,box-shadow] [&::-webkit-search-cancel-button]:hidden"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label htmlFor="analysis-from" className="label">From</label>
            <input
              id="analysis-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="input-modern h-11 py-0"
            />
          </div>
          <div>
            <label htmlFor="analysis-to" className="label">To</label>
            <input
              id="analysis-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              max={today}
              className="input-modern h-11 py-0"
            />
          </div>
        </div>
        {/* Quick presets */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {presets.map((p) => {
            const active = dateFrom === p.from && dateTo === today
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { setDateFrom(p.from); setDateTo(today) }}
                aria-pressed={active}
                className={`chip ${active ? 'chip-active' : ''}`}
              >
                {p.label}
              </button>
            )
          })}
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="chip border-transparent text-red-600 hover:text-red-700 hover:border-transparent"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[13px] text-slate-500 tabular-nums">
        {filteredTransactions.length === transactions.length
          ? `${transactions.length} total trades`
          : `${filteredTransactions.length} of ${transactions.length} trades`}
      </p>

      {/* Transaction List */}
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading trades">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-5 flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-200" />
                <div className="h-3 w-1/3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : paginatedTransactions.length === 0 ? (
        <div className="card py-16 px-6 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {searchQuery ? 'No trades match your search' : 'No transactions yet'}
          </p>
          <p className="text-[13px] text-slate-500 mt-1">
            {searchQuery ? 'Try a different search term' : 'Trades will appear here once recorded'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <TransactionList>
            {paginatedTransactions.map((txn) => (
              <TransactionCard key={txn.id} txn={txn} showPackage />
            ))}
          </TransactionList>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary px-4"
              >
                ← Prev
              </button>
              <span className="text-[13px] text-slate-500 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary px-4"
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
