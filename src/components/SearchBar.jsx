function SearchBar({ query, onChange }) {
  return (
    <label className="block relative group">
      <span className="sr-only">Search tiles by name, size, or brand</span>
      {/* Search icon */}
      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-clay-600 transition-colors">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <input
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, size, brand…"
        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] duration-150 focus:border-clay-500 focus:ring-4 focus:ring-clay-500/10 hover:border-slate-300 shadow-apple-xs [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </label>
  )
}

export default SearchBar
