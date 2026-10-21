import { useEffect, useMemo, useRef, useState } from 'react'
import { deleteFilterOption, addFilterOption, deleteCategory, createCategory } from '../services/inventoryService'

function FilterDropdown({ label, options, selected, onChange, isAdmin, fieldKey, onRefresh }) {
  const [open, setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [newVal, setNewVal] = useState('')
  const [actionMsg, setActionMsg] = useState('')
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
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`chip ${isActive ? 'chip-active' : ''}`}
      >
        <span className="truncate max-w-[150px]">{summary}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`flex-shrink-0 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel: bottom sheet on phones, popover on larger screens */}
      {open && (
        <>
        <div className="modal-backdrop fixed z-50 sm:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[75dvh] bg-white rounded-t-3xl shadow-apple-modal overflow-hidden sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:left-0 sm:mt-2 sm:w-[264px] sm:max-h-none sm:rounded-xl sm:shadow-apple-lg sm:border sm:border-slate-200/80"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog"
          aria-label={`Filter by ${label.toLowerCase()}`}
        >
          {/* Sheet title (phones) */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 sm:hidden">
            <p className="text-base font-semibold text-slate-900">{label}</p>
            <button type="button" onClick={() => setOpen(false)} className="h-9 px-2 -mr-2 text-sm font-semibold text-clay-700">
              Done
            </button>
          </div>

          {/* Search inside dropdown */}
          {options.length > 5 && (
            <div className="px-3 pb-2 sm:p-2 sm:border-b sm:border-slate-100">
              <div className="flex items-center gap-2 px-3 h-10 rounded-lg bg-slate-100/80 sm:bg-slate-50 border border-transparent focus-within:border-clay-300">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="#94a3b8" strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="w-7 h-7 -mr-1.5 flex items-center justify-center text-slate-400 hover:text-slate-600" aria-label="Clear search">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Select all / clear row */}
          <div className="flex items-center justify-between px-5 sm:px-4 py-2 border-y sm:border-t-0 border-slate-100">
            <span className="text-xs text-slate-500">{filtered.length} option{filtered.length !== 1 ? 's' : ''}</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-semibold text-red-600 hover:text-red-700 h-7"
              >
                Clear
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto overscroll-contain py-1 sm:flex-none sm:max-h-60">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No results</p>
            ) : (
              filtered.map(({ value, count }) => {
                const checked = selected.includes(value)
                return (
                  <div
                    key={value}
                    className={`w-full flex items-center gap-2 pl-5 pr-3 sm:pl-4 sm:pr-2 transition-colors hover:bg-slate-50 ${
                      checked ? 'bg-clay-50/60' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(value)}
                      aria-pressed={checked}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left py-3 sm:py-2.5"
                    >
                      <span className={`w-[18px] h-[18px] rounded-[5px] flex-shrink-0 flex items-center justify-center border-[1.5px] transition-colors ${
                        checked ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span className={`flex-1 text-sm truncate ${checked ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>
                        {value}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">{count}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation()
                          setActionMsg('')
                          let result
                          if (fieldKey === 'category') {
                            // Find category id from options - we pass it via extra data
                            result = await deleteCategory(value)
                          } else {
                            result = await deleteFilterOption(null, fieldKey, value)
                          }
                          if (result.ok) {
                            onRefresh?.()
                          } else {
                            setActionMsg(result.message)
                          }
                        }}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={`Delete ${value}`}
                        aria-label={`Delete ${value}`}
                      >
                        <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
                          <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Action message */}
          {actionMsg && (
            <div className="px-4 py-2 border-t border-red-100 bg-red-50">
              <p className="text-xs text-red-700 font-medium">{actionMsg}</p>
            </div>
          )}

          {/* Add new option (admin only) */}
          {isAdmin && (
            <div className="border-t border-slate-100 p-3 sm:p-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newVal.trim()) {
                      setActionMsg('')
                      let result
                      if (fieldKey === 'category') {
                        const created = await createCategory(newVal.trim())
                        result = created ? { ok: true } : { ok: false, message: 'Failed to add.' }
                      } else {
                        result = await addFilterOption(fieldKey, newVal.trim())
                      }
                      if (result.ok) {
                        setNewVal('')
                        onRefresh?.()
                      } else {
                        setActionMsg(result.message)
                      }
                    }
                  }}
                  placeholder={`Add ${label.toLowerCase()}…`}
                  className="flex-1 min-w-0 text-sm h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-clay-400 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newVal.trim()) return
                    setActionMsg('')
                    let result
                    if (fieldKey === 'category') {
                      const created = await createCategory(newVal.trim())
                      result = created ? { ok: true } : { ok: false, message: 'Failed to add.' }
                    } else {
                      result = await addFilterOption(fieldKey, newVal.trim())
                    }
                    if (result.ok) {
                      setNewVal('')
                      onRefresh?.()
                    } else {
                      setActionMsg(result.message)
                    }
                  }}
                  className="h-10 px-3.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}

function FilterBar({ allTiles, filters, onChange, resultCount, totalCount, isAdmin, onRefresh }) {
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
  const clearAll    = () => onChange({ ...filters, brand: [], size: [], finish: [], category: [], grade: [], favoritesOnly: false })

  return (
    <div className="space-y-3">
      {/* ── Filter row: scrolls horizontally on phones, wraps on larger screens ── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-0.5 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        <button
          type="button"
          onClick={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
          aria-pressed={!!filters.inStockOnly}
          className={`chip ${filters.inStockOnly ? 'chip-active' : ''}`}
        >
          <span className={`w-2 h-2 rounded-full ${filters.inStockOnly ? 'bg-emerald-400' : 'bg-slate-300'}`} aria-hidden="true" />
          In stock
        </button>

        <FilterDropdown
          label="Brand"
          options={options.brand}
          selected={filters.brand}
          onChange={(v) => onChange({ ...filters, brand: v })}
          isAdmin={isAdmin}
          fieldKey="brand"
          onRefresh={onRefresh}
        />
        <FilterDropdown
          label="Category"
          options={options.category}
          selected={filters.category}
          onChange={(v) => onChange({ ...filters, category: v })}
          isAdmin={isAdmin}
          fieldKey="category"
          onRefresh={onRefresh}
        />
        <FilterDropdown
          label="Size"
          options={options.size}
          selected={filters.size}
          onChange={(v) => onChange({ ...filters, size: v })}
          isAdmin={isAdmin}
          fieldKey="size"
          onRefresh={onRefresh}
        />
        <FilterDropdown
          label="Finish"
          options={options.finish}
          selected={filters.finish}
          onChange={(v) => onChange({ ...filters, finish: v })}
          isAdmin={isAdmin}
          fieldKey="finish"
          onRefresh={onRefresh}
        />
        <FilterDropdown
          label="Grade"
          options={options.grade}
          selected={filters.grade}
          onChange={(v) => onChange({ ...filters, grade: v })}
          isAdmin={isAdmin}
          fieldKey="grade"
          onRefresh={onRefresh}
        />

          {/* Favourites toggle */}
        {showFavToggle ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
            aria-pressed={filters.favoritesOnly}
            className={`chip ${filters.favoritesOnly ? 'chip-active' : ''}`}
          >
            <svg width="13" height="13" viewBox="0 0 15 15"
              fill={filters.favoritesOnly ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden="true"
            >
              <path d="M7.5 13.5S1 9.8 1 5.25a3.75 3.75 0 0 1 6.5-2.5 3.75 3.75 0 0 1 6.5 2.5C14 9.8 7.5 13.5 7.5 13.5z"/>
            </svg>
            Favourites
          </button>
        ) : null}
      </div>

      {/* Result count + clear */}
      <div className="flex items-center justify-between gap-3 min-h-[24px]">
        <span className="text-[13px] text-slate-500 tabular-nums">
          {resultCount === totalCount ? `${totalCount} tiles` : `${resultCount} of ${totalCount} tiles`}
        </span>
        {hasAny && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[13px] font-semibold text-red-600 hover:text-red-700 whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Active filter tags ── */}
      {hasAny && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {['brand', 'size', 'finish', 'category'].flatMap((key) =>
            filters[key].map((val) => (
              <span
                key={`${key}-${val}`}
                className="inline-flex items-center gap-1.5 pl-3 pr-1 h-8 rounded-full text-xs font-medium bg-clay-50 text-clay-800 border border-clay-100"
              >
                <span className="text-clay-500 capitalize">{key}:</span>
                {val}
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, [key]: filters[key].filter((v) => v !== val) })}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-clay-100 transition-colors"
                  aria-label={`Remove ${val}`}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </span>
            ))
          )}
          {filters.favoritesOnly && (
            <span className="inline-flex items-center gap-1.5 pl-3 pr-1 h-8 rounded-full text-xs font-medium bg-clay-50 text-clay-800 border border-clay-100">
              Favourites only
              <button
                type="button"
                onClick={() => onChange({ ...filters, favoritesOnly: false })}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-clay-100 transition-colors"
                aria-label="Remove favourites filter"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
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
