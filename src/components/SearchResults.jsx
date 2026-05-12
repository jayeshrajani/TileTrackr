function SearchResults({ query, results, selectedTileId, onSelectTile }) {
  const getPackageCount = (value, fallback) => {
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

  if (!query) return null

  return (
    <div className="mt-8 card overflow-hidden">
      {results.length === 0 ? (
        <p className="px-8 py-6 text-lg text-slate-400">No tiles found.</p>
      ) : (
        <ul className="max-h-96 overflow-auto divide-y divide-slate-100">
          {results.map((tile) => {
            const packageCount = getPackageCount(tile.package_spec, tile.pieces_per_box)

            return <li key={tile.id}>
              <button
                type="button"
                onClick={() => onSelectTile(tile.id)}
                className={`flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-all duration-200 ${
                  tile.id === selectedTileId
                    ? 'bg-indigo-50 border-l-4 border-indigo-500'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">
                    {tile.brand} {tile.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {tile.size}
                    {packageCount != null ? ` • Pack: ${packageCount} pcs/box` : ''}
                  </p>
                </div>
                <div className="text-sm text-indigo-600 font-semibold">
                  {tile.id === selectedTileId ? '✓ Selected' : 'View'}
                </div>
              </button>
            </li>
          })}
        </ul>
      )}
    </div>
  )
}

export default SearchResults
