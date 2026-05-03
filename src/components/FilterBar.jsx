import { useEffect, useMemo, useRef, useState } from 'react'

function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref               = useRef(null)
  const inputRef          = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const toggle = (val) => {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange([...next])
  }

  const filtered = options.filter(({ value }) =>
    value.toLowerCase().includes(search.toLowerCase())
  )

  const isActive = selected.length > 0
  const summary  = selected.length === 0
    ? label
    : selected.length === 1
    ? selected[0]
    : `${selected[0]} +${selected.length - 1}`

  if (options.length === 0) return null

  return (
    <div ref={ref} className="relative flex-1 min-w-[160px]">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-apple-blue text-white border-apple-blue shadow-apple-xs'
            : 'bg-white text-apple-text-1 border-apple-gray-3 hover:border-apple-blue/50 hover:shadow-apple-xs'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {isActive && (
            <span className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
              isActive ? 'bg-white/25 text-white' : 'bg-apple-gray-3 text-apple-text-3'
            }`}>
              {selected.length}
            </span>
          )}
          <span className="truncate">{summary}</span>
        </span>
        <svg
          width="11" height="11" viewBox="0 0 10 10" fill="none"
          className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-white rounded-2xl shadow-apple-modal border border-apple-gray-2 overflow-hidden">
          {/* Search inside dropdown */}
          {options.length > 5 && (
            <div className="p-2 border-b border-apple-gray-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-apple-gray">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="#aeaeb2" strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke="#aeaeb2" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="flex-1 bg-transparent text-sm text-apple-text-1 placeholder:text-apple-text-3 outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-apple-text-3 hover:text-apple-text-1">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Select all / clear row */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-apple-gray-2 bg-apple-gray/40">
            <span className="text-xs text-apple-text-3">{filtered.length} option{filtered.length !== 1 ? 's' : ''}</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-medium text-apple-red hover:opacity-70 transition-opacity"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-apple-text-3 text-center py-4">No results</p>
            ) : (
              filtered.map(({ value, count }) => {
                const checked = selected.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(value)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-apple-gray ${
                      checked ? 'bg-apple-blue/5' : ''
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-[1.5px] transition-all ${
                      checked ? 'bg-apple-blue border-apple-blue' : 'border-apple-gray-3 bg-white'
                    }`}>
                      {checked && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className={`flex-1 text-sm ${checked ? 'text-apple-text-1 font-medium' : 'text-apple-text-2'}`}>
                      {value}
                    </span>
                    <span className="text-xs text-apple-text-3 tabular-nums">{count}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FilterBar({ allTiles, filters, onChange, resultCount, totalCount }) {
  // Build option lists with counts
  const options = useMemo(() => {
    const tally = (accessor) => {
      const map = {}
      allTiles.forEach((t) => {
        const v = accessor(t)
        if (v) map[v] = (map[v] || 0) + 1
      })
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([value, count]) => ({ value, count }))
    }
    return {
      brand:    tally((t) => t.brand),
      size:     tally((t) => t.size),
      finish:   tally((t) => t.finish),
      category: tally((t) => t.categories?.name),
    }
  }, [allTiles])

  const totalActive =
    filters.brand.length + filters.size.length +
    filters.finish.length + filters.category.length +
    (filters.favoritesOnly ? 1 : 0)

  const hasAny      = totalActive > 0
  const favCount    = allTiles.filter((t) => t.is_favorite).length
  const clearAll    = () => onChange({ brand: [], size: [], finish: [], category: [], favoritesOnly: false })

  return (
    <div className="space-y-3">
      {/* ── Filter row ── */}
      <div className="flex items-stretch gap-2 flex-wrap">
        <FilterDropdown
          label="Brand"
          options={options.brand}
          selected={filters.brand}
          onChange={(v) => onChange({ ...filters, brand: v })}
        />
        <FilterDropdown
          label="Category"
          options={options.category}
          selected={filters.category}
          onChange={(v) => onChange({ ...filters, category: v })}
        />
        <FilterDropdown
          label="Size"
          options={options.size}
          selected={filters.size}
          onChange={(v) => onChange({ ...filters, size: v })}
        />
        <FilterDropdown
          label="Finish"
          options={options.finish}
          selected={filters.finish}
          onChange={(v) => onChange({ ...filters, finish: v })}
        />

        {/* Favourites toggle */}
        {favCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
              filters.favoritesOnly
                ? 'bg-apple-red text-white border-apple-red shadow-apple-xs'
                : 'bg-white text-apple-text-2 border-apple-gray-3 hover:border-apple-red/50 hover:text-apple-red hover:shadow-apple-xs'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 15 15"
              fill={filters.favoritesOnly ? 'white' : 'none'}
              stroke={filters.favoritesOnly ? 'white' : 'currentColor'}
              strokeWidth="1.4"
            >
              <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
            </svg>
            Favourites
          </button>
        )}

        {/* Result count + clear */}
        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          <span className="text-sm text-apple-text-3">
            {resultCount === totalCount ? `${totalCount} tiles` : `${resultCount} of ${totalCount}`}
          </span>
          {hasAny && (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm font-medium text-apple-red hover:opacity-70 transition-opacity"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Active filter tags ── */}
      {hasAny && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {['brand', 'size', 'finish', 'category'].flatMap((key) =>
            filters[key].map((val) => (
              <span
                key={`${key}-${val}`}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-medium bg-apple-blue/10 text-apple-blue border border-apple-blue/20"
              >
                <span className="text-[10px] text-apple-blue/60 uppercase tracking-wider">{key}</span>
                {val}
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, [key]: filters[key].filter((v) => v !== val) })}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-apple-blue/20 transition-colors"
                  aria-label={`Remove ${val}`}
                >
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </span>
            ))
          )}
          {filters.favoritesOnly && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-medium bg-apple-red/10 text-apple-red border border-apple-red/20">
              ❤ Favourites only
              <button
                type="button"
                onClick={() => onChange({ ...filters, favoritesOnly: false })}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-apple-red/20 transition-colors"
              >
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterBar
