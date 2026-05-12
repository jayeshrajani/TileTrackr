import { useEffect, useMemo, useState } from 'react'
import AddInventoryModal from './components/AddInventoryModal'
import GodownManager from './components/GodownManager'
import SearchBar from './components/SearchBar'
import FilterBar from './components/FilterBar'
import LatestTilesGrid from './components/LatestTilesGrid'
import UpdateInventoryPage from './components/UpdateInventoryPage'
import TradesPage from './components/TradesPage'
import { useDebouncedValue } from './hooks/useDebouncedValue'


import {
  addInventoryEntry,
  getAllGodowns,
  getAllTiles,
  toggleFavorite,
  subscribeToMockDb,
} from './services/inventoryService'

const ADMIN_SESSION_KEY = 'tileflow_admin_session'
const LOGIN_SESSION_KEY = 'tileflow_login_session'

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

    // Normalize search query: treat * and × as equivalent
    const normalizedQuery = q.replace(/[*×]/g, '[*×]')

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

  const handleToggleFavorite = (tileId) => {
    const tile = allTiles.find((t) => t.id === tileId)
    const newValue = !tile?.is_favorite
    setAllTiles((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, is_favorite: newValue } : t))
    )
    toggleFavorite(tileId, newValue)
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
    if (activeTab === 'update') setActiveTab('home')
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-apple-sm mb-4">
              <svg width="28" height="28" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" fill="white"/>
                <rect x="8.5" y="1.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.7"/>
                <rect x="1.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.7"/>
                <rect x="8.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.4"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">TileTrackr</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your password to continue</p>
          </div>

          {/* Login Card */}
          <div className="card p-6 space-y-5">
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={sitePassword}
                onChange={(e) => { setSitePassword(e.target.value); setSiteLoginError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') onSiteLogin() }}
                placeholder="Enter password"
                className="input-modern"
                autoFocus
              />
              {siteLoginError && (
                <p className="mt-2 text-xs text-red-500 font-medium">{siteLoginError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onSiteLogin}
              className="btn-primary w-full justify-center py-3"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-slate-100/80">
        <div className="w-full mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-apple-sm flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" fill="white"/>
                <rect x="8.5" y="1.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.7"/>
                <rect x="1.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.7"/>
                <rect x="8.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.4"/>
              </svg>
            </div>
            <span className="font-bold text-[15px] sm:text-base text-slate-900 tracking-tight hidden xs:inline">TileTrackr</span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center p-1 bg-slate-100/80 rounded-xl gap-0.5">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'home'
                  ? 'bg-white text-slate-900 shadow-apple-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Home
            </button>
            {isAdminLoggedIn && (
              <button
                onClick={() => setActiveTab('trades')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  activeTab === 'trades'
                    ? 'bg-white text-slate-900 shadow-apple-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Trade
              </button>
            )}
            {isAdminLoggedIn && (
              <button
                onClick={() => setActiveTab('update')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  activeTab === 'update'
                    ? 'bg-white text-slate-900 shadow-apple-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Update Inventory
              </button>
            )}
            {isAdminLoggedIn && (
              <button
                onClick={() => setActiveTab('godowns')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  activeTab === 'godowns'
                    ? 'bg-white text-slate-900 shadow-apple-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Godowns
              </button>
            )}
          </nav>

          {/* Admin area */}
          {isAdminLoggedIn ? (
            <button
              onClick={onAdminSignOut}
              className="text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 flex-shrink-0 whitespace-nowrap"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => { setLoginError(''); setIsLoginModalOpen(true) }}
              className="btn-primary flex-shrink-0 py-2 px-4 sm:px-5 text-xs sm:text-sm whitespace-nowrap"
            >
              Admin
            </button>
          )}
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8 sm:py-10 max-w-7xl">

        {activeTab === 'home' && (
          <div className="space-y-6">

            {/* Page header */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {debouncedQuery ? `"${debouncedQuery}"` : 'Inventory'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">Browse and manage your tile collection</p>
            </div>

            {/* Search */}
            <SearchBar query={query} onChange={setQuery} />

            {/* Filter bar */}
            <FilterBar
              allTiles={allTiles}
              filters={filters}
              onChange={setFilters}
              resultCount={displayedTiles.length}
              totalCount={allTiles.length}
            />

            {/* In Stock Toggle */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setFilters(f => ({ ...f, inStockOnly: !f.inStockOnly }))}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  filters.inStockOnly
                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 shadow-apple-xs'
                    : 'bg-slate-100 text-slate-500 border-2 border-transparent hover:bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                  filters.inStockOnly ? 'bg-emerald-500' : 'bg-slate-300'
                }`}>
                  {filters.inStockOnly && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l2.5 2.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                In Stock
              </button>
            </div>

            {/* Tiles grid */}
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-[2.5px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Loading tiles...</p>
                </div>
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
      </main>

      {/* ── Admin Login Modal ── */}
      {isLoginModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => { setIsLoginModalOpen(false); setLoginPasscode(''); setLoginError('') }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-apple-modal p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Admin Login</h2>
                <p className="text-sm text-slate-500 mt-1">Enter your passcode to continue.</p>
              </div>
              <button
                onClick={() => { setIsLoginModalOpen(false); setLoginPasscode(''); setLoginError('') }}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Passcode input */}
            <div>
              <label className="label">Passcode</label>
              <input
                type="password"
                value={loginPasscode}
                onChange={(e) => { setLoginPasscode(e.target.value); setLoginError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') onAdminLogin() }}
                placeholder="Enter passcode"
                className="input-modern"
                autoFocus
              />
              {loginError && (
                <p className="mt-2 text-xs text-red-500 font-medium">{loginError}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setIsLoginModalOpen(false); setLoginPasscode(''); setLoginError('') }}
                className="btn-secondary flex-1 justify-center py-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onAdminLogin}
                className="btn-primary flex-1 justify-center py-3"
              >
                Sign In
              </button>
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