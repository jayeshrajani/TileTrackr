function SearchResults({ query, results, selectedTileId, onSelectTile }) {
  if (!query) return null

  return (
    <div className="mt-8 border border-slate-200 bg-white">
      {results.length === 0 ? (
        <p className="px-8 py-6 text-lg text-muted">No tiles found.</p>
      ) : (
        <ul className="max-h-96 overflow-auto divide-y divide-slate-200">
          {results.map((tile) => (
            <li key={tile.id}>
              <button
                type="button"
                onClick={() => onSelectTile(tile.id)}
                className={`flex w-full items-center justify-between gap-4 px-8 py-6 text-left transition ${
                  tile.id === selectedTileId
                    ? 'bg-blue-50 border-l-4 border-accent'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex-1">
                  <p className="font-bold text-slate-900">
                    {tile.brand} {tile.name}
                  </p>
                  <p className="mt-2 text-sm text-muted">{tile.size}</p>
                </div>
                <div className="text-sm text-accent font-bold">
                  {tile.id === selectedTileId ? '✓ Selected' : 'View'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchResults
