import { useEffect, useMemo, useState } from 'react'
import AddInventoryModal from './components/AddInventoryModal'
import GodownManager from './components/GodownManager'
import SearchBar from './components/SearchBar'
import FilterBar from './components/FilterBar'
import LatestTilesGrid from './components/LatestTilesGrid'
import UpdateInventoryPage from './components/UpdateInventoryPage'
import { useDebouncedValue } from './hooks/useDebouncedValue'


import {
  addInventoryEntry,
  getAllGodowns,
  getAllTiles,
  toggleFavorite,
} from './services/inventoryService'

const ADMIN_SESSION_KEY = 'tileflow_admin_session'

function App() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)

  const [activeTab, setActiveTab] = useState('home')
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    localStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  )

  const [godowns, setGodowns] = useState([])
  const [allTiles, setAllTiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ brand: [], size: [], finish: [], category: [], favoritesOnly: false })

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

  // Client-side search + filter
  const displayedTiles = useMemo(() => {
    let result = allTiles

    if (filters.brand.length > 0)
      result = result.filter((t) => filters.brand.includes(t.brand))
    if (filters.size.length > 0)
      result = result.filter((t) => filters.size.includes(t.size))
    if (filters.finish.length > 0)
      result = result.filter((t) => filters.finish.includes(t.finish))
    if (filters.category.length > 0)
      result = result.filter((t) => filters.category.includes(t.categories?.name))
    if (filters.favoritesOnly)
      result = result.filter((t) => t.is_favorite)

    const q = debouncedQuery.toLowerCase().trim()
    if (!q) return result

    const scored = result
      .map((t) => {
        const name     = (t.product_name || '').toLowerCase()
        const brand    = (t.brand || '').toLowerCase()
        const size     = (t.size || '').toLowerCase()
        const combined = `${brand} ${name} ${size}`
        let score = 0
        if (combined.includes(q)) score += 4
        if (name.includes(q))     score += 3
        if (size.includes(q))     score += 2
        if (brand.includes(q))    score += 2
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

  return (
    <div className="min-h-screen bg-apple-gray">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-apple-gray-2">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 bg-apple-blue rounded-[8px] flex items-center justify-center shadow-apple-xs">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" fill="white"/>
                <rect x="8.5" y="1.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.7"/>
                <rect x="1.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.7"/>
                <rect x="8.5" y="8.5" width="5" height="5" rx="1.2" fill="white" fillOpacity="0.4"/>
              </svg>
            </div>
            <span className="font-semibold text-[15px] text-apple-text-1 tracking-tight">TileTrackr</span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === 'home'
                  ? 'bg-apple-gray-2 text-apple-text-1'
                  : 'text-apple-text-2 hover:text-apple-text-1 hover:bg-apple-gray'
              }`}
            >
              Home
            </button>
            {isAdminLoggedIn && (
              <button
                onClick={() => setActiveTab('update')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === 'update'
                    ? 'bg-apple-gray-2 text-apple-text-1'
                    : 'text-apple-text-2 hover:text-apple-text-1 hover:bg-apple-gray'
                }`}
              >
                Update Inventory
              </button>
            )}
            {isAdminLoggedIn && (
              <button
                onClick={() => setActiveTab('godowns')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === 'godowns'
                    ? 'bg-apple-gray-2 text-apple-text-1'
                    : 'text-apple-text-2 hover:text-apple-text-1 hover:bg-apple-gray'
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
              className="text-sm font-medium px-4 py-1.5 rounded-full text-apple-red hover:bg-red-50 transition-all duration-200 flex-shrink-0"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => { setLoginError(''); setIsLoginModalOpen(true) }}
              className="btn-primary flex-shrink-0 py-1.5 px-4 text-sm"
            >
              Admin Login
            </button>
          )}
        </div>
      </header>

      {/* ── Page Content ── */}
      <main className="max-w-5xl mx-auto px-6 py-10">

        {activeTab === 'home' && (
          <div className="space-y-4">

            {/* Page header */}
            <div>
              
              <h1 className="text-[28px] font-bold tracking-tight text-apple-text-1">
                {debouncedQuery ? `"${debouncedQuery}"` : 'Home'}
              </h1>
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

            {/* Tiles grid */}
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-[2.5px] border-apple-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <LatestTilesGrid
                tiles={displayedTiles}
                onToggleFavorite={handleToggleFavorite}
                isAdminLoggedIn={isAdminLoggedIn}
                onQuickAdd={handleQuickAdd}
              />
            )}
          </div>
        )}

        {activeTab === 'update' && isAdminLoggedIn && (
          <UpdateInventoryPage
            onQuickAdd={handleQuickAdd}
          />
        )}

        {activeTab === 'godowns' && isAdminLoggedIn && (
          <GodownManager
            godowns={godowns}
            onGodownAdded={() => getAllGodowns().then(setGodowns)}
            onGodownDeleted={() => getAllGodowns().then(setGodowns)}
          />
        )}
      </main>

      {/* ── Admin Login Modal ── */}
      {isLoginModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => { setIsLoginModalOpen(false); setLoginPasscode(''); setLoginError('') }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-apple-modal p-7 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-apple-text-1 tracking-tight">Admin Login</h2>
                <p className="text-sm text-apple-text-2 mt-0.5">Enter your passcode to continue.</p>
              </div>
              <button
                onClick={() => { setIsLoginModalOpen(false); setLoginPasscode(''); setLoginError('') }}
                className="w-7 h-7 rounded-full bg-apple-gray flex items-center justify-center hover:bg-apple-gray-2 transition-colors flex-shrink-0 -mt-0.5"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round"/>
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
                <p className="mt-2 text-xs text-apple-red font-medium">{loginError}</p>
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