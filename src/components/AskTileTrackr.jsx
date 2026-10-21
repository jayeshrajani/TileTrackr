import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Utilities ───
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
const words = (s) => normalize(s).split(/\s+/).filter(Boolean)

// ─── Fuzzy match helper (improved) ───
function fuzzyScore(text, query) {
  const t = normalize(text)
  const q = normalize(query)
  if (!q) return 0
  if (t === q) return 1
  if (t.includes(q)) return 0.95

  // Check if all query words appear in text
  const qWords = words(query)
  const allWordsPresent = qWords.every((w) => t.includes(w))
  if (allWordsPresent) return 0.9

  // Token overlap score
  const tWords = new Set(words(text))
  const matchedWords = qWords.filter((w) => [...tWords].some((tw) => tw.includes(w) || w.includes(tw)))
  const wordScore = matchedWords.length / qWords.length
  if (wordScore >= 0.7) return 0.6 + wordScore * 0.25

  // Character sequence match
  let qi = 0, matched = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { matched++; qi++ }
  }
  return matched / q.length * 0.7
}

function bestFuzzy(items, query, key, threshold = 0.5) {
  if (!query || query.length < 2) return []
  return items
    .map((item) => ({ item, score: fuzzyScore(typeof key === 'function' ? key(item) : (item[key] || ''), query) }))
    .filter((x) => x.score > threshold)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
}

// ─── Keyword sets for flexible matching ───
const KEYWORDS = {
  greeting: ['hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'good morning', 'good evening', 'good afternoon', 'hola', 'namaste', 'whats up', 'wassup', 'greetings'],
  thanks: ['thanks', 'thank you', 'thankyou', 'thx', 'ty', 'appreciated', 'great', 'awesome', 'perfect', 'nice one', 'cool'],
  help: ['help', 'what can you do', 'what do you do', 'commands', 'menu', 'options', 'guide', 'how to use', 'what are your features', 'how does this work', 'instructions', 'capabilities'],
  stock: ['stock', 'inventory', 'quantity', 'qty', 'how many', 'how much', 'do we have', 'do you have', 'available', 'boxes', 'left', 'remaining', 'in hand', 'on hand', 'balance', 'current stock', 'kitna', 'kitne', 'kितना'],
  brands: ['brands', 'brand', 'which brands', 'all brands', 'list brands', 'show brands', 'brand list', 'what brands', 'manufacturers', 'makers', 'companies'],
  sizes: ['sizes', 'size', 'which sizes', 'all sizes', 'list sizes', 'show sizes', 'dimensions', 'what sizes', 'measurements', 'formats'],
  finishes: ['finishes', 'finish', 'all finishes', 'list finishes', 'show finishes', 'surface', 'texture', 'what finishes', 'finish types', 'glossy', 'matt', 'matte'],
  grades: ['grades', 'grade', 'all grades', 'list grades', 'show grades', 'quality', 'what grades', 'grade types'],
  low_stock: ['low stock', 'running low', 'less stock', 'almost out', 'reorder', 'restock', 'need to order', 'about to finish', 'running out', 'critical stock', 'low inventory', 'below minimum', 'shortage', 'scarce', 'finishing soon', 'kam stock', 'khatam hone wala'],
  total: ['how many tiles', 'total tiles', 'total products', 'how many products', 'count', 'total count', 'total inventory', 'inventory count', 'product count', 'how big is inventory', 'kitne products', 'total items', 'number of products', 'stats', 'summary', 'overview', 'dashboard'],
  favorites: ['favorite', 'favourites', 'favorites', 'starred', 'bookmarked', 'saved', 'my tiles', 'pinned', 'liked'],
  out_of_stock: ['out of stock', 'no stock', 'zero stock', 'finished', 'sold out', 'empty', 'not available', 'unavailable', 'nil stock', 'khatam', 'nothing left', 'all gone', 'depleted'],
  categories: ['category', 'categories', 'types', 'tile types', 'product types', 'what types', 'classification'],
  godowns: ['godown', 'godowns', 'warehouse', 'warehouses', 'storage', 'location', 'locations', 'where stored', 'where is', 'stored where', 'which godown', 'storage location', 'go down'],
  top_stock: ['most stock', 'highest stock', 'top stock', 'maximum stock', 'best selling', 'most available', 'plenty', 'abundant', 'highest quantity', 'top products'],
  recent: ['recent', 'latest', 'last added', 'new arrivals', 'newly added', 'just added', 'latest tiles', 'new tiles', 'recent products'],
  specific_brand: null, // dynamic
  specific_size: null, // dynamic
}

// ─── Intent detection (massively improved) ───
function detectIntent(msg, allTiles, godowns) {
  const m = normalize(msg)
  const w = words(msg)
  const original = msg.trim()

  // Empty
  if (!m) return { intent: 'unknown' }

  // Greetings
  if (KEYWORDS.greeting.some((g) => m === g || m.startsWith(g + ' ') || m === g + '!')) return { intent: 'greeting' }

  // Thanks
  if (KEYWORDS.thanks.some((t) => m.includes(t))) return { intent: 'thanks' }

  // Help
  if (KEYWORDS.help.some((h) => m.includes(h) || m === h)) return { intent: 'help' }

  // Out of stock (check before stock_check to avoid false positive)
  if (KEYWORDS.out_of_stock.some((k) => m.includes(k))) return { intent: 'out_of_stock' }

  // Low stock
  if (KEYWORDS.low_stock.some((k) => m.includes(k))) return { intent: 'low_stock' }

  // Top stock
  if (KEYWORDS.top_stock.some((k) => m.includes(k))) return { intent: 'top_stock' }

  // Total / summary
  if (KEYWORDS.total.some((k) => m.includes(k))) return { intent: 'total_count' }

  // Favorites
  if (KEYWORDS.favorites.some((k) => m.includes(k))) return { intent: 'favorites' }

  // Recent
  if (KEYWORDS.recent.some((k) => m.includes(k))) return { intent: 'recent' }

  // Categories
  if (KEYWORDS.categories.some((k) => m.includes(k))) return { intent: 'categories' }

  // Godowns - also check "where is [product]"
  if (/where (?:is|are|do we keep|can i find|stored)\s+(.+)/.test(m)) {
    return { intent: 'where_is', query: RegExp.$1.trim() }
  }
  if (KEYWORDS.godowns.some((k) => m.includes(k))) {
    // Check if asking about specific godown stock
    const godownNames = (godowns || []).map((g) => normalize(g.name))
    const matchedGodown = godowns?.find((g) => m.includes(normalize(g.name)))
    if (matchedGodown) return { intent: 'godown_stock', godown: matchedGodown }
    return { intent: 'godowns' }
  }

  // Brands
  if (KEYWORDS.brands.some((k) => m.includes(k))) return { intent: 'list_brands' }

  // Sizes
  if (KEYWORDS.sizes.some((k) => m.includes(k))) return { intent: 'list_sizes' }

  // Finishes
  if (KEYWORDS.finishes.some((k) => m.includes(k))) return { intent: 'list_finishes' }

  // Grades
  if (KEYWORDS.grades.some((k) => m.includes(k))) return { intent: 'list_grades' }

  // Stock check patterns (very flexible)
  // "stock of X", "X stock", "how many X", "X available?", "check X", "X kitna hai"
  const stockPatterns = [
    /(?:stock|inventory|qty|quantity|boxes|available|balance|remaining)\s+(?:of|for|in|on)?\s*(.+)/,
    /(.+?)\s+(?:stock|inventory|qty|quantity|boxes|available|balance|remaining|left|hai|h|he|hain|kitna|kitne)\s*\??$/,
    /(?:how many|how much|kitne|kitna|kितना)\s+(.+?)(?:\s+(?:do we have|are there|left|available|hai|h|he))?\s*\??$/,
    /(?:do we have|is there|check|find|show me|tell me about|what about|details of|info on|information on)\s+(.+)/,
    /(?:whats|what is|what's)\s+(?:the\s+)?(?:stock|qty|quantity|inventory)\s+(?:of|for)\s+(.+)/,
  ]
  for (const pattern of stockPatterns) {
    if (pattern.test(m)) {
      const query = RegExp.$1.trim().replace(/\?$/, '').trim()
      if (query.length > 1) return { intent: 'stock_check', query }
    }
  }

  // Specific brand query: "show me [brand] tiles", "[brand] products"
  if (allTiles.length > 0) {
    const allBrands = [...new Set(allTiles.map((t) => t.brand).filter(Boolean))]
    const matchedBrand = allBrands.find((b) => m.includes(normalize(b)))
    if (matchedBrand && w.length <= 4) return { intent: 'brand_products', query: matchedBrand }

    // Specific size query
    const allSizes = [...new Set(allTiles.map((t) => t.size).filter(Boolean))]
    const matchedSize = allSizes.find((s) => m.includes(normalize(s)))
    if (matchedSize && w.length <= 4) return { intent: 'size_products', query: matchedSize }
  }

  // Comparison: "compare X and Y", "X vs Y"
  const compareMatch = m.match(/(?:compare|vs|versus|difference between)\s+(.+?)\s+(?:and|vs|versus|&|with)\s+(.+)/)
  if (compareMatch) return { intent: 'compare', query1: compareMatch[1].trim(), query2: compareMatch[2].trim() }

  // Search as fallback — anything longer than 2 chars
  if (m.length > 2) return { intent: 'search', query: original }

  return { intent: 'unknown' }
}

// ─── Response generator (with varied, natural responses) ───
function generateResponse(intent, allTiles, godowns) {
  switch (intent.intent) {
    case 'greeting':
      return pick([
        "Hey! 👋 I'm your TileTrackr assistant. Ask me about stock, brands, sizes, or search for any tile.",
        "Hello! 👋 What can I help you with? I know everything about your tile inventory.",
        "Hi there! Ready to help. Ask me anything — stock levels, brands, low stock alerts, or just search a tile name.",
        "Hey! 👋 Need to check stock? Find a tile? See what's running low? I'm here for it all.",
      ])

    case 'thanks':
      return pick([
        "Happy to help! Let me know if you need anything else. 👍",
        "Anytime! Just ask if you need more info.",
        "You're welcome! I'm here whenever you need me.",
        "No problem! Ask away if there's anything else. 😊",
      ])

    case 'help':
      return `Here's what I can help you with:\n\n• **Stock check** — "stock of marble white" or "how many glossy 600x600"\n• **Brands** — "show brands" or "list all brands"\n• **Sizes** — "what sizes do we have"\n• **Finishes** — "list finishes"\n• **Low stock** — "what's running low" or "need to reorder"\n• **Out of stock** — "what's sold out"\n• **Top stock** — "most stocked items"\n• **Favorites** — "my starred tiles"\n• **Godowns** — "show godowns" or "where is [tile]"\n• **Categories** — "show categories"\n• **Summary** — "overview" or "total products"\n• **Compare** — "compare X and Y"\n• **Search** — just type any tile/brand name!\n\nTip: You can ask naturally — "do we have glossy marble?" works just as well!`

    case 'stock_check': {
      const matches = bestFuzzy(allTiles, intent.query, (t) => `${t.brand || ''} ${t.product_name || ''} ${t.size || ''} ${t.finish || ''}`)
      if (matches.length === 0) {
        return pick([
          `Couldn't find anything matching "${intent.query}". Try a different name, brand, or size.`,
          `No tiles found for "${intent.query}". Maybe check the spelling or try a partial name?`,
          `Hmm, nothing matches "${intent.query}". You can also try just the brand or size.`,
        ])
      }
      if (matches.length === 1) {
        const t = matches[0]
        const boxes = t.totalBoxes || 0
        const status = boxes === 0 ? '🔴 Out of stock' : boxes <= 5 ? '🟡 Very low' : boxes <= 10 ? '🟠 Low' : '🟢 In stock'
        let resp = `**${t.brand || ''} ${t.product_name}**${t.size ? ` (${t.size})` : ''}\n`
        resp += `Stock: **${boxes} boxes** ${status}`
        if (t.finish) resp += `\nFinish: ${t.finish}`
        if (t.grade) resp += `\nGrade: ${t.grade}`
        return resp
      }
      const top = matches.slice(0, 6)
      return pick([`Found **${matches.length}** matching tiles:`, `Here's what I found (${matches.length} results):`]) + '\n' +
        top.map((t) => `• **${t.brand || ''} ${t.product_name}**${t.size ? ` (${t.size})` : ''} — ${t.totalBoxes || 0} boxes`).join('\n') +
        (matches.length > 6 ? `\n\n_...and ${matches.length - 6} more. Try a more specific search._` : '')
    }

    case 'list_brands': {
      const brands = [...new Set(allTiles.map((t) => t.brand).filter(Boolean))].sort()
      if (brands.length === 0) return 'No brands found in inventory yet.'
      return pick([`**${brands.length} brands** in your inventory:`, `Here are all **${brands.length} brands**:`]) + '\n' +
        brands.map((b) => `• ${b}`).join('\n') +
        `\n\n_Tip: Type a brand name to see its products._`
    }

    case 'list_sizes': {
      const sizes = [...new Set(allTiles.map((t) => t.size).filter(Boolean))].sort()
      if (sizes.length === 0) return 'No sizes recorded yet.'
      return `**${sizes.length} sizes** available:\n` + sizes.map((s) => `• ${s}`).join('\n')
    }

    case 'list_finishes': {
      const finishes = [...new Set(allTiles.map((t) => t.finish).filter(Boolean))].sort()
      if (finishes.length === 0) return 'No finishes recorded yet.'
      return `**${finishes.length} finishes** in inventory:\n` + finishes.map((f) => `• ${f}`).join('\n')
    }

    case 'list_grades': {
      const grades = [...new Set(allTiles.map((t) => t.grade).filter(Boolean))].sort()
      if (grades.length === 0) return 'No grades recorded yet.'
      return `**${grades.length} grades** in inventory:\n` + grades.map((g) => `• ${g}`).join('\n')
    }

    case 'low_stock': {
      const low = allTiles.filter((t) => (t.totalBoxes || 0) > 0 && (t.totalBoxes || 0) <= 10).sort((a, b) => a.totalBoxes - b.totalBoxes)
      if (low.length === 0) return pick(['All tiles are well-stocked right now! 🎉', 'Nothing is running low — inventory looks healthy. ✅'])
      const top = low.slice(0, 8)
      return pick([`⚠️ **${low.length} tiles** running low (≤10 boxes):`, `These need attention — **${low.length} low-stock items**:`]) + '\n' +
        top.map((t) => `• ${t.brand || ''} ${t.product_name} — **${t.totalBoxes} boxes** ${t.totalBoxes <= 3 ? '🔴' : '🟡'}`).join('\n') +
        (low.length > 8 ? `\n\n_...and ${low.length - 8} more._` : '')
    }

    case 'top_stock': {
      const sorted = [...allTiles].filter((t) => (t.totalBoxes || 0) > 0).sort((a, b) => (b.totalBoxes || 0) - (a.totalBoxes || 0))
      if (sorted.length === 0) return 'No stock data available.'
      const top = sorted.slice(0, 8)
      return `**Top stocked tiles:**\n` +
        top.map((t, i) => `${i + 1}. **${t.brand || ''} ${t.product_name}** — ${t.totalBoxes} boxes`).join('\n')
    }

    case 'total_count': {
      const inStock = allTiles.filter((t) => (t.totalBoxes || 0) > 0).length
      const totalBoxes = allTiles.reduce((s, t) => s + (t.totalBoxes || 0), 0)
      const oos = allTiles.length - inStock
      return `📊 **Inventory Overview**\n\nTotal products: **${allTiles.length}**\nIn stock: **${inStock}** ✅\nOut of stock: **${oos}** ${oos > 0 ? '⚠️' : ''}\nTotal boxes across all: **${totalBoxes.toLocaleString()}**`
    }

    case 'favorites': {
      const favs = allTiles.filter((t) => t.is_favorite)
      if (favs.length === 0) return pick(["No favorites yet. Star tiles from the inventory to track them here.", "You haven't starred any tiles yet. Use the ★ icon to add favorites."])
      return `⭐ **${favs.length} favorite tiles:**\n` + favs.slice(0, 10).map((t) => `• **${t.brand || ''} ${t.product_name}** — ${t.totalBoxes || 0} boxes`).join('\n')
    }

    case 'out_of_stock': {
      const oos = allTiles.filter((t) => (t.totalBoxes || 0) === 0)
      if (oos.length === 0) return pick(['Everything is in stock! 🎉', 'Great news — nothing is out of stock right now. ✅'])
      const top = oos.slice(0, 8)
      return `🔴 **${oos.length} tiles** out of stock:\n` +
        top.map((t) => `• ${t.brand || ''} ${t.product_name}${t.size ? ` (${t.size})` : ''}`).join('\n') +
        (oos.length > 8 ? `\n\n_...and ${oos.length - 8} more._` : '')
    }

    case 'categories': {
      const cats = [...new Set(allTiles.map((t) => t.categories?.name).filter(Boolean))].sort()
      if (cats.length === 0) return 'No categories set up yet.'
      return `**${cats.length} categories:**\n` + cats.map((c) => `• ${c}`).join('\n')
    }

    case 'godowns': {
      if (!godowns || godowns.length === 0) return 'No godowns/warehouses configured yet.'
      return `🏭 **${godowns.length} godowns:**\n` + godowns.map((g) => {
        const locs = g.locations?.length ? ` (${g.locations.length} locations)` : ''
        return `• **${g.name}**${locs}`
      }).join('\n')
    }

    case 'godown_stock': {
      const godown = intent.godown
      const inGodown = allTiles.filter((t) =>
        t.inventory?.some((inv) => inv.godown_id === godown.id && Number(inv.boxes) > 0)
      )
      if (inGodown.length === 0) return `No stock currently stored in **${godown.name}**.`
      const top = inGodown.slice(0, 8)
      return `📦 **${inGodown.length} products** in **${godown.name}**:\n` +
        top.map((t) => `• ${t.brand || ''} ${t.product_name} — ${t.totalBoxes || 0} boxes`).join('\n') +
        (inGodown.length > 8 ? `\n\n_...and ${inGodown.length - 8} more._` : '')
    }

    case 'where_is': {
      const matches = bestFuzzy(allTiles, intent.query, (t) => `${t.brand || ''} ${t.product_name || ''} ${t.size || ''}`)
      if (matches.length === 0) return `Couldn't find "${intent.query}" in inventory.`
      const t = matches[0]
      const locations = (t.inventory || []).filter((inv) => Number(inv.boxes) > 0)
      if (locations.length === 0) return `**${t.product_name}** is currently out of stock — no active locations.`
      return `📍 **${t.brand || ''} ${t.product_name}** is stored in:\n` +
        locations.map((inv) => `• ${inv.godown_name || 'Unknown godown'}${inv.location_in_godown ? ` → ${inv.location_in_godown}` : ''} — ${inv.boxes} boxes`).join('\n')
    }

    case 'brand_products': {
      const brandTiles = allTiles.filter((t) => normalize(t.brand || '') === normalize(intent.query))
      if (brandTiles.length === 0) return `No products found for brand "${intent.query}".`
      const inStock = brandTiles.filter((t) => (t.totalBoxes || 0) > 0).length
      const top = brandTiles.slice(0, 8)
      return `**${intent.query}** — ${brandTiles.length} products (${inStock} in stock):\n` +
        top.map((t) => `• ${t.product_name}${t.size ? ` (${t.size})` : ''} — ${t.totalBoxes || 0} boxes`).join('\n') +
        (brandTiles.length > 8 ? `\n\n_...and ${brandTiles.length - 8} more._` : '')
    }

    case 'size_products': {
      const sizeTiles = allTiles.filter((t) => normalize(t.size || '') === normalize(intent.query))
      if (sizeTiles.length === 0) return `No products found in size "${intent.query}".`
      const top = sizeTiles.slice(0, 8)
      return `**Size ${intent.query}** — ${sizeTiles.length} products:\n` +
        top.map((t) => `• ${t.brand || ''} ${t.product_name} — ${t.totalBoxes || 0} boxes`).join('\n') +
        (sizeTiles.length > 8 ? `\n\n_...and ${sizeTiles.length - 8} more._` : '')
    }

    case 'compare': {
      const match1 = bestFuzzy(allTiles, intent.query1, (t) => `${t.brand || ''} ${t.product_name || ''} ${t.size || ''}`)
      const match2 = bestFuzzy(allTiles, intent.query2, (t) => `${t.brand || ''} ${t.product_name || ''} ${t.size || ''}`)
      if (match1.length === 0 || match2.length === 0) return `Couldn't find both tiles to compare. Make sure both names are correct.`
      const t1 = match1[0], t2 = match2[0]
      return `**Comparison:**\n\n` +
        `| | **${t1.product_name}** | **${t2.product_name}** |\n` +
        `|---|---|---|\n` +
        `| Brand | ${t1.brand || '—'} | ${t2.brand || '—'} |\n` +
        `| Size | ${t1.size || '—'} | ${t2.size || '—'} |\n` +
        `| Finish | ${t1.finish || '—'} | ${t2.finish || '—'} |\n` +
        `| Stock | ${t1.totalBoxes || 0} boxes | ${t2.totalBoxes || 0} boxes |`
    }

    case 'recent': {
      const sorted = [...allTiles].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      const top = sorted.slice(0, 6)
      if (top.length === 0) return 'No products in inventory yet.'
      return `🆕 **Recently added:**\n` +
        top.map((t) => `• **${t.brand || ''} ${t.product_name}**${t.size ? ` (${t.size})` : ''} — ${t.totalBoxes || 0} boxes`).join('\n')
    }

    case 'search': {
      const matches = bestFuzzy(allTiles, intent.query, (t) => `${t.brand || ''} ${t.product_name || ''} ${t.size || ''} ${t.finish || ''} ${t.grade || ''}`)
      if (matches.length === 0) {
        return pick([
          `No results for "${intent.query}". Try a brand name, product name, or size. Type **help** for all options.`,
          `Hmm, can't find "${intent.query}". Maybe try a shorter keyword or check spelling?`,
          `Nothing matches "${intent.query}". You can ask "brands" to see all brands, or try a different term.`,
        ])
      }
      const top = matches.slice(0, 6)
      return `Found **${matches.length}** result${matches.length > 1 ? 's' : ''}:\n` +
        top.map((t) => `• **${t.brand || ''} ${t.product_name}**${t.size ? ` (${t.size})` : ''} — ${t.totalBoxes || 0} boxes`).join('\n') +
        (matches.length > 6 ? `\n\n_...and ${matches.length - 6} more._` : '')
    }

    default:
      return pick([
        "I didn't quite get that. Try asking about stock, brands, or just type a tile name. Type **help** for all options.",
        "Not sure what you mean — but I can help with stock checks, brand lists, low-stock alerts, and more. Type **help** to see everything.",
        "Hmm, I couldn't understand that. Try something like \"stock of marble white\" or \"show brands\". Type **help** for the full list.",
      ])
  }
}

// ─── Simple markdown renderer ───
function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    // Bold
    const parts = line.split(/\*\*(.+?)\*\*/g)
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
    )
    return <div key={i} className={line.startsWith('•') ? 'pl-2' : ''}>{rendered}</div>
  })
}

// ─── Component ───
export default function AskTileTrackr({ allTiles = [], godowns = [], variant = 'header' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm **Ask TileTrackr** — your inventory assistant. Ask me about stock, brands, or search for any tile!" }
  ])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const handleSend = () => {
    const msg = input.trim()
    if (!msg) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: msg }])

    // Process with small delay for natural feel
    setTimeout(() => {
      const intent = detectIntent(msg, allTiles, godowns)
      const response = generateResponse(intent, allTiles, godowns)
      setMessages((prev) => [...prev, { role: 'bot', text: response }])
    }, 150)
  }

  return (
    <>
      {/* Trigger */}
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={`w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium transition-colors ${
            isOpen ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Ask TileTrackr
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Ask TileTrackr"
        className={`inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-xl text-sm font-medium transition-colors ${
          isOpen
            ? 'bg-clay-50 text-clay-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="hidden sm:inline">Ask</span>
      </button>
      )}

      {/* Rendered in body so the header's backdrop-filter doesn't trap position:fixed */}
      {isOpen && createPortal(
        <>
          <div className="modal-backdrop fixed z-50 sm:hidden" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="Ask TileTrackr"
            className={`fixed z-50 inset-x-0 bottom-0 h-[85dvh] rounded-t-3xl sm:inset-x-auto sm:h-[560px] sm:max-h-[75vh] sm:w-[380px] sm:rounded-2xl bg-white shadow-apple-modal sm:border sm:border-slate-200/80 flex flex-col overflow-hidden [animation:sheetUp_.32s_cubic-bezier(.32,.72,0,1)] sm:[animation:popIn_.18s_ease-out] ${
              variant === 'sidebar' ? 'sm:bottom-4 sm:left-[272px]' : 'sm:bottom-auto sm:top-[76px] sm:right-4'
            }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pl-5 pr-3 py-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[15px] text-slate-900 leading-tight">Ask TileTrackr</p>
                  <p className="text-xs text-slate-500">Inventory assistant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="icon-btn"
                aria-label="Close assistant"
              >
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 min-h-0" aria-live="polite">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  }`}>
                    {msg.role === 'bot' ? renderMarkdown(msg.text) : msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2 bg-slate-100 rounded-full pl-4 pr-1.5 h-12 border border-transparent focus-within:bg-white focus-within:border-clay-400 focus-within:ring-4 focus-within:ring-clay-500/10 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  enterKeyHint="send"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                  placeholder="Ask about stock, brands..."
                  aria-label="Message"
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder-slate-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-white disabled:opacity-30 hover:bg-slate-800 transition-colors flex-shrink-0"
                  aria-label="Send"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
