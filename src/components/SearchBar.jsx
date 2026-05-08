function SearchBar({ query, onChange }) {
  return (
    <label className="block relative group">
      <span className="sr-only">Search tiles by name, size, or brand</span>
      {/* Search icon */}
      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, size, brand…"
        className="w-full rounded-xl border border-slate-200 bg-white pl-11 sm:pl-12 pr-4 sm:pr-10 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300 shadow-apple-xs"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
          aria-label="Clear search"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </label>
  )
}

export default SearchBar
