import { supabase } from './supabaseClient'

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
 * Count inventory rows in a specific location within a godown.
 */
export async function getLocationInventoryCount(godownId, locationName) {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('id')
      .eq('godown_id', godownId)
      .eq('location_in_godown', locationName)
    if (error) throw error
    return { count: (data || []).length }
  } catch (error) {
    console.error('Error checking location inventory:', error)
    return { count: 0 }
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
      .select('brand, size, finish, grade, unit')
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
    }
  } catch (error) {
    console.error('Error fetching product field options:', error)
    return { brands: [], sizes: [], finishes: [], grades: [], units: [] }
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
 * Delete a category by name or id.
 */
export async function deleteCategory(nameOrId) {
  try {
    // Check if any products still use this category
    let countQuery = supabase.from('products').select('id', { count: 'exact', head: true })
    if (typeof nameOrId === 'string' && nameOrId.length === 36 && nameOrId.includes('-')) {
      countQuery = countQuery.eq('category_id', nameOrId)
    } else {
      // Look up the category id by name first
      const { data: cat } = await supabase.from('categories').select('id').eq('name', nameOrId).single()
      if (cat) countQuery = countQuery.eq('category_id', cat.id)
    }
    const { count } = await countQuery
    if (count && count > 0) {
      return { ok: false, message: `Cannot delete — ${count} product${count > 1 ? 's' : ''} still use this category.` }
    }

    // Safe to delete
    let query = supabase.from('categories').delete()
    if (typeof nameOrId === 'string' && nameOrId.length === 36 && nameOrId.includes('-')) {
      query = query.eq('id', nameOrId)
    } else {
      query = query.eq('name', nameOrId)
    }
    const { error } = await query
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { ok: false, message: error.message || 'Failed to delete category.' }
  }
}

/**
 * Get all filter options (brand, size, finish, grade) from the filter_options table.
 * Returns { brands: [{id, value}], sizes: [...], finishes: [...], grades: [...] }
 */
export async function getFilterOptions() {
  try {
    const { data, error } = await supabase
      .from('filter_options')
      .select('id, field, value')
      .order('value')
    if (error) throw error
    const grouped = { brands: [], sizes: [], finishes: [], grades: [] }
    for (const row of (data || [])) {
      const key = row.field + 's' // brand -> brands, size -> sizes, etc.
      if (grouped[key]) grouped[key].push({ id: row.id, value: row.value })
    }
    return grouped
  } catch (error) {
    console.error('Error fetching filter options:', error)
    return { brands: [], sizes: [], finishes: [], grades: [] }
  }
}

/**
 * Add a new filter option (brand/size/finish/grade).
 */
export async function addFilterOption(field, value) {
  try {
    const { error } = await supabase
      .from('filter_options')
      .insert([{ field, value: value.trim() }])
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.error('Error adding filter option:', error)
    return { ok: false, message: error.message || 'Failed to add option.' }
  }
}

/**
 * Delete a filter option by id, or by field+value if id is null.
 * Blocks deletion if any products use that value.
 */
export async function deleteFilterOption(id, field, value) {
  try {
    // Check if any products use this filter value
    // field maps to the column name on products table (brand, size, finish, grade)
    const columnMap = { brand: 'brand', size: 'size', finish: 'finish', grade: 'grade' }
    const column = columnMap[field]
    if (column && value) {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .ilike(column, value)
      if (count && count > 0) {
        return { ok: false, message: `Cannot delete — ${count} product${count > 1 ? 's' : ''} still use this ${field}.` }
      }
    }

    let query = supabase.from('filter_options').delete()
    if (id) {
      query = query.eq('id', id)
    } else {
      query = query.eq('field', field).eq('value', value)
    }
    const { error } = await query
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.error('Error deleting filter option:', error)
    return { ok: false, message: error.message || 'Failed to delete option.' }
  }
}

/**
 * Create a new product
 * Returns the created product or null on failure.
 */
export async function createProduct({ product_name, brand, size, finish, grade, unit, category_id, package_spec }) {
  try {
    const row = { product_name, package_spec: package_spec || '1' }
    if (brand && brand.trim()) row.brand = brand.trim()
    if (size && size.trim()) row.size = size.trim()
    if (finish && finish.trim()) row.finish = finish.trim()
    if (grade && grade.trim()) row.grade = grade.trim()
    if (unit && unit.trim()) row.unit = unit.trim()
    // Only include category_id if it looks like a valid UUID
    if (category_id && category_id.length === 36 && category_id.includes('-')) {
      row.category_id = category_id
    }

    console.log('Creating product with row:', JSON.stringify(row))

    const { data, error } = await supabase
      .from('products')
      .insert([row])
      .select()
    if (error) throw error
    return data?.[0] || null
  } catch (error) {
    console.error('Error creating product:', error?.message || error?.details || error)
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
    return false
  }
}

/**
 * Delete a product by id
 * Returns an object with success state and blocking reason when applicable.
 */
export async function deleteProduct(productId) {
  try {
    const [productResult, inventoryResult, transactionResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, product_name, unit')
        .eq('id', productId)
        .single(),
      supabase
        .from('inventory')
        .select('id')
        .eq('product_id', productId),
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId),
    ])

    if (productResult.error) throw productResult.error
    if (inventoryResult.error) throw inventoryResult.error
    if (transactionResult.error) throw transactionResult.error

    const product = productResult.data
    const inventoryIds = (inventoryResult.data || []).map((row) => row.id)
    const inventoryCount = inventoryIds.length
    const transactionCount = transactionResult.count || 0

    if (transactionCount > 0) {
      const { error: snapshotError } = await supabase
        .from('transactions')
        .update({
          product_name_snapshot: product.product_name || 'Deleted Product',
          product_unit_snapshot: product.unit || 'box',
        })
        .eq('product_id', productId)

      if (snapshotError) throw snapshotError

      const { error: detachError } = await supabase
        .from('transactions')
        .update({ product_id: null })
        .eq('product_id', productId)

      if (detachError) {
        return {
          ok: false,
          code: detachError.code || 'TRANSACTION_DETACH_FAILED',
          message: 'Transactions can be kept only after the database allows product_id to be nullable and stores product snapshots on the transaction row.',
        }
      }
    }

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
      message: 'Failed to delete product. Please try again.',
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

    // Fetch inventory totals per product
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('product_id, stock_quantity')

    if (invError) throw invError

    // Sum stock per product
    const stockMap = {}
    for (const row of (inventory || [])) {
      stockMap[row.product_id] = (stockMap[row.product_id] || 0) + (row.stock_quantity || 0)
    }

    // Attach totalBoxes to each product
    const enriched = (products || []).map((p) => ({
      ...p,
      totalBoxes: stockMap[p.id] || 0,
    }))

    return withFavoriteFlag(enriched)
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
        pieces_per_box: 1, // Default, you may want to add this to DB
        total_pieces: entry.stock_quantity,
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

    if (!productId || !batchNumber || !godownId || !stockQuantity) {
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
 * Record a goods return from customer.
 * Creates a return_in transaction linked to the original sell, and adds stock back.
 * Condition and reason are stored in the notes field.
 */
export async function createGoodsReturn({ originalTxn, quantity, condition, reason, godown_id, batch_code, location_in_godown }) {
  try {
    const noteParts = [
      `GOODS RETURN from customer${originalTxn.party_name ? ` (${originalTxn.party_name})` : ''}`,
      `Original sale: ${originalTxn.quantity} ${originalTxn.unit || 'boxes'} on ${new Date(originalTxn.created_at).toLocaleDateString()}`,
      `Condition: ${condition || 'good'}`,
      reason ? `Reason: ${reason}` : null,
    ].filter(Boolean).join('. ')

    const returnData = {
      product_id: originalTxn.product_id,
      transaction_type: 'return_in',
      quantity,
      unit_price: originalTxn.unit_price || null,
      total_price: originalTxn.unit_price ? (quantity * originalTxn.unit_price) : null,
      party_name: originalTxn.party_name || null,
      godown_id: godown_id || originalTxn.godown_id || null,
      batch_code: batch_code || originalTxn.batch_code || null,
      location_in_godown: location_in_godown || originalTxn.location_in_godown || null,
      linked_transaction_id: originalTxn.id,
      notes: noteParts,
    }

    const { error } = await supabase
      .from('transactions')
      .insert([returnData])
    if (error) throw error

    // Add stock back
    await addInventoryEntry({
      tile_id: originalTxn.product_id,
      godown_id: godown_id || originalTxn.godown_id,
      batch_code: batch_code || originalTxn.batch_code || 'RETURN',
      location_in_godown: location_in_godown || originalTxn.location_in_godown || null,
      boxes: quantity,
      price: originalTxn.unit_price || 0,
    })

    return true
  } catch (error) {
    console.error('Error creating goods return:', error?.message || error)
    return false
  }
}

/**
 * Reverse a transaction: marks it as reversed and adjusts inventory back.
 * Buy reversal => subtract stock; Sell reversal => add stock back.
 */
export async function reverseTransaction(txn) {
  try {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ is_reversed: true })
      .eq('id', txn.id)
    if (updateError) throw updateError

    // Reverse the inventory change
    const delta = txn.transaction_type === 'buy'
      ? -(txn.quantity || 0)
      : (txn.quantity || 0)

    if (txn.godown_id && txn.batch_code) {
      await addInventoryEntry({
        tile_id: txn.product_id,
        godown_id: txn.godown_id,
        batch_code: txn.batch_code,
        location_in_godown: txn.location_in_godown || null,
        boxes: delta,
        price: txn.unit_price || 0,
      })
    }

    return true
  } catch (error) {
    console.error('Error reversing transaction:', error)
    return false
  }
}

/**
 * Permanently delete a transaction from the database.
 */
export async function deleteTransaction(txnId) {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', txnId)
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting transaction:', error)
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
          unit
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
      product_name: txn.products?.product_name || txn.product_name_snapshot || 'Unknown Product',
      unit: txn.products?.unit || txn.product_unit_snapshot || 'box',
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
