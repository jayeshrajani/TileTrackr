import { useEffect, useMemo, useState } from 'react'
import { getAllTransactions } from '../services/inventoryService'

const qtyOf = (t) => Number(t.quantity) || 0
const fmtQty = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })
const isoDaysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// Simple SVG donut chart
function PieChart({ data, title }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
        <p className="text-[13px] text-slate-500 py-6 text-center">No data</p>
      </div>
    )
  }

  const colors = ['#9c4626', '#0f172a', '#059669', '#d97706', '#0284c7', '#d0774f', '#64748b', '#be185d']
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
      <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 200 200" className="w-28 h-28 flex-shrink-0" role="img" aria-label={title}>
          {slices.map((slice, i) => {
            if (slice.endAngle - slice.startAngle >= 359.99) {
              return <circle key={i} cx="100" cy="100" r="80" fill={slice.color} />
            }
            return (
              <path
                key={i}
                d={getPath(slice.startAngle, slice.endAngle)}
                fill={slice.color}
                stroke="white"
                strokeWidth="2"
              />
            )
          })}
          <circle cx="100" cy="100" r="48" fill="white" />
        </svg>
        <div className="flex-1 min-w-0 space-y-2 max-h-[140px] overflow-y-auto">
          {slices.slice(0, 6).map((slice, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-slate-700 truncate flex-1">{slice.label}</span>
              <span className="text-slate-500 font-medium tabular-nums">{((slice.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
          {data.length > 6 && (
            <p className="text-xs text-slate-500 pl-4">+{data.length - 6} more</p>
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

    // Most sold product (by units)
    const sellByProduct = {}
    sells.forEach(t => {
      const name = t.product_name || 'Unknown'
      sellByProduct[name] = (sellByProduct[name] || 0) + qtyOf(t)
    })
    const topSold = Object.entries(sellByProduct).sort((a, b) => b[1] - a[1])[0]

    // Most bought product (by units)
    const buyByProduct = {}
    buys.forEach(t => {
      const name = t.product_name || 'Unknown'
      buyByProduct[name] = (buyByProduct[name] || 0) + qtyOf(t)
    })
    const topBought = Object.entries(buyByProduct).sort((a, b) => b[1] - a[1])[0]

    // Top customer (by units)
    const customerFreq = {}
    sells.forEach(t => {
      const name = t.party_name || 'Walk-in'
      customerFreq[name] = (customerFreq[name] || 0) + qtyOf(t)
    })
    const topCustomer = Object.entries(customerFreq).sort((a, b) => b[1] - a[1])[0]

    // Top supplier (by units)
    const supplierFreq = {}
    buys.forEach(t => {
      const name = t.party_name || 'Unknown'
      supplierFreq[name] = (supplierFreq[name] || 0) + qtyOf(t)
    })
    const topSupplier = Object.entries(supplierFreq).sort((a, b) => b[1] - a[1])[0]

    const boughtQty = buys.reduce((s, t) => s + qtyOf(t), 0)
    const soldQty = sells.reduce((s, t) => s + qtyOf(t), 0)
    const avgSellQty = sells.length > 0 ? soldQty / sells.length : 0

    return {
      mostTraded, topSold, topBought, topCustomer, topSupplier,
      avgSellQty, boughtQty, soldQty,
      buyCount: buys.length, sellCount: sells.length,
      totalTrades: filtered.length,
    }
  }, [filtered])

  // Chart data (by units)
  const charts = useMemo(() => {
    const salesByProduct = {}
    filtered.filter(t => t.transaction_type === 'sell').forEach(t => {
      const name = t.product_name || 'Other'
      salesByProduct[name] = (salesByProduct[name] || 0) + qtyOf(t)
    })
    const salesPieData = Object.entries(salesByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    const purchasesByProduct = {}
    filtered.filter(t => t.transaction_type === 'buy').forEach(t => {
      const name = t.product_name || 'Other'
      purchasesByProduct[name] = (purchasesByProduct[name] || 0) + qtyOf(t)
    })
    const purchasesPieData = Object.entries(purchasesByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }))

    const buys = filtered.filter(t => t.transaction_type === 'buy')
    const sells = filtered.filter(t => t.transaction_type === 'sell')
    const typePieData = [
      { label: 'Purchased', value: buys.reduce((s, t) => s + qtyOf(t), 0) },
      { label: 'Sold', value: sells.reduce((s, t) => s + qtyOf(t), 0) },
    ]

    return { salesPieData, purchasesPieData, typePieData }
  }, [filtered])

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading insights">
        <div className="h-9 w-40 rounded-lg bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 h-[84px] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const presets = [
    { label: 'Today', from: isoDaysAgo(0) },
    { label: '7 days', from: isoDaysAgo(7) },
    { label: '30 days', from: isoDaysAgo(30) },
    { label: '90 days', from: isoDaysAgo(90) },
  ]
  const today = isoDaysAgo(0)
  const hasFilters = dateFrom || dateTo || searchQuery || txnTypeFilter !== 'all'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="icon-btn -ml-2"
          aria-label="Back to Analysis"
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="page-title">Deep Dive</h1>
          <p className="page-subtitle mt-0.5">Insights into your trade activity</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_160px_160px_140px] gap-3">
          <div className="col-span-2 lg:col-span-1">
            <label htmlFor="dd-search" className="label">Search</label>
            <input
              id="dd-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Product, party, godown…"
              className="input-modern h-11 py-0"
            />
          </div>
          <div>
            <label htmlFor="dd-from" className="label">From</label>
            <input
              id="dd-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="input-modern h-11 py-0"
            />
          </div>
          <div>
            <label htmlFor="dd-to" className="label">To</label>
            <input
              id="dd-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              max={today}
              className="input-modern h-11 py-0"
            />
          </div>
          <div className="col-span-2 lg:col-span-1">
            <p className="label">Type</p>
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1 h-11">
              {[['all', 'All'], ['buy', 'Buy'], ['sell', 'Sell']].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTxnTypeFilter(v)}
                  aria-pressed={txnTypeFilter === v}
                  className={`flex-1 rounded-lg text-[13px] font-medium transition-all ${txnTypeFilter === v ? 'bg-white text-slate-900 shadow-apple-xs' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Quick presets */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
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
          {hasFilters && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setSearchQuery(''); setTxnTypeFilter('all') }} className="chip border-transparent text-red-600 hover:text-red-700 hover:border-transparent">Clear all</button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Trades" value={kpis.totalTrades} sub={`${kpis.buyCount} buys · ${kpis.sellCount} sales`} />
        <KpiCard label="Most Traded" value={kpis.mostTraded?.[0] || '—'} sub={kpis.mostTraded ? `${kpis.mostTraded[1]} trades` : ''} />
        <KpiCard label="Top Sold Product" value={kpis.topSold?.[0] || '—'} sub={kpis.topSold ? `${fmtQty(kpis.topSold[1])} units` : ''} highlight="clay" />
        <KpiCard label="Top Bought Product" value={kpis.topBought?.[0] || '—'} sub={kpis.topBought ? `${fmtQty(kpis.topBought[1])} units` : ''} highlight="green" />
        <KpiCard label="Top Customer" value={kpis.topCustomer?.[0] || '—'} sub={kpis.topCustomer ? `${fmtQty(kpis.topCustomer[1])} units` : ''} />
        <KpiCard label="Top Supplier" value={kpis.topSupplier?.[0] || '—'} sub={kpis.topSupplier ? `${fmtQty(kpis.topSupplier[1])} units` : ''} />
        <KpiCard label="Avg Sale Size" value={`${fmtQty(kpis.avgSellQty)} units`} sub="per sale" />
        <KpiCard
          label="Units Sold / Bought"
          value={`${fmtQty(kpis.soldQty)} / ${fmtQty(kpis.boughtQty)}`}
          sub={kpis.boughtQty > 0 ? `${((kpis.soldQty / kpis.boughtQty) * 100).toFixed(0)}% sell-through` : ''}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <PieChart data={charts.typePieData} title="Bought vs Sold (units)" />
        <PieChart data={charts.salesPieData} title="Top Products Sold" />
        <PieChart data={charts.purchasesPieData} title="Top Products Purchased" />
      </div>

      {/* Summary table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Product-wise Summary</h3>
          <p className="text-xs text-slate-500 mt-0.5">Quantities in units</p>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto overscroll-contain">
          <ProductSummaryTable transactions={filtered} />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, highlight }) {
  const valueColor = highlight === 'green' ? 'text-emerald-700'
    : highlight === 'red' ? 'text-red-600'
    : highlight === 'clay' ? 'text-clay-700'
    : 'text-slate-900'
  return (
    <div className="card p-4 min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-[15px] font-semibold mt-1 truncate ${valueColor}`} title={typeof value === 'string' ? value : undefined}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function ProductSummaryTable({ transactions }) {
  const rows = useMemo(() => {
    const map = {}
    transactions.forEach(t => {
      const name = t.product_name || 'Unknown'
      if (!map[name]) map[name] = { name, buyQty: 0, sellQty: 0, trades: 0 }
      map[name].trades++
      if (t.transaction_type === 'buy') {
        map[name].buyQty += qtyOf(t)
      } else {
        map[name].sellQty += qtyOf(t)
      }
    })
    return Object.values(map).sort((a, b) => b.trades - a.trades)
  }, [transactions])

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 p-5">No transactions match current filters.</p>
  }

  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-[1]">
        <tr className="text-left text-xs text-slate-500">
          <th className="px-4 py-2.5 font-medium sticky left-0 bg-slate-50">Product</th>
          <th className="px-3 py-2.5 font-medium text-right">Trades</th>
          <th className="px-3 py-2.5 font-medium text-right">Bought</th>
          <th className="px-3 py-2.5 font-medium text-right">Sold</th>
          <th className="px-4 py-2.5 font-medium text-right">Net</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => {
          const net = row.buyQty - row.sellQty
          return (
            <tr key={row.name} className="hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-800 truncate max-w-[160px] sm:max-w-[280px] sticky left-0 bg-white">{row.name}</td>
              <td className="px-3 py-3 text-right text-slate-500 tabular-nums">{row.trades}</td>
              <td className="px-3 py-3 text-right text-emerald-700 tabular-nums">{row.buyQty ? fmtQty(row.buyQty) : '—'}</td>
              <td className="px-3 py-3 text-right text-clay-700 tabular-nums">{row.sellQty ? fmtQty(row.sellQty) : '—'}</td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${net >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                {net > 0 ? '+' : ''}{fmtQty(net)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default DeepDivePage
