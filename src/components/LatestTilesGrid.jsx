import { useState } from 'react'
import ExpandableTileCard from './ExpandableTileCard'
import { getTileInventory } from '../services/inventoryService'

function getGradeTagClass(grade) {
  const normalizedGrade = grade?.trim().toLowerCase()

  if (normalizedGrade === 'standard') {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (normalizedGrade === 'commercial') {
    return 'border border-amber-200 bg-amber-50 text-amber-700'
  }

  return 'border border-indigo-200 bg-indigo-50 text-indigo-600'
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

function LatestTilesGrid({ tiles, onToggleFavorite, isAdminLoggedIn, onQuickAdd, onDataChange }) {
  const [expandedId, setExpandedId] = useState(null)
  const [expandedInventory, setExpandedInventory] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  const handleTileClick = async (tile) => {
    // Toggle collapse
    if (expandedId === tile.id) {
      setExpandedId(null)
      setExpandedInventory(null)
      return
    }
    setExpandedId(tile.id)
    setExpandedInventory(null)
    setLoadingId(tile.id)
    const data = await getTileInventory(tile.id)
    setLoadingId(null)
    setExpandedInventory(data)
  }

  const handleCollapse = () => {
    setExpandedId(null)
    setExpandedInventory(null)
  }

  // Re-fetch inventory for the currently expanded tile (called after inline edit saves)
  const handleRefreshExpanded = async () => {
    if (!expandedId) return
    const data = await getTileInventory(expandedId)
    setExpandedInventory(data)
  }

  // Refresh entire tiles list and close expanded view (called after product deletion)
  const handleDataChange = () => {
    handleCollapse()
    if (onDataChange) onDataChange()
  }

  if (tiles.length === 0) {
    return (
      <div className="card py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto mb-4 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#cbd5e1"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#cbd5e1" fillOpacity="0.6"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#cbd5e1" fillOpacity="0.6"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#cbd5e1" fillOpacity="0.3"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-600">No tiles found</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
      </div>
    )
  }

  const gridItems = tiles.flatMap((tile) => {
    const isSelected = expandedId === tile.id
    const isLoading = loadingId === tile.id

    const packageCount = getPackageCount(tile.package_spec, tile.pieces_per_box)

    const card = (
      <button
        key={tile.id}
        type="button"
        onClick={() => handleTileClick(tile)}
        disabled={isLoading}
        className={`card group relative flex flex-col overflow-hidden text-left transition-all duration-200 hover:shadow-apple-sm hover:-translate-y-px disabled:opacity-60 ${
          isSelected ? 'ring-2 ring-indigo-500 shadow-apple-sm border-transparent' : 'hover:border-slate-200'
        }`}
      >
        <div className="p-4 pb-3 flex flex-col gap-2.5">
          {/* Top row: favorite + loading */}
          <div className="flex items-center justify-between">
            {isLoading ? (
              <div className="w-4 h-4 border-[2px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span /> 
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(tile.id) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleFavorite(tile.id) }
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={tile.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {tile.is_favorite ? (
                <svg width="14" height="14" viewBox="0 0 15 15" fill="#ef4444" aria-hidden="true">
                  <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="#cbd5e1" strokeWidth="1.4" aria-hidden="true">
                  <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
                </svg>
              )}
            </span>
          </div>

          {/* Name & brand */}
          <div>
            {tile.brand && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5 line-clamp-1">{tile.brand}</p>
            )}
            <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
              {tile.product_name || tile.name}
            </p>
            {tile.grade && (
              <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${getGradeTagClass(tile.grade)}`}>
                {tile.grade}
              </span>
            )}
            {packageCount != null && (
              <p className="mt-1 text-xs text-slate-500">Pack: {packageCount} pcs/box</p>
            )}
            <p className="mt-1.5 text-xs font-semibold text-indigo-600">
              Stock: {tile.totalBoxes || 0} {tile.unit || 'box'}{(tile.totalBoxes || 0) !== 1 ? 'es' : ''}
            </p>
          </div>

          {/* Size + chevron row */}
          <div className="flex items-center justify-between gap-1 mt-auto pt-1">
            {tile.size ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-semibold text-slate-500">
                {tile.size}
              </span>
            ) : <span />}
            <div className={`transition-transform duration-200 flex-shrink-0 ${isSelected ? 'rotate-180' : ''}`}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </button>
    )

    if (!isSelected) return [card]

    // ── Inline expansion panel (spans full grid width) ──
    const panel = (
      <div
        key={`panel-${tile.id}`}
        className="col-span-full card border-indigo-200 overflow-hidden"
      >
        {expandedInventory ? (
          <ExpandableTileCard
            tile={expandedInventory.tile}
            batches={expandedInventory.batches}
            totalBoxes={expandedInventory.totalBoxes}
            onToggleFavorite={onToggleFavorite}
            onQuickAdd={() => onQuickAdd(expandedInventory)}
            isAdminLoggedIn={isAdminLoggedIn}
            onCollapse={handleCollapse}
            onStockUpdated={handleRefreshExpanded}
            onDataChange={handleDataChange}
          />
        ) : (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-[2.5px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    )

    return [card, panel]
  })

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {gridItems}
    </div>
  )
}

export default LatestTilesGrid
