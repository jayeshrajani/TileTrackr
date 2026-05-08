function SearchResults({ query, results, selectedTileId, onSelectTile }) {
  if (!query) return null

  return (
    <div className="mt-8 card overflow-hidden">
      {results.length === 0 ? (
        <p className="px-8 py-6 text-lg text-slate-400">No tiles found.</p>
      ) : (
        <ul className="max-h-96 overflow-auto divide-y divide-slate-100">
          {results.map((tile) => (
            <li key={tile.id}>
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
                  <p className="mt-1 text-sm text-slate-400">{tile.size}</p>
                </div>
                <div className="text-sm text-indigo-600 font-semibold">
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
