import { useEffect, useMemo, useState } from 'react'
import { getAllTransactions } from '../services/inventoryService'

// Simple SVG Pie Chart component
function PieChart({ data, title }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-sm text-slate-400">No data</p>
      </div>
    )
  }

  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']
  let cumulative = 0
  const slices = data.map((d, i) => {
    const startAngle = (cumulative / total) * 360
    cumulative += d.value
    const endAngle = (cumulative / total) * 360
    return { ...d, startAngle, endAngle, color: colors[i % colors.length] }
  })

  const getPath = (startAngle, endAngle, radius = 80) => {
    const start = polarToCartesian(100, 100, radius, endAngle)
    const end = polarToCartesian(100, 100, radius, startAngle)
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0
    return `M 100 100 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-slate-800 mb-4">{title}</h3>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-32 h-32 flex-shrink-0">
          {slices.map((slice, i) => {
            if (slice.endAngle - slice.startAngle >= 359.99) {
              return <circle key={i} cx="100" cy="100" r="80" fill={slice.color} />
            }
            return (
              <path
                key={i}
                d={getPath(slice.startAngle, slice.endAngle)}
                fill={slice.color}
              />
            )
          })}
        </svg>
        <div className="flex-1 space-y-1.5 max-h-[140px] overflow-y-auto">
          {slices.slice(0, 6).map((slice, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-slate-600 truncate flex-1">{slice.label}</span>
              <span className="text-slate-400 font-medium tabular-nums">{((slice.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
          {data.length > 6 && (
            <p className="text-[10px] text-slate-400 pl-4">+{data.length - 6} more</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DeepDivePage({ onBack }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [txnTypeFilter, setTxnTypeFilter] = useState('all') // all | buy | sell

  useEffect(() => {
    getAllTransactions().then((data) => {
      setTransactions(data)
      setLoading(false)
    })
  }, [])

  // Apply filters
  const filtered = useMemo(() => {
    let result = transactions.filter(t => !t.is_reversed)

    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
      result = result.filter(t => new Date(t.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
      result = result.filter(t => new Date(t.created_at) <= to)
    }
    if (txnTypeFilter !== 'all') {
      result = result.filter(t => t.transaction_type === txnTypeFilter)
    }

    const q = searchQuery.toLowerCase().trim()
    if (q) {
      result = result.filter(t =>
        [t.product_name, t.party_name, t.godown_name, t.batch_code, t.invoice_number]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      )
    }

    return result
  }, [transactions, searchQuery, dateFrom, dateTo, txnTypeFilter])

  // KPIs
  const kpis = useMemo(() => {
    const buys = filtered.filter(t => t.transaction_type === 'buy')
    const sells = filtered.filter(t => t.transaction_type === 'sell')

    // Most traded product (by frequency)
    const productFreq = {}
    filtered.forEach(t => {
      const name = t.product_name || 'Unknown'
      productFreq[name] = (productFreq[name] || 0) + 1
    })
    const mostTraded = Object.entries(productFreq).sort((a, b) => b[1] - a[1])[0]

    // Most sold product (by value)
    const sellByProduct = {}
    sells.forEach(t => {
      const name = t.product_name || 'Unknown'
      sellByProduct[name] = (sellByProduct[name] || 0) + (t.total_price || 0)
    })
    const topSold = Object.entries(sellByProduct).sort((a, b) => b[1] - a[1])[0]

    // Most bought product (by value)
    const buyByProduct = {}
    buys.forEach(t => {
      const name = t.product_name || 'Unknown'
      buyByProduct[name] = (buyByProduct[name] || 0) + (t.total_price || 0)
    })
    const topBought = Object.entries(buyByProduct).sort((a, b) => b[1] - a[1])[0]

    // Top customer
    const customerFreq = {}
    sells.forEach(t => {
      const name = t.party_name || 'Walk-in'
      customerFreq[name] = (customerFreq[name] || 0) + (t.total_price || 0)
    })
    const topCustomer = Object.entries(customerFreq).sort((a, b) => b[1] - a[1])[0]

    // Top supplier
    const supplierFreq = {}
    buys.forEach(t => {
      const name = t.party_name || 'Unknown'
      supplierFreq[name] = (supplierFreq[name] || 0) + (t.total_price || 0)
    })
    const topSupplier = Object.entries(supplierFreq).sort((a, b) => b[1] - a[1])[0]

    // Average order value
    const avgSellValue = sells.length > 0
      ? sells.reduce((s, t) => s + (t.total_price || 0), 0) / sells.length
      : 0

    // Total volume traded (in units)
    const totalQty = filtered.reduce((s, t) => s + (t.quantity || 0), 0)

    // Profit margin
    const totalBuy = buys.reduce((s, t) => s + (t.total_price || 0), 0)
    const totalSell = sells.reduce((s, t) => s + (t.total_price || 0), 0)

    return {
      mostTraded, topSold, topBought, topCustomer, topSupplier,
      avgSellValue, totalQty, totalBuy, totalSell,
      buyCount: buys.length, sellCount: sells.length,
      totalTrades: filtered.length,
    }
  }, [filtered])

  // Chart data
  const charts = useMemo(() => {
    // Sales by product (top 6)
    const salesByProduct = {}
    filtered.filter(t => t.transaction_type === 'sell').forEach(t => {
      const name = t.product_name || 'Other'
      salesByProduct[name] = (salesByProduct[name] || 0) + (t.total_price || 0)
    })
    const salesPieData = Object.entries(salesByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    // Purchases by product (top 6)
    const purchasesByProduct = {}
    filtered.filter(t => t.transaction_type === 'buy').forEach(t => {
      const name = t.product_name || 'Other'
      purchasesByProduct[name] = (purchasesByProduct[name] || 0) + (t.total_price || 0)
    })
    const purchasesPieData = Object.entries(purchasesByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    // Trade type split
    const buys = filtered.filter(t => t.transaction_type === 'buy')
    const sells = filtered.filter(t => t.transaction_type === 'sell')
    const typePieData = [
      { label: 'Purchases', value: buys.reduce((s, t) => s + (t.total_price || 0), 0) },
      { label: 'Sales', value: sells.reduce((s, t) => s + (t.total_price || 0), 0) },
    ]

    return { salesPieData, purchasesPieData, typePieData }
  }, [filtered])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-[2.5px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 mb-0.5">Analytics</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Deep Dive</h1>
          <p className="text-sm text-slate-500 mt-0.5">Insights into your trade performance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 block">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Product, party, godown…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-apple-xs focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 block">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-apple-xs focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <div className="min-w-[130px]">
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
          <div className="min-w-[120px]">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 block">Type</label>
            <select
              value={txnTypeFilter}
              onChange={(e) => setTxnTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-apple-xs focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              <option value="all">All</option>
              <option value="buy">Purchases</option>
              <option value="sell">Sales</option>
            </select>
          </div>
        </div>
        {/* Quick presets */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { const d = new Date().toISOString().split('T')[0]; setDateFrom(d); setDateTo(d) }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Today</button>
          <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">7 days</button>
          <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">30 days</button>
          <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 90); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]) }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">90 days</button>
          {(dateFrom || dateTo || searchQuery || txnTypeFilter !== 'all') && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setSearchQuery(''); setTxnTypeFilter('all') }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">Clear all</button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Trades" value={kpis.totalTrades} />
        <KpiCard label="Most Traded" value={kpis.mostTraded?.[0] || '—'} sub={kpis.mostTraded ? `${kpis.mostTraded[1]} trades` : ''} />
        <KpiCard label="Top Sold Product" value={kpis.topSold?.[0] || '—'} sub={kpis.topSold ? `₹${Math.round(kpis.topSold[1]).toLocaleString()}` : ''} highlight="green" />
        <KpiCard label="Top Bought Product" value={kpis.topBought?.[0] || '—'} sub={kpis.topBought ? `₹${Math.round(kpis.topBought[1]).toLocaleString()}` : ''} highlight="blue" />
        <KpiCard label="Top Customer" value={kpis.topCustomer?.[0] || '—'} sub={kpis.topCustomer ? `₹${Math.round(kpis.topCustomer[1]).toLocaleString()}` : ''} />
        <KpiCard label="Top Supplier" value={kpis.topSupplier?.[0] || '—'} sub={kpis.topSupplier ? `₹${Math.round(kpis.topSupplier[1]).toLocaleString()}` : ''} />
        <KpiCard label="Avg Sale Value" value={`₹${Math.round(kpis.avgSellValue).toLocaleString()}`} />
        <KpiCard
          label="Gross Margin"
          value={kpis.totalSell > 0 ? `${(((kpis.totalSell - kpis.totalBuy) / kpis.totalSell) * 100).toFixed(1)}%` : '—'}
          sub={`₹${(kpis.totalSell - kpis.totalBuy).toLocaleString()} net`}
          highlight={kpis.totalSell - kpis.totalBuy >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PieChart data={charts.typePieData} title="Buy vs Sell (by value)" />
        <PieChart data={charts.salesPieData} title="Top Products Sold" />
        <PieChart data={charts.purchasesPieData} title="Top Products Purchased" />
      </div>

      {/* Summary table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
          <h3 className="text-sm font-bold text-slate-700">Product-wise Summary</h3>
        </div>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <ProductSummaryTable transactions={filtered} />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, highlight }) {
  const valueColor = highlight === 'green' ? 'text-emerald-600'
    : highlight === 'red' ? 'text-red-600'
    : highlight === 'blue' ? 'text-indigo-600'
    : 'text-slate-900'
  return (
    <div className="card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-bold mt-1 truncate ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ProductSummaryTable({ transactions }) {
  const rows = useMemo(() => {
    const map = {}
    transactions.forEach(t => {
      const name = t.product_name || 'Unknown'
      if (!map[name]) map[name] = { name, buyQty: 0, sellQty: 0, buyValue: 0, sellValue: 0, trades: 0 }
      map[name].trades++
      if (t.transaction_type === 'buy') {
        map[name].buyQty += (t.quantity || 0)
        map[name].buyValue += (t.total_price || 0)
      } else {
        map[name].sellQty += (t.quantity || 0)
        map[name].sellValue += (t.total_price || 0)
      }
    })
    return Object.values(map).sort((a, b) => b.trades - a.trades)
  }, [transactions])

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 p-5">No transactions match current filters.</p>
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
        <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
          <th className="px-4 py-2.5 font-semibold">Product</th>
          <th className="px-4 py-2.5 font-semibold text-right">Trades</th>
          <th className="px-4 py-2.5 font-semibold text-right">Bought (₹)</th>
          <th className="px-4 py-2.5 font-semibold text-right">Sold (₹)</th>
          <th className="px-4 py-2.5 font-semibold text-right">Net (₹)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.map((row) => (
          <tr key={row.name} className="hover:bg-slate-50/50">
            <td className="px-4 py-2.5 font-medium text-slate-700 truncate max-w-[200px]">{row.name}</td>
            <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">{row.trades}</td>
            <td className="px-4 py-2.5 text-right text-emerald-600 tabular-nums">{row.buyValue ? `₹${Math.round(row.buyValue).toLocaleString()}` : '—'}</td>
            <td className="px-4 py-2.5 text-right text-red-600 tabular-nums">{row.sellValue ? `₹${Math.round(row.sellValue).toLocaleString()}` : '—'}</td>
            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${row.sellValue - row.buyValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ₹{Math.round(row.sellValue - row.buyValue).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DeepDivePage
