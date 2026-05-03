import { useState } from 'react'
import ExpandableTileCard from './ExpandableTileCard'
import { getTileInventory } from '../services/inventoryService'

function LatestTilesGrid({ tiles, onToggleFavorite, isAdminLoggedIn, onQuickAdd }) {
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

  if (tiles.length === 0) {
    return (
      <div className="card py-20 text-center">
        <div className="w-10 h-10 rounded-2xl bg-apple-gray mx-auto mb-4 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#d2d2d7"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#d2d2d7" fillOpacity="0.6"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#d2d2d7" fillOpacity="0.6"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#d2d2d7" fillOpacity="0.3"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-apple-text-2">No tiles found</p>
        <p className="text-xs text-apple-text-3 mt-1">Try adjusting your search</p>
      </div>
    )
  }

  const gridItems = tiles.flatMap((tile) => {
    const isSelected = expandedId === tile.id
    const isLoading = loadingId === tile.id

    const card = (
      <button
        key={tile.id}
        type="button"
        onClick={() => handleTileClick(tile)}
        disabled={isLoading}
        className={`card group relative flex flex-col overflow-hidden text-left transition-all duration-300 hover:shadow-apple-sm hover:-translate-y-0.5 disabled:opacity-60 ${
          isSelected ? 'ring-2 ring-apple-blue shadow-apple-sm' : ''
        }`}
      >
        <div className="p-4 pb-3 flex flex-col gap-2">
          {/* Top row: favorite + loading */}
          <div className="flex items-center justify-between">
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-[2px] border-apple-blue border-t-transparent rounded-full animate-spin" />
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
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-apple-gray-2 transition-colors"
              aria-label={tile.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {tile.is_favorite ? (
                <svg width="13" height="13" viewBox="0 0 15 15" fill="#ff3b30" aria-hidden="true">
                  <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="#aeaeb2" strokeWidth="1.4" aria-hidden="true">
                  <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
                </svg>
              )}
            </span>
          </div>

          {/* Name & brand */}
          <div>
            {tile.brand && (
              <p className="caption mb-0.5 line-clamp-1">{tile.brand}</p>
            )}
            <p className="text-sm font-semibold text-apple-text-1 line-clamp-2 leading-snug">
              {tile.product_name || tile.name}
            </p>
          </div>

          {/* Size + chevron row */}
          <div className="flex items-center justify-between gap-1 mt-0.5">
            {tile.size ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-apple-gray text-[10px] font-medium text-apple-text-2">
                {tile.size}
              </span>
            ) : <span />}
            <div className={`transition-transform duration-300 flex-shrink-0 ${isSelected ? 'rotate-180' : ''}`}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 3.5l3 3 3-3" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
        className="col-span-full card border-apple-blue/30 overflow-hidden"
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
          />
        ) : (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-[2.5px] border-apple-blue border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    )

    return [card, panel]
  })

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {gridItems}
    </div>
  )
}

export default LatestTilesGrid
