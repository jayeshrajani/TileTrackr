const TYPE_META = {
  buy: {
    label: 'Purchase',
    sign: '+',
    qtyClass: 'text-emerald-700',
    iconClass: 'bg-emerald-50 text-emerald-700',
    icon: 'M12 5v14M5 12l7 7 7-7',
  },
  sell: {
    label: 'Sale',
    sign: '−',
    qtyClass: 'text-clay-700',
    iconClass: 'bg-clay-50 text-clay-700',
    icon: 'M12 19V5M5 12l7-7 7 7',
  },
  return_in: {
    label: 'Return',
    sign: '+',
    qtyClass: 'text-sky-700',
    iconClass: 'bg-sky-50 text-sky-700',
    icon: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  },
}

function formatQuantity(qty) {
  const n = Number(qty) || 0
  return Number.isInteger(n) ? n : Number(n.toFixed(2))
}

function unitLabel(qty, unit = 'box') {
  if (Number(qty) === 1) return unit
  return unit === 'box' ? 'boxes' : `${unit}s`
}

const GRID = 'lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.5fr)_7rem]'
const GRID_WITH_ACTIONS = 'lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.5fr)_7rem_12.5rem]'

export function TransactionList({ children, withActions = false }) {
  return (
    <div className="card overflow-hidden divide-y divide-slate-100">
      <div className={`hidden lg:grid ${withActions ? GRID_WITH_ACTIONS : GRID} gap-5 pl-[76px] pr-5 py-2.5 bg-slate-50/80 text-xs font-medium text-slate-500`}>
        <span>Product</span>
        <span>Party</span>
        <span>Details</span>
        <span className="text-right">Quantity</span>
        {withActions && <span className="text-right">Actions</span>}
      </div>
      {children}
    </div>
  )
}

function TransactionCard({ txn, actions, showPackage = false }) {
  const meta = TYPE_META[txn.transaction_type] || TYPE_META.sell
  const created = new Date(txn.created_at)
  const details = [
    txn.godown_name,
    txn.location_in_godown,
    txn.batch_code && `Batch ${txn.batch_code}`,
    txn.invoice_number && `Inv ${txn.invoice_number}`,
  ].filter(Boolean)

  const qty = (
    <>
      {meta.sign}{formatQuantity(txn.quantity)}{' '}
      <span className="text-[13px] font-normal text-slate-500">{unitLabel(txn.quantity, txn.unit || 'box')}</span>
    </>
  )

  return (
    <article className={`px-4 sm:px-5 py-4 transition-colors ${txn.is_reversed ? 'bg-slate-50/70' : 'hover:bg-slate-50/60'}`}>
      <div className="flex gap-3 lg:gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${meta.iconClass} ${txn.is_reversed ? 'opacity-50' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={meta.icon} />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className={`lg:grid ${actions ? GRID_WITH_ACTIONS : GRID} lg:gap-5 lg:items-center`}>
            {/* Product + meta */}
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className={`text-[15px] font-semibold leading-snug min-w-0 break-words ${txn.is_reversed ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'}`}>{txn.product_name}</p>
                <p className={`lg:hidden text-[15px] font-semibold tabular-nums whitespace-nowrap ${meta.qtyClass}`}>{qty}</p>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-slate-500">
                <span className="font-medium text-slate-600">{meta.label}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={txn.created_at}>
                  {created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {', '}
                  {created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </time>
                {txn.is_reversed && (
                  <span className="ml-1 inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold tracking-wide bg-amber-100 text-amber-800">REVERSED</span>
                )}
              </div>
              {showPackage && txn.package_spec && (
                <p className="text-[13px] text-slate-500 mt-1">Package: {txn.package_spec}</p>
              )}
            </div>

            {/* Party */}
            <div className="min-w-0 mt-1.5 lg:mt-0">
              {txn.party_name ? (
                <p className="text-[13px] text-slate-600 truncate">
                  <span className="lg:hidden">{txn.transaction_type === 'buy' ? 'From ' : 'To '}</span>
                  <span className="font-medium text-slate-800">{txn.party_name}</span>
                </p>
              ) : (
                <p className="hidden lg:block text-[13px] text-slate-400">—</p>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0">
              {details.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2.5 lg:mt-0">
                  {details.map((d) => (
                    <span key={d} className="inline-flex items-center h-6 px-2 rounded-md bg-slate-100 text-[12px] text-slate-600 max-w-full truncate">{d}</span>
                  ))}
                </div>
              ) : (
                <p className="hidden lg:block text-[13px] text-slate-400">—</p>
              )}
            </div>

            {/* Quantity (desktop) */}
            <p className={`hidden lg:block text-right text-[15px] font-semibold tabular-nums whitespace-nowrap ${meta.qtyClass}`}>{qty}</p>

            {actions && (
              <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap justify-end gap-1 -mb-1.5 lg:mt-0 lg:pt-0 lg:border-0 lg:mb-0">
                {actions}
              </div>
            )}
          </div>

          {txn.notes && (
            <p className="mt-2.5 text-[13px] text-slate-500 leading-relaxed lg:max-w-3xl">{txn.notes}</p>
          )}
        </div>
      </div>
    </article>
  )
}

export default TransactionCard
