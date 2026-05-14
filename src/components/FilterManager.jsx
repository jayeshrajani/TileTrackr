import { useEffect, useState } from 'react'
import {
  getAllCategories,
  createCategory,
  deleteCategory,
  getFilterOptions,
  addFilterOption,
  deleteFilterOption,
} from '../services/inventoryService'

const FIELD_TABS = [
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'size', label: 'Size' },
  { key: 'finish', label: 'Finish' },
  { key: 'grade', label: 'Grade' },
]

function FilterManager() {
  const [activeField, setActiveField] = useState('category')
  const [categories, setCategories] = useState([])
  const [filterOptions, setFilterOptions] = useState({ brands: [], sizes: [], finishes: [], grades: [] })
  const [newValue, setNewValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchData = async () => {
    setLoading(true)
    const [cats, opts] = await Promise.all([getAllCategories(), getFilterOptions()])
    setCategories(cats)
    setFilterOptions(opts)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const clearMessages = () => { setError(''); setSuccess('') }

  const getItems = () => {
    if (activeField === 'category') return categories.map((c) => ({ id: c.id, value: c.name }))
    const key = activeField + 's' // brand -> brands
    return (filterOptions[key] || []).map((o) => ({ id: o.id, value: o.value }))
  }

  const handleAdd = async () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    clearMessages()

    // Duplicate check
    const items = getItems()
    if (items.some((i) => i.value.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists.`)
      return
    }

    setActionLoading(true)
    if (activeField === 'category') {
      const created = await createCategory(trimmed)
      if (created) {
        setSuccess(`Category "${trimmed}" added.`)
        setNewValue('')
        await fetchData()
      } else {
        setError('Failed to add category.')
      }
    } else {
      const result = await addFilterOption(activeField, trimmed)
      if (result.ok) {
        setSuccess(`${activeField} "${trimmed}" added.`)
        setNewValue('')
        await fetchData()
      } else {
        setError(result.message)
      }
    }
    setActionLoading(false)
  }

  const handleDelete = async (item) => {
    clearMessages()
    setActionLoading(true)

    if (activeField === 'category') {
      const result = await deleteCategory(item.id)
      if (result.ok) {
        setSuccess(`Category "${item.value}" deleted.`)
        await fetchData()
      } else {
        setError(result.message)
      }
    } else {
      const result = await deleteFilterOption(item.id, activeField, item.value)
      if (result.ok) {
        setSuccess(`${activeField} "${item.value}" deleted.`)
        await fetchData()
      } else {
        setError(result.message)
      }
    }
    setActionLoading(false)
  }

  const items = getItems()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Manage Filters</h2>
        <p className="text-sm text-slate-500 mt-1">Add or remove filter options. Deletion is blocked if stock exists.</p>
      </div>

      {/* Field tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl overflow-x-auto">
        {FIELD_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveField(key); clearMessages() }}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeField === key
                ? 'bg-white text-slate-900 shadow-apple-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Add new value */}
      <div className="card p-4 sm:p-5">
        <label className="label">Add new {activeField}</label>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={newValue}
            onChange={(e) => { setNewValue(e.target.value); clearMessages() }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder={`Enter ${activeField} name…`}
            className="input-modern flex-1"
            disabled={actionLoading}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={actionLoading || !newValue.trim()}
            className="btn-primary px-5 py-2.5 flex-shrink-0"
          >
            {actionLoading ? '…' : 'Add'}
          </button>
        </div>

        {/* Messages */}
        {error && <p className="mt-2 text-xs text-red-500 font-medium">{error}</p>}
        {success && <p className="mt-2 text-xs text-emerald-600 font-medium">{success}</p>}
      </div>

      {/* Current values list */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-700">
            {FIELD_TABS.find((t) => t.key === activeField)?.label} options
            <span className="ml-2 text-xs text-slate-400 font-normal">({items.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No {activeField} options yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                <span className="text-sm text-slate-700 font-medium">{item.value}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={actionLoading}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default FilterManager
