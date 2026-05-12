/**
 * Count inventory rows and total stock quantity stored in a godown,
 * including the distinct products affected.
 */
export async function getGodownInventoryCount(godownId) {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('stock_quantity, product_id')
      .eq('godown_id', godownId)
    if (error) throw error
    const rows     = (data || []).length
    const stock    = (data || []).reduce((s, r) => s + (r.stock_quantity || 0), 0)
    const products = new Set((data || []).map((r) => r.product_id)).size
    return { rows, stock, products }
  } catch (error) {
    console.error('Error checking godown inventory:', error)
    return { rows: 0, stock: 0, products: 0 }
  }
}

/**
 * Get distinct brands, sizes, finishes, and units already used in products.
 * Used to power the combobox suggestions in Add Product.
 */
export async function getProductFieldOptions() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('brand, size, finish, grade, unit, package_spec')
    if (error) throw error
    const unique = (key) => [
      ...new Set(
        (data || [])
          .map((r) => r[key])
          .filter(Boolean)
      ),
    ].sort()
    return {
      brands:   unique('brand'),
      sizes:    unique('size'),
      finishes: unique('finish'),
      grades:   unique('grade'),
      units:    unique('unit'),
      packageSpecs: unique('package_spec'),
    }
  } catch (error) {
    console.error('Error fetching product field options:', error)
    return { brands: [], sizes: [], finishes: [], grades: [], units: [], packageSpecs: [] }
  }
}

/**
 * Get all categories
 */
export async function getAllCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name')
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

/**
 * Create a new category
 * Returns the created category or null on failure.
 */
export async function createCategory(name) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: name.trim() }])
      .select('*')
      .single()
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating category:', error)
    return null
  }
}

/**
 * Create a new product
 * Returns the created product or null on failure.
 */
export async function createProduct({ product_name, brand, size, finish, grade, unit, category_id, package_spec, pieces_per_box }) {
  try {
    const normalizedPiecesPerBox = Number(pieces_per_box)

    const { data, error } = await supabase
      .from('products')
      .insert([{
        product_name,
        brand,
        size,
        finish,
        grade,
        unit,
        category_id,
        package_spec,
        pieces_per_box: Number.isFinite(normalizedPiecesPerBox) && normalizedPiecesPerBox > 0
          ? Math.round(normalizedPiecesPerBox)
          : null,
      }])
      .select('*')
      .single()
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error creating product:', error)
    return null
  }
}

/**
 * Update an existing product
 * Returns true on success, false on failure.
 */
export async function updateProduct(productId, updates) {
  try {
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating product:', error)
    console.error('Update data:', updates)
    console.error('Product ID:', productId)
    return false
  }
}

/**
 * Delete a product by id
 * Returns an object with success state and blocking reason when applicable.
 */
export async function deleteProduct(productId) {
  try {
    // Fetch inventory IDs and transaction count for this product
    const [inventoryResult, transactionResult] = await Promise.all([
      supabase
        .from('inventory')
        .select('id')
        .eq('product_id', productId),
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
    ])

    if (inventoryResult.error) throw inventoryResult.error
    if (transactionResult.error) throw transactionResult.error

    const inventoryIds = (inventoryResult.data || []).map((row) => row.id)
    const transactionCount = transactionResult.count || 0

    // Detach transactions from the product (keep transactions but set product_id to null)
    if (transactionCount > 0) {
      const { error: detachError } = await supabase
        .from('transactions')
        .update({ product_id: null })
        .eq('product_id', productId)

      if (detachError) throw detachError
    }

    // Delete related stock logs and inventory
    if (inventoryIds.length > 0) {
      const { error: stockLogsError } = await supabase
        .from('stock_logs')
        .delete()
        .in('inventory_id', inventoryIds)

      if (stockLogsError) throw stockLogsError

      const { error: inventoryDeleteError } = await supabase
        .from('inventory')
        .delete()
        .eq('product_id', productId)

      if (inventoryDeleteError) throw inventoryDeleteError
    }

    // Finally, delete the product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) throw error

    return { ok: true }
  } catch (error) {
    console.error('Error deleting product:', error)
    return {
      ok: false,
      code: error.code || 'DELETE_FAILED',
      message: error.message || 'Failed to delete product. Please try again.',
    }
  }
}

/**
 * Delete a godown by id
 */
export async function deleteGodown(id) {
  try {
    const { error } = await supabase
      .from('godowns')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting godown:', error)
    return false
  }
}
/**
 * Quickly update stock quantity for a product by a delta (increment or decrement)
 * @param {string|number} productId - The product ID
 * @param {number} delta - The amount to increment or decrement
 */
export async function updateStockQuick(productId, delta) {
  try {
    // Find the first inventory entry for this product (could be improved to select specific godown/batch)
    const { data: entry, error: fetchError } = await supabase
      .from('inventory')
      .select('id, stock_quantity')
      .eq('product_id', productId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError) throw fetchError
    if (!entry) throw new Error('No inventory entry found for product')

    const newQuantity = (entry.stock_quantity || 0) + delta
    if (newQuantity < 0) throw new Error('Stock cannot be negative')

    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        stock_quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id)

    if (updateError) throw updateError

    // Log the change
    await supabase.from('stock_logs').insert({
      inventory_id: entry.id,
      change_type: delta > 0 ? 'ADD' : 'REMOVE',
      quantity: delta,
      previous_quantity: entry.stock_quantity,
      new_quantity: newQuantity,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in updateStockQuick:', error)
  }
}
import { supabase } from './supabaseClient'

const normalize = (value) => value.toLowerCase().trim()
const FAVORITES_KEY = 'tileflow_favorites'

const includesAsSubsequence = (source, target) => {
  let sourceIndex = 0
  let targetIndex = 0

  while (sourceIndex < source.length && targetIndex < target.length) {
    if (source[sourceIndex] === target[targetIndex]) {
      targetIndex += 1
    }
    sourceIndex += 1
  }

  return targetIndex === target.length
}

const getFavoriteTileIds = () => {
  const raw = localStorage.getItem(FAVORITES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const withFavoriteFlag = (products) => {
  // Use DB is_favorite if present (after migration); fall back to localStorage
  const favoriteIds = new Set(getFavoriteTileIds())
  return products.map((product) => ({
    ...product,
    is_favorite: product.is_favorite != null ? Boolean(product.is_favorite) : favoriteIds.has(product.id),
  }))
}

/**
 * Search products by name, brand, or size
 */
export async function searchTiles(query) {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return withFavoriteFlag(products?.slice(0, 20) || [])

    // Create regex to match * and × as equivalent
    const searchPattern = normalizedQuery.replace(/[*×]/g, '[*×]')

    const scored = (products || [])
      .map((product) => {
        const name = normalize(product.product_name)
        const size = normalize(product.size || '')
        const brand = normalize(product.brand || '')
        const combined = `${brand} ${name} ${size}`

        let score = 0
        
        // Use regex for size matching to handle * and × equivalently
        try {
          const sizeRegex = new RegExp(searchPattern, 'i')
          if (combined.match(sizeRegex)) score += 4
          if (name.match(sizeRegex)) score += 3
          if (size.match(sizeRegex)) score += 2
          if (brand.match(sizeRegex)) score += 2
        } catch {
          // Fallback to simple string matching if regex fails
          if (combined.includes(normalizedQuery)) score += 4
          if (name.includes(normalizedQuery)) score += 3
          if (size.includes(normalizedQuery)) score += 2
          if (brand.includes(normalizedQuery)) score += 2
        }
        
        if (includesAsSubsequence(combined, normalizedQuery)) score += 1

        return { product, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        // Favorites always first
        const favDiff = (b.product.is_favorite ? 1 : 0) - (a.product.is_favorite ? 1 : 0)
        if (favDiff !== 0) return favDiff
        return b.score - a.score || a.product.product_name.localeCompare(b.product.product_name)
      })
      .map((entry) => entry.product)

    return withFavoriteFlag(scored)
  } catch (error) {
    console.error('Error searching tiles:', error)
    return []
  }
}

/**
 * Get latest products added
 */
export async function getLatestTiles(limit = 8) {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return withFavoriteFlag(products || [])
  } catch (error) {
    console.error('Error fetching latest tiles:', error)
    return []
  }
}

/**
 * Fetch ALL products (no limit) with category name, favorites first.
 * Used for client-side search + filtering.
 */
export async function getAllTiles() {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch all inventory to compute total stock per product
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('product_id, stock_quantity')

    if (invError) throw invError

    // Aggregate stock by product_id
    const stockMap = {}
    ;(inventory || []).forEach(entry => {
      if (!stockMap[entry.product_id]) stockMap[entry.product_id] = 0
      stockMap[entry.product_id] += entry.stock_quantity
    })

    // Add totalBoxes to each product
    const productsWithStock = (products || []).map(p => ({
      ...p,
      totalBoxes: stockMap[p.id] || 0
    }))

    return withFavoriteFlag(productsWithStock)
  } catch (error) {
    console.error('Error fetching all tiles:', error)
    return []
  }
}

/**
 * Toggle is_favorite for a product in the DB and keep localStorage in sync
 */
export async function toggleFavorite(productId, isFavorite) {
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_favorite: isFavorite })
      .eq('id', productId)
    if (error) throw error
  } catch (error) {
    console.error('Error toggling favorite:', error)
  }
  // Keep localStorage in sync as a fallback
  const raw = localStorage.getItem(FAVORITES_KEY)
  let ids = []
  try { ids = JSON.parse(raw) || [] } catch { ids = [] }
  const set = new Set(ids)
  if (isFavorite) set.add(productId)
  else set.delete(productId)
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]))
}

/**
 * Get inventory for a specific product with batch and godown details
 */
export async function getTileInventory(productId) {
  try {
    // Fetch product with category
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', productId)
      .single()

    if (productError) throw productError
    if (!product) return null

    // Fetch inventory entries for this product
    const { data: inventoryEntries, error: inventoryError } = await supabase
      .from('inventory')
      .select(
        `
        id,
        product_id,
        godown_id,
        batch_number,
        location_in_godown,
        stock_quantity,
        price,
        godowns(id, name),
        created_at,
        updated_at
        `
      )
      .eq('product_id', productId)

    if (inventoryError) throw inventoryError

    const piecesPerBox = Number(product.pieces_per_box)
    const resolvedPiecesPerBox = Number.isFinite(piecesPerBox) && piecesPerBox > 0
      ? Math.round(piecesPerBox)
      : null

    // Group by batch_number
    const batchMap = {}
    ;(inventoryEntries || []).forEach((entry) => {
      if (!batchMap[entry.batch_number]) {
        batchMap[entry.batch_number] = {
          batch_code: entry.batch_number,
          godowns: [],
          total_boxes: 0,
        }
      }
      batchMap[entry.batch_number].godowns.push({
        inventory_id: entry.id,
        godown_id: entry.godown_id,
        godown_name: entry.godowns?.name || 'Unknown Godown',
        location_in_godown: entry.location_in_godown || null,
        batch_code: entry.batch_number,
        boxes: entry.stock_quantity,
        pieces_per_box: resolvedPiecesPerBox,
        total_pieces: resolvedPiecesPerBox
          ? entry.stock_quantity * resolvedPiecesPerBox
          : null,
      })
      batchMap[entry.batch_number].total_boxes += entry.stock_quantity
    })

    const batches = Object.values(batchMap).sort((a, b) =>
      a.batch_code.localeCompare(b.batch_code)
    )

    return {
      tile: {
        ...product,
        category: product.categories?.name ?? null,
        is_favorite: product.is_favorite != null
          ? Boolean(product.is_favorite)
          : getFavoriteTileIds().includes(product.id),
      },
      batches,
      totalBoxes: batches.reduce((sum, batch) => sum + batch.total_boxes, 0),
    }
  } catch (error) {
    console.error('Error fetching tile inventory:', error)
    return null
  }
}

/**
 * Add or update inventory entry
 * Returns true on success, false on failure.
 */
export async function addInventoryEntry(data) {
  try {
    const {
      tile_id: productId,
      batch_code: batchNumber,
      godown_id: godownId,
      location_in_godown: locationInGodown = null,
      boxes: stockQuantity,
      price = 0,
    } = data

    if (!productId || !batchNumber || !godownId || stockQuantity === null || stockQuantity === undefined) {
      console.error('addInventoryEntry: missing required fields', data)
      return false
    }

    // Check if entry exists — PGRST116 = "no rows found", which is expected
    const { data: existing, error: checkError } = await supabase
      .from('inventory')
      .select('id, stock_quantity')
      .eq('product_id', productId)
      .eq('godown_id', godownId)
      .eq('batch_number', batchNumber)
      .maybeSingle()

    if (checkError) throw checkError

    if (existing) {
      // Update existing
      const newQuantity = existing.stock_quantity + stockQuantity
      
      // Prevent negative stock
      if (newQuantity < 0) {
        console.error('Stock cannot be negative:', { existing: existing.stock_quantity, change: stockQuantity })
        return false
      }
      
      const updateData = {
        stock_quantity: newQuantity,
        price,
        updated_at: new Date().toISOString(),
      }
      if (locationInGodown !== undefined) {
        updateData.location_in_godown = locationInGodown
      }
      
      const { error: updateError } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', existing.id)

      if (updateError) throw updateError

      // Log the change
      await supabase.from('stock_logs').insert({
        inventory_id: existing.id,
        change_type: stockQuantity > 0 ? 'ADD' : 'REMOVE',
        quantity: Math.abs(stockQuantity),
        previous_quantity: existing.stock_quantity,
        new_quantity: newQuantity,
        created_at: new Date().toISOString(),
      })
    } else {
      // Create new
      const { data: newEntry, error: insertError } = await supabase
        .from('inventory')
        .insert({
          product_id: productId,
          godown_id: godownId,
          batch_number: batchNumber,
          location_in_godown: locationInGodown,
          stock_quantity: stockQuantity,
          price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Log the change
      await supabase.from('stock_logs').insert({
        inventory_id: newEntry.id,
        change_type: 'ADD',
        quantity: stockQuantity,
        previous_quantity: 0,
        new_quantity: stockQuantity,
        created_at: new Date().toISOString(),
      })
    }

    return true
  } catch (error) {
    console.error('Error adding inventory entry:', error)
    return false
  }
}

/**
 * Update inventory entry (boxes and pieces per box)
 */
export async function updateInventoryEntry(data) {
  try {
    const { inventory_id: inventoryId, boxes: newQuantity, location_in_godown: locationInGodown } = data

    // Get current quantity
    const { data: current, error: fetchError } = await supabase
      .from('inventory')
      .select('stock_quantity')
      .eq('id', inventoryId)
      .single()

    if (fetchError) throw fetchError

    // Update quantity
    const updateData = {
      stock_quantity: newQuantity,
      updated_at: new Date().toISOString(),
    }
    if (locationInGodown !== undefined) {
      updateData.location_in_godown = locationInGodown
    }
    
    const { error: updateError } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('id', inventoryId)

    if (updateError) throw updateError

    const delta = newQuantity - current.stock_quantity

    // Log the change
    await supabase.from('stock_logs').insert({
      inventory_id: inventoryId,
      change_type: delta >= 0 ? 'ADD' : 'REMOVE',
      quantity: Math.abs(delta),
      previous_quantity: current.stock_quantity,
      new_quantity: newQuantity,
      created_at: new Date().toISOString(),
    })

    return true
  } catch (error) {
    console.error('Error updating inventory entry:', error)
    return false
  }
}

/**
 * Create a new godown
 */
export async function createGodown(name) {
  try {
    const { error } = await supabase
      .from('godowns')
      .insert({
        name,
        address: '',
        created_at: new Date().toISOString(),
      })

    if (error) throw error
  } catch (error) {
    console.error('Error creating godown:', error)
  }
}

/**
 * Get all godowns
 */
export async function getAllGodowns() {
  try {
    const { data: godowns, error } = await supabase
      .from('godowns')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return godowns || []
  } catch (error) {
    console.error('Error fetching godowns:', error)
    return []
  }
}

/**
 * Update saved locations for a godown.
 */
export async function updateGodownLocations(godownId, locations) {
  try {
    const normalizedLocations = [...new Set((locations || [])
      .map((location) => String(location).trim())
      .filter(Boolean))]

    const { data, error } = await supabase
      .from('godowns')
      .update({ locations: normalizedLocations })
      .eq('id', godownId)
      .select('*')
      .single()

    if (error) throw error
    return { ok: true, data }
  } catch (error) {
    console.error('Error updating godown locations:', error)
    return { ok: false, error }
  }
}

/**
 * Create a new transaction (buy/sell)
 * Returns true on success, false on failure
 */
export async function createTransaction(data) {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert([data])

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error creating transaction:', error)
    return false
  }
}

/**
 * Get all transactions with product details
 */
export async function getAllTransactions() {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        products:product_id (
          product_name,
          unit,
          package_spec
        ),
        godowns:godown_id (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Flatten the nested structure
    return (data || []).map(txn => ({
      ...txn,
      product_name: txn.products?.product_name || 'Unknown Product',
      unit: txn.products?.unit || 'box',
      package_spec: txn.products?.package_spec || null,
      godown_name: txn.godowns?.name || null,
    }))
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

/**
 * Subscribe to real-time changes
 */
export function subscribeToMockDb(callback) {
  // Subscribe to changes in inventory table
  const subscription = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory',
      },
      () => {
        callback()
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'godowns',
      },
      () => {
        callback()
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
      },
      () => {
        callback()
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

/**
 * Toggle favorite status
 */
export function toggleTileFavorite(productId) {
  const favorites = new Set(getFavoriteTileIds())
  if (favorites.has(productId)) {
    favorites.delete(productId)
  } else {
    favorites.add(productId)
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)))
  return favorites.has(productId)
}
