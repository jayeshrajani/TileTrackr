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
    <div ref={ref} className="relative flex-1 min-w-[130px] max-w-[180px] sm:max-w-none">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-apple-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-apple-xs'
        }`}
      >
        <span className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          {isActive && (
            <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-md text-[9px] sm:text-[10px] font-bold flex items-center justify-center bg-indigo-500 text-white">
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
        <div className="absolute top-full left-0 mt-2 z-30 bg-white rounded-xl shadow-apple-lg border border-slate-100 overflow-hidden w-full min-w-[200px] sm:min-w-[240px] max-w-[280px]">
          {/* Search inside dropdown */}
          {options.length > 5 && (
            <div className="p-2 border-b border-slate-100">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="#94a3b8" strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Select all / clear row */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-400">{filtered.length} option{filtered.length !== 1 ? 's' : ''}</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-semibold text-red-500 hover:opacity-70 transition-opacity"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No results</p>
            ) : (
              filtered.map(({ value, count }) => {
                const checked = selected.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(value)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                      checked ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <span className={`w-4.5 h-4.5 rounded-md flex-shrink-0 flex items-center justify-center border-[1.5px] transition-all ${
                      checked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white'
                    }`}>
                      {checked && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className={`flex-1 text-sm ${checked ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                      {value}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">{count}</span>
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
  // Build option lists with counts - cascading based on selected filters
  const options = useMemo(() => {
    // Apply filters progressively for cascading
    let filteredForBrand = allTiles
    if (filters.brand.length > 0) {
      filteredForBrand = allTiles.filter(t => filters.brand.includes(t.brand))
    }

    let filteredForSize = filteredForBrand
    if (filters.size.length > 0) {
      filteredForSize = filteredForBrand.filter(t => filters.size.includes(t.size))
    }

    let filteredForFinish = filteredForSize
    if (filters.finish.length > 0) {
      filteredForFinish = filteredForSize.filter(t => filters.finish.includes(t.finish))
    }

    let filteredForCategory = filteredForFinish
    if (filters.category.length > 0) {
      filteredForCategory = filteredForFinish.filter(t => filters.category.includes(t.categories?.name))
    }

    const tally = (accessor, sourceList) => {
      const map = {}
      sourceList.forEach((t) => {
        const v = accessor(t)
        if (v) map[v] = (map[v] || 0) + 1
      })
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([value, count]) => ({ value, count }))
    }

    return {
      brand:    tally((t) => t.brand, allTiles),
      size:     tally((t) => t.size, filteredForBrand),
      finish:   tally((t) => t.finish, filteredForSize),
      category: tally((t) => t.categories?.name, filteredForFinish),
      grade:    tally((t) => t.grade, filteredForCategory),
    }
  }, [allTiles, filters])

  const totalActive =
    filters.brand.length + filters.size.length +
    filters.finish.length + filters.category.length +
    filters.grade.length + (filters.favoritesOnly ? 1 : 0)

  const hasAny      = totalActive > 0
  const favCount    = allTiles.filter((t) => t.is_favorite).length
  const showFavToggle = favCount > 0
  const clearAll    = () => onChange({ brand: [], size: [], finish: [], category: [], grade: [], favoritesOnly: false })

  return (
    <div className="space-y-3">
      {/* ── Filter row ── */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <FilterDropdown
          label="Grade"
          options={options.grade}
          selected={filters.grade}
          onChange={(v) => onChange({ ...filters, grade: v })}
        />

          {/* Favourites toggle */}
        {showFavToggle ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              filters.favoritesOnly
                ? 'bg-red-50 text-red-600 border-red-200 shadow-apple-xs'
                : 'bg-white text-slate-500 border-slate-200 hover:border-red-200 hover:text-red-500 hover:shadow-apple-xs'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 15 15"
              fill={filters.favoritesOnly ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
            </svg>
            <span className="hidden xs:inline">Favourites</span>
            <span className="xs:hidden">♥</span>
          </button>
        ) : null}

        {/* Result count + clear */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto sm:ml-auto justify-end">
          <span className="text-xs sm:text-sm text-slate-400 whitespace-nowrap tabular-nums">
            {resultCount === totalCount ? `${totalCount}` : `${resultCount}/${totalCount}`}
          </span>
          {hasAny && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs sm:text-sm font-semibold text-red-500 hover:opacity-70 transition-opacity whitespace-nowrap"
            >
              Clear
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
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
              >
                <span className="text-[10px] text-indigo-400 uppercase tracking-wider">{key}</span>
                {val}
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, [key]: filters[key].filter((v) => v !== val) })}
                  className="w-4 h-4 rounded-md flex items-center justify-center hover:bg-indigo-100 transition-colors"
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
            <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-100">
              ❤ Favourites only
              <button
                type="button"
                onClick={() => onChange({ ...filters, favoritesOnly: false })}
                className="w-4 h-4 rounded-md flex items-center justify-center hover:bg-red-100 transition-colors"
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
