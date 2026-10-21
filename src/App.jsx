import { useEffect, useMemo, useState } from 'react'
import AddInventoryModal from './components/AddInventoryModal'
import GodownManager from './components/GodownManager'

import SearchBar from './components/SearchBar'
import FilterBar from './components/FilterBar'
import LatestTilesGrid from './components/LatestTilesGrid'
import UpdateInventoryPage from './components/UpdateInventoryPage'
import TradesPage from './components/TradesPage'
import AnalysisPage from './components/AnalysisPage'
import AskTileTrackr from './components/AskTileTrackr'
import DeepDivePage from './components/DeepDivePage'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { LOW_STOCK_THRESHOLD, getSwatchStyle } from './utils/tileVisual'


import {
  addInventoryEntry,
  getAllGodowns,
  getAllTiles,
  toggleFavorite,
  subscribeToMockDb,
} from './services/inventoryService'

const ADMIN_SESSION_KEY = 'tileflow_admin_session'
const LOGIN_SESSION_KEY = 'tileflow_login_session'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', short: 'Home', adminOnly: false },
  { id: 'trades', label: 'Trade', short: 'Trade', adminOnly: true },
  { id: 'update', label: 'Update Inventory', short: 'Update', adminOnly: true },
  { id: 'godowns', label: 'Godowns', short: 'Godowns', adminOnly: true },
  { id: 'analysis', label: 'Analysis', short: 'Analysis', adminOnly: true },
]

const NAV_ICON_PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  trades: 'M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4',
  update: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  godowns: 'M3 21V9l9-5 9 5v12M7 21v-8h10v8M7 17h10',
  analysis: 'M3 3v18h18M8 16v-5M13 16V8M18 16v-3',
}

function NavIcon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={NAV_ICON_PATHS[name]} />
    </svg>
  )
}

function BrandMark({ size = 'md', tone = 'dark' }) {
  const box = size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-9 h-9 rounded-xl'
  const icon = size === 'lg' ? 26 : 16
  const bg = tone === 'clay' ? 'bg-clay-600' : 'bg-slate-900'
  const accent = tone === 'clay' ? '#ffffff' : '#d0774f'
  return (
    <div className={`${box} ${bg} flex items-center justify-center flex-shrink-0`}>
      <svg width={icon} height={icon} viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" fill={accent}/>
        <rect x="8.5" y="1.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.85"/>
        <rect x="1.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.85"/>
        <rect x="8.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.4"/>
      </svg>
    </div>
  )
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem(LOGIN_SESSION_KEY) === 'true'
  )
  const [sitePassword, setSitePassword] = useState('')
  const [siteLoginError, setSiteLoginError] = useState('')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)

  const [activeTab, setActiveTab] = useState('home')
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    localStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  )

  const [godowns, setGodowns] = useState([])
  const [allTiles, setAllTiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ brand: [], size: [], finish: [], category: [], grade: [], favoritesOnly: false, inStockOnly: true })

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [modalData, setModalData] = useState(null)

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginPasscode, setLoginPasscode] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    getAllGodowns().then(setGodowns)
  }, [])

  useEffect(() => {
    setLoading(true)
    getAllTiles().then((data) => {
      setAllTiles(data)
      setLoading(false)
    })
  }, [])

  // Subscribe to real-time inventory changes
  useEffect(() => {
    const unsubscribe = subscribeToMockDb(() => {
      refetchTiles()
    })
    return () => unsubscribe()
  }, [])

  const refetchTiles = async () => {
    const data = await getAllTiles()
    setAllTiles(data)
  }

  // Client-side search + filter
  const displayedTiles = useMemo(() => {
    let result = allTiles

    if (filters.inStockOnly)
      result = result.filter((t) => (t.totalBoxes || 0) > 0)
    if (filters.brand.length > 0)
      result = result.filter((t) => filters.brand.includes(t.brand))
    if (filters.size.length > 0)
      result = result.filter((t) => filters.size.includes(t.size))
    if (filters.finish.length > 0)
      result = result.filter((t) => filters.finish.includes(t.finish))
    if (filters.category.length > 0)
      result = result.filter((t) => filters.category.includes(t.categories?.name))
    if (filters.grade.length > 0)
      result = result.filter((t) => filters.grade.includes(t.grade))
    if (filters.favoritesOnly)
      result = result.filter((t) => t.is_favorite)

    const q = debouncedQuery.toLowerCase().trim()
    if (!q) return result

    // Treat *, × and x as the same size separator (sizes are stored like "800X2400")
    const normalizedQuery = q.replace(/[*×]/g, '[*×x]')

    const scored = result
      .map((t) => {
        const name     = (t.product_name || '').toLowerCase()
        const brand    = (t.brand || '').toLowerCase()
        const size     = (t.size || '').toLowerCase()
        const combined = `${brand} ${name} ${size}`
        let score = 0
        
        // Simple string matching (for non-size fields)
        if (combined.includes(q)) score += 4
        if (name.includes(q))     score += 3
        if (brand.includes(q))    score += 2
        
        // Regex matching for size field to handle * and × equivalently
        try {
          const sizeRegex = new RegExp(normalizedQuery, 'i')
          if (sizeRegex.test(size)) score += 2
        } catch {
          // Fallback to simple match if regex fails
          if (size.includes(q)) score += 2
        }
        
        if (t.is_favorite)        score += 1
        return { t, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.map((x) => x.t)
  }, [allTiles, debouncedQuery, filters])

  const stockSummary = useMemo(() => {
    let inStock = 0, low = 0, out = 0, units = 0
    allTiles.forEach((t) => {
      const b = Number(t.totalBoxes) || 0
      if (b <= 0) { out++; return }
      units += b
      inStock++
      if (b <= LOW_STOCK_THRESHOLD) low++
    })
    return { total: allTiles.length, inStock, low, out, healthy: inStock - low, units }
  }, [allTiles])

  const handleToggleFavorite = async (tileId) => {
    const tile = allTiles.find((t) => t.id === tileId)
    const newValue = !tile?.is_favorite
    setAllTiles((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, is_favorite: newValue } : t))
    )
    const ok = await toggleFavorite(tileId, newValue)
    if (!ok) {
      setAllTiles((prev) =>
        prev.map((t) => (t.id === tileId ? { ...t, is_favorite: !newValue } : t))
      )
    }
  }

  const handleQuickAdd = (inventoryData) => {
    setModalData(inventoryData)
    setIsAddModalOpen(true)
  }

  const handleSaveInventory = async (payload) => {
    const ok = await addInventoryEntry(payload)
    if (ok !== false) {
      setIsAddModalOpen(false)
      setModalData(null)
    }
    return ok
  }

  const onAdminSignOut = () => {
    localStorage.setItem(ADMIN_SESSION_KEY, 'false')
    setIsAdminLoggedIn(false)
    if (activeTab !== 'home') setActiveTab('home')
  }

  const onAdminLogin = () => {
    if (loginPasscode === import.meta.env.VITE_ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true')
      setIsAdminLoggedIn(true)
      setIsLoginModalOpen(false)
      setLoginPasscode('')
      setLoginError('')
    } else {
      setLoginError('Incorrect passcode. Try again.')
    }
  }

  const onSiteLogin = () => {
    if (sitePassword === import.meta.env.VITE_LOGIN_PASSWORD) {
      localStorage.setItem(LOGIN_SESSION_KEY, 'true')
      setIsLoggedIn(true)
      setSitePassword('')
      setSiteLoginError('')
    } else {
      setSiteLoginError('Incorrect password. Try again.')
    }
  }

  const onSiteLogout = () => {
    localStorage.removeItem(LOGIN_SESSION_KEY)
    localStorage.removeItem(ADMIN_SESSION_KEY)
    setIsLoggedIn(false)
    setIsAdminLoggedIn(false)
  }

  // ── Login Screen ──
  if (!isLoggedIn) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 lg:grid lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel (desktop) */}
        <div className="hidden lg:flex relative flex-col justify-between p-12 bg-slate-950 text-white overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.55]"
            style={getSwatchStyle({ product_name: 'Statuario marble', size: '600x1200', finish: 'glossy' })}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/30" aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <BrandMark tone="clay" />
            <span className="text-lg font-semibold tracking-tight">TileTrackr</span>
          </div>
          <div className="relative max-w-md">
            <h2 className="text-4xl font-semibold tracking-tight leading-[1.1]">Every box, batch and godown — in one place.</h2>
            <p className="mt-4 text-[15px] text-slate-300 leading-relaxed">Check stock in seconds, record trades on the go and keep your godowns organised.</p>
          </div>
        </div>

        <div className="min-h-[100dvh] flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left mb-8">
              <div className="lg:hidden"><BrandMark size="lg" /></div>
              <h1 className="mt-5 lg:mt-0 text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight">Welcome back</h1>
              <p className="text-sm text-slate-500 mt-1">Enter your password to continue</p>
            </div>

            <div className="card p-5 sm:p-6 space-y-4 lg:shadow-apple-sm">
            <div>
              <label htmlFor="site-password" className="label">Password</label>
              <input
                id="site-password"
                type="password"
                value={sitePassword}
                onChange={(e) => { setSitePassword(e.target.value); setSiteLoginError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') onSiteLogin() }}
                placeholder="Enter password"
                className="input-modern py-3"
                autoComplete="current-password"
                autoFocus
              />
              {siteLoginError && (
                <p className="mt-2 text-[13px] text-red-600 font-medium" role="alert">{siteLoginError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onSiteLogin}
              className="btn-primary w-full py-3"
            >
              Sign In
            </button>
          </div>
          </div>
        </div>
      </div>
    )
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdminLoggedIn)
  const isTabActive = (id) => activeTab === id || (id === 'analysis' && activeTab === 'deepdive')
  const closeAdminLogin = () => { setIsLoginModalOpen(false); setLoginPasscode(''); setLoginError('') }
  const pct = (n) => (stockSummary.total ? (n / stockSummary.total) * 100 : 0)

  return (
    <div className="min-h-[100dvh] bg-slate-50">

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[260px] flex-col bg-slate-950 text-slate-400">
        <div className="h-20 px-6 flex items-center gap-3">
          <BrandMark tone="clay" />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-white tracking-tight leading-tight">TileTrackr</p>
            <p className="text-xs text-slate-500">Inventory</p>
          </div>
        </div>

        <nav className="flex-1 px-3 pt-2 space-y-1 overflow-y-auto" aria-label="Primary">
          {visibleNav.map((item) => {
            const active = isTabActive(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.04] hover:text-slate-100'
                }`}
              >
                {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-clay-400" aria-hidden="true" />}
                <span className={active ? 'text-clay-300' : ''}><NavIcon name={item.id} /></span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="p-3 space-y-2 border-t border-white/[0.06]">
          <AskTileTrackr allTiles={allTiles} godowns={godowns} variant="sidebar" />
          {isAdminLoggedIn ? (
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
              <div className="w-9 h-9 rounded-full bg-clay-600 text-white text-sm font-semibold flex items-center justify-center">A</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-tight">Admin</p>
                <p className="text-xs text-slate-500">Full access</p>
              </div>
              <button
                type="button"
                onClick={onAdminSignOut}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setLoginError(''); setIsLoginModalOpen(true) }}
              className="w-full h-11 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              Admin login
            </button>
          )}
        </div>
      </aside>

      {/* ── Top bar (phones & tablets) ── */}
      <header
        className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/70"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">

          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark />
            <span className="font-semibold text-[17px] text-slate-900 tracking-tight truncate">TileTrackr</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <AskTileTrackr allTiles={allTiles} godowns={godowns} />
            {isAdminLoggedIn ? (
              <button
                type="button"
                onClick={onAdminSignOut}
                className="h-9 px-3 rounded-xl text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setLoginError(''); setIsLoginModalOpen(true) }}
                className="btn-primary h-9 py-0 px-4 whitespace-nowrap"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Bottom tab bar (phones & tablets) ── */}
      {isAdminLoggedIn && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-200/80"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Primary"
        >
          <div className="grid grid-cols-5 max-w-xl mx-auto">
            {visibleNav.map((item) => {
              const active = isTabActive(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium transition-colors ${
                    active ? 'text-clay-600' : 'text-slate-500 active:text-slate-800'
                  }`}
                >
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-clay-500" aria-hidden="true" />}
                  <NavIcon name={item.id} />
                  {item.short}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* ── Page Content ── */}
      <div className="lg:pl-[260px]">
      <main className={`w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 lg:pt-10 ${isAdminLoggedIn ? 'pb-28 lg:pb-14' : 'pb-12 lg:pb-14'}`}>

        {activeTab === 'home' && (
          <div className="space-y-4 sm:space-y-6">

            {/* Page header */}
            <div className="min-w-0">
              <h1 className="page-title truncate">
                {debouncedQuery ? `"${debouncedQuery}"` : 'Inventory'}
              </h1>
              <p className="page-subtitle">Browse and manage your tile collection</p>
            </div>

            {/* Stock summary */}
            {!loading && stockSummary.total > 0 && (
              <section className="card overflow-hidden" aria-label="Stock summary">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
                  {[
                    { label: 'Products', value: stockSummary.total, sub: `${Math.round(stockSummary.units).toLocaleString('en-IN')} units on hand`, dot: 'bg-slate-900' },
                    { label: 'In stock', value: stockSummary.inStock, sub: `${Math.round(pct(stockSummary.inStock))}% of catalogue`, dot: 'bg-emerald-500' },
                    { label: 'Low stock', value: stockSummary.low, sub: `${LOW_STOCK_THRESHOLD} or fewer left`, dot: 'bg-amber-500' },
                    { label: 'Out of stock', value: stockSummary.out, sub: 'Need restocking', dot: 'bg-slate-300' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white px-4 py-3 sm:py-4 lg:px-6 lg:py-5">
                      <p className="flex items-center gap-2 text-[13px] text-slate-500">
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
                        {s.label}
                      </p>
                      <p className="mt-1 sm:mt-1.5 text-[22px] sm:text-[26px] lg:text-[32px] leading-none font-semibold tracking-tight tabular-nums text-slate-900">
                        {s.value.toLocaleString('en-IN')}
                      </p>
                      <p className="hidden sm:block mt-1.5 text-xs text-slate-500 truncate">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 lg:px-6 py-2.5 sm:py-3 border-t border-slate-100">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100" role="img" aria-label="Stock health distribution">
                    <div className="bg-emerald-500 transition-[width] duration-700" style={{ width: `${pct(stockSummary.healthy)}%` }} />
                    <div className="bg-amber-400 transition-[width] duration-700" style={{ width: `${pct(stockSummary.low)}%` }} />
                    <div className="bg-slate-300 transition-[width] duration-700" style={{ width: `${pct(stockSummary.out)}%` }} />
                  </div>
                </div>
              </section>
            )}

            {/* Search + filters toolbar */}
            <div className="space-y-3 lg:space-y-0 lg:flex lg:items-start lg:gap-4">
              <div className="lg:w-[380px] flex-shrink-0">
                <SearchBar query={query} onChange={setQuery} />
              </div>
              <div className="flex-1 min-w-0 lg:pt-1.5">
                <FilterBar
                  allTiles={allTiles}
                  filters={filters}
                  onChange={setFilters}
                  resultCount={displayedTiles.length}
                  totalCount={allTiles.length}
                  isAdmin={isAdminLoggedIn}
                  onRefresh={refetchTiles}
                />
              </div>
            </div>

            {/* Tiles grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4" aria-busy="true" aria-label="Loading tiles">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="card overflow-hidden animate-pulse">
                    <div className="h-24 sm:h-28 bg-slate-100" />
                    <div className="p-3.5 space-y-2.5">
                      <div className="h-3 w-1/3 rounded bg-slate-200" />
                      <div className="h-4 w-3/4 rounded bg-slate-200" />
                      <div className="h-4 w-2/5 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <LatestTilesGrid
                tiles={displayedTiles}
                onToggleFavorite={handleToggleFavorite}
                isAdminLoggedIn={isAdminLoggedIn}
                onQuickAdd={handleQuickAdd}
                onDataChange={refetchTiles}
              />
            )}
          </div>
        )}

        {activeTab === 'update' && isAdminLoggedIn && (
          <UpdateInventoryPage
            onQuickAdd={handleQuickAdd}
            onDataChange={refetchTiles}
          />
        )}

        {activeTab === 'godowns' && isAdminLoggedIn && (
          <GodownManager
            godowns={godowns}
            onGodownAdded={() => getAllGodowns().then(setGodowns)}
            onGodownDeleted={() => getAllGodowns().then(setGodowns)}
            onGodownUpdated={() => getAllGodowns().then(setGodowns)}
          />
        )}


        {activeTab === 'trades' && isAdminLoggedIn && (
          <TradesPage onTransactionCreated={refetchTiles} />
        )}

        {activeTab === 'analysis' && isAdminLoggedIn && (
          <AnalysisPage onOpenDeepDive={() => setActiveTab('deepdive')} />
        )}

        {activeTab === 'deepdive' && isAdminLoggedIn && (
          <DeepDivePage onBack={() => setActiveTab('analysis')} />
        )}
      </main>
      </div>

      {/* ── Admin Login Modal ── */}
      {isLoginModalOpen && (
        <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
          <div className="modal-backdrop" onClick={closeAdminLogin} />
          <div className="modal-panel sm:max-w-sm">
            <div className="p-5 sm:p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="admin-login-title" className="text-lg font-semibold text-slate-900 tracking-tight">Admin Login</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Enter your passcode to continue.</p>
                </div>
                <button
                  type="button"
                  onClick={closeAdminLogin}
                  className="icon-btn -mr-2 -mt-1"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Passcode input */}
              <div>
                <label htmlFor="admin-passcode" className="label">Passcode</label>
                <input
                  id="admin-passcode"
                  type="password"
                  value={loginPasscode}
                  onChange={(e) => { setLoginPasscode(e.target.value); setLoginError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAdminLogin() }}
                  placeholder="Enter passcode"
                  className="input-modern py-3"
                  autoComplete="current-password"
                  autoFocus
                />
                {loginError && (
                  <p className="mt-2 text-[13px] text-red-600 font-medium" role="alert">{loginError}</p>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeAdminLogin}
                  className="btn-secondary py-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onAdminLogin}
                  className="btn-primary py-3"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Stock Modal ── */}
      {isAddModalOpen && modalData && (
        <AddInventoryModal
          tile={modalData.tile}
          batches={modalData.batches ?? []}
          godowns={godowns}
          onClose={() => { setIsAddModalOpen(false); setModalData(null) }}
          onSave={handleSaveInventory}
        />
      )}
    </div>
  )
}

export default App