// Visual helpers: derive a tile "swatch" from product name/finish/size so cards have a real preview.

const PALETTE = [
  { re: /(statuario|calacatta|carrara|marble|onyx|marmo)/, base: '#efedea', vein: true },
  { re: /(black|nero|charcoal|graphite|anthracite|dark)/, base: '#3a3c40' },
  { re: /(wood|walnut|oak|teak|timber|plank|deck)/, base: '#a47a54', grain: true },
  { re: /(brown|coffee|choco|mocha|rustic)/, base: '#8d6a50' },
  { re: /(beige|sand|crema|cream|marfil|botticino|bottochino|ivory|almond|camel)/, base: '#e4d6c0' },
  { re: /(grey|gray|silver|cement|concrete|ash|smoke|stone|slate)/, base: '#c5c8cc' },
  { re: /(blue|aqua|sky|ocean|navy|teal)/, base: '#8eafc9' },
  { re: /(green|sage|olive|jade|mint)/, base: '#a3b79c' },
  { re: /(red|terracotta|rust|brick|cotto)/, base: '#c07454' },
  { re: /(gold|yellow|honey|amber)/, base: '#d8b56c' },
  { re: /(white|snow|bianco|blanco|pearl)/, base: '#f2f1ee' },
]

const FALLBACK = ['#e7e2da', '#d9d6d0', '#cfd3d6', '#e3dccf', '#d6d2c9', '#dcd8d2']

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

function cellSize(size) {
  const m = String(size || '').match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i)
  const base = 30
  if (!m) return { w: base, h: base }
  const a = Number(m[1])
  const b = Number(m[2])
  if (!a || !b) return { w: base, h: base }
  const cap = (v) => Math.min(Math.round(v), 96)
  return a >= b ? { w: cap((base * a) / b), h: base } : { w: base, h: cap((base * b) / a) }
}

export function getSwatchStyle(tile = {}) {
  const text = `${tile.product_name || tile.name || ''} ${tile.finish || ''} ${tile.categories?.name || tile.category || ''}`.toLowerCase()
  const match = PALETTE.find((p) => p.re.test(text))
  const base = match ? match.base : FALLBACK[hash(text) % FALLBACK.length]
  const glossy = /(gloss|polish|shine|glaze|lappato)/.test(String(tile.finish || '').toLowerCase())
  const { w, h } = cellSize(tile.size)
  const grout = isLight(base) ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.14)'

  const layers = []
  const sizes = []
  layers.push(glossy
    ? 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0.05) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.06) 100%)')
  sizes.push('100% 100%')
  if (match?.vein) {
    layers.push('repeating-linear-gradient(118deg, transparent 0 22px, rgba(100,100,110,0.12) 22px 23px, transparent 23px 51px)')
    sizes.push('100% 100%')
  }
  if (match?.grain) {
    layers.push('repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 6px, rgba(255,255,255,0.07) 6px 7px, transparent 7px 13px)')
    sizes.push('100% 100%')
  }
  layers.push(`linear-gradient(to right, ${grout} 1.5px, transparent 1.5px)`)
  sizes.push(`${w}px ${h}px`)
  layers.push(`linear-gradient(to bottom, ${grout} 1.5px, transparent 1.5px)`)
  sizes.push(`${w}px ${h}px`)

  return { backgroundColor: base, backgroundImage: layers.join(','), backgroundSize: sizes.join(',') }
}

export const LOW_STOCK_THRESHOLD = 10

export function getStockStatus(boxes) {
  const n = Number(boxes) || 0
  if (n <= 0) return { key: 'out', label: 'Out of stock', dot: 'bg-slate-300', text: 'text-slate-400' }
  if (n <= LOW_STOCK_THRESHOLD) return { key: 'low', label: 'Low stock', dot: 'bg-amber-500', text: 'text-amber-700' }
  return { key: 'ok', label: 'In stock', dot: 'bg-emerald-500', text: 'text-emerald-700' }
}
