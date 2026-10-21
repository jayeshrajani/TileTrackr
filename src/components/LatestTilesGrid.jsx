import { useState } from 'react'
import ExpandableTileCard from './ExpandableTileCard'
import { getTileInventory } from '../services/inventoryService'
import { formatQty } from '../utils/formatQty'
import { getStockStatus, getSwatchStyle } from '../utils/tileVisual'

function getGradeTagClass(grade) {
  const normalizedGrade = grade?.trim().toLowerCase()

  if (normalizedGrade === 'standard') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70'
  }

  if (normalizedGrade === 'commercial') {
    return 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/70'
  }

  return 'bg-clay-50 text-clay-700 ring-1 ring-inset ring-clay-200/70'
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
      <div className="card py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto mb-4 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#cbd5e1"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#cbd5e1" fillOpacity="0.6"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#cbd5e1" fillOpacity="0.6"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#cbd5e1" fillOpacity="0.3"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700">No tiles found</p>
        <p className="text-[13px] text-slate-500 mt-1">Try adjusting your search or filters</p>
      </div>
    )
  }

  const cards = tiles.map((tile) => {
    const isSelected = expandedId === tile.id
    const isLoading = loadingId === tile.id

    const packageCount = getPackageCount(tile.package_spec, tile.pieces_per_box)
    const status = getStockStatus(tile.totalBoxes)

    return (
      <button
        key={tile.id}
        type="button"
        onClick={() => handleTileClick(tile)}
        disabled={isLoading}
        aria-expanded={isSelected}
        className={`group card overflow-hidden flex flex-col text-left transition-[box-shadow,transform,border-color] duration-200 hover:shadow-apple hover:-translate-y-0.5 hover:border-slate-300 active:translate-y-0 disabled:opacity-60 ${
          isSelected ? 'ring-2 ring-slate-900 border-transparent' : ''
        }`}
      >
        {/* Swatch preview */}
        <div className="relative h-24 sm:h-28 overflow-hidden" style={getSwatchStyle(tile)}>
          <span className="absolute inset-0 bg-gradient-to-t from-black/[0.12] via-transparent to-transparent" aria-hidden="true" />
          {tile.grade && (
            <span className={`absolute left-2.5 top-2.5 inline-flex items-center h-6 px-2 rounded-md text-[11px] font-medium capitalize shadow-apple-xs ${getGradeTagClass(tile.grade)}`}>
              {tile.grade.toLowerCase()}
            </span>
          )}
          {tile.size && (
            <span className="absolute left-2.5 bottom-2.5 inline-flex items-center h-6 px-2 rounded-md bg-white/90 backdrop-blur text-[11px] font-medium text-slate-700 tabular-nums shadow-apple-xs">
              {tile.size}
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(tile.id) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleFavorite(tile.id) }
            }}
            className="absolute right-2 top-2 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur shadow-apple-xs hover:bg-white hover:scale-105 transition-transform"
            aria-label={tile.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-[2px] border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            ) : tile.is_favorite ? (
              <svg width="16" height="16" viewBox="0 0 15 15" fill="#dc2626" aria-hidden="true">
                <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="#475569" strokeWidth="1.3" aria-hidden="true">
                <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
              </svg>
            )}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 flex flex-col flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 truncate min-h-[16px]">{tile.brand || ''}</p>
          <p className="mt-0.5 text-[15px] font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-clay-800 transition-colors">
            {tile.product_name || tile.name}
          </p>

          <div className="mt-auto pt-3">
            <p className={`flex items-center gap-1.5 text-[15px] font-semibold tabular-nums leading-tight ${status.key === 'out' ? 'text-slate-400' : 'text-slate-900'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} title={status.label} aria-hidden="true" />
              <span className="truncate">{formatQty(tile.totalBoxes || 0, packageCount, tile.unit || 'box')}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1 pl-3.5">
              {status.key === 'ok' ? (packageCount != null ? `${packageCount} pcs/box` : status.label) : status.label}
            </p>
          </div>
        </div>
      </button>
    )
  })

  const previewTile = tiles.find((t) => t.id === expandedId)

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
        {cards}
      </div>

      {/* Details: bottom sheet on phones, side drawer on desktop */}
      {expandedId && (
        <div className="fixed inset-0 z-40 !m-0 flex items-end lg:items-stretch lg:justify-end" role="dialog" aria-modal="true" aria-label="Tile details">
          <div className="modal-backdrop" onClick={handleCollapse} />
          <div
            className="relative w-full lg:w-[540px] max-h-[92dvh] lg:max-h-none lg:h-full bg-white rounded-t-3xl lg:rounded-none shadow-apple-modal overflow-y-auto overscroll-contain [animation:sheetUp_.32s_cubic-bezier(.32,.72,0,1)] lg:[animation:drawerIn_.32s_cubic-bezier(.32,.72,0,1)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
              <div aria-busy="true">
                <div className="h-40 lg:h-56 animate-pulse" style={previewTile ? getSwatchStyle(previewTile) : undefined} />
                <div className="p-5 sm:p-6 space-y-3 animate-pulse">
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="h-6 w-2/3 rounded bg-slate-200" />
                  <div className="grid grid-cols-2 gap-2 pt-3">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100" />)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default LatestTilesGrid
