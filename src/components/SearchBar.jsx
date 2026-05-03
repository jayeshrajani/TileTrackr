function SearchBar({ query, onChange }) {
  return (
    <label className="block relative">
      <span className="sr-only">Search tiles by name, size, or brand</span>
      {/* Search icon */}
      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="#aeaeb2" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, size, brand…"
        className="w-full rounded-2xl border border-apple-gray-3 bg-white pl-11 pr-5 py-3.5 text-sm text-apple-text-1 placeholder:text-apple-text-3 outline-none transition-all duration-200 focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20 shadow-apple-xs"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-apple-gray-3 flex items-center justify-center hover:bg-apple-gray-2 transition-colors"
          aria-label="Clear search"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </label>
  )
}

export default SearchBar
