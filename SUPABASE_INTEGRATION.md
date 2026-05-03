# Supabase Integration Guide

## Overview
TileTrackr has been successfully integrated with Supabase, removing all mock data and using a production-ready PostgreSQL database.

## Database Schema

### Tables

#### 1. **categories**
Stores product categories (can be extended).
- `id` (uuid, primary key)
- `name` (text, unique)
- `created_at` (timestamp)

#### 2. **products**
Stores product/tile details (no stock stored here).
- `id` (uuid, primary key)
- `product_name` (text)
- `category_id` (uuid, foreign key → categories.id)
- `brand` (text)
- `size` (text)
- `unit` (text)
- `finish` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### 3. **godowns**
Stores warehouse/storage locations.
- `id` (uuid, primary key)
- `name` (text, unique)
- `address` (text)
- `created_at` (timestamp)

#### 4. **inventory** (MAIN TABLE)
Stores actual stock quantities. Each row = one product in one godown in one batch.
- `id` (uuid, primary key)
- `product_id` (uuid, fk → products.id)
- `godown_id` (uuid, fk → godowns.id)
- `batch_number` (text)
- `stock_quantity` (integer)
- `price` (numeric)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Unique Constraint**: `unique(product_id, godown_id, batch_number)`

#### 5. **stock_logs**
Tracks all stock changes for audit trails.
- `id` (uuid)
- `inventory_id` (uuid, fk → inventory.id)
- `change_type` (enum: "ADD", "REMOVE", "SET")
- `quantity` (integer)
- `previous_quantity` (integer)
- `new_quantity` (integer)
- `created_at` (timestamp)

## Relationships
```
categories (1) ─────→ (many) products
                           ↓
                        inventory ─→ stock_logs
                           ↑
                      godowns (1)
```

## API Endpoints

### Services File: `src/services/inventoryService.js`

**Async Functions:**

1. **searchTiles(query)** 
   - Returns: Promise<Product[]>
   - Searches products by name, brand, or size

2. **getLatestTiles(limit = 8)**
   - Returns: Promise<Product[]>
   - Gets latest products by creation date

3. **getTileInventory(productId)**
   - Returns: Promise<{tile, batches, totalBoxes}>
   - Fetches product details with grouped inventory by batch and godown

4. **addInventoryEntry(data)**
   - Params: `{tile_id, batch_code, godown_id, boxes, price}`
   - Creates or updates inventory entry, logs the change

5. **updateInventoryEntry(data)**
   - Params: `{inventory_id, boxes}`
   - Updates stock quantity, creates log entry

6. **createGodown(name)**
   - Creates a new godown/warehouse

7. **getAllGodowns()**
   - Returns: Promise<Godown[]>
   - Gets all godowns sorted by name

8. **toggleTileFavorite(productId)**
   - Stores favorite state in localStorage
   - Returns: boolean (new favorite state)

9. **subscribeToMockDb(callback)**
   - Sets up real-time subscriptions to inventory, godowns, and products tables
   - Returns: unsubscribe function

## Configuration

### Supabase Client: `src/services/supabaseClient.js`

```javascript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxswvnbzcodvzfqxtbaq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

## Key Features

### ✅ Stock Management
- Add new inventory entries with batch tracking
- Update stock quantities per godown
- Track stock changes with audit logs

### ✅ Real-Time Updates
- Subscribes to Supabase changes
- Auto-refreshes UI when data changes
- Multi-table subscriptions (inventory, godowns, products)

### ✅ Search & Filtering
- Full-text search across product name, brand, size
- Relevance-based ranking
- Latest additions fetching

### ✅ Batch Management
- Group inventory by batch_number
- Prevent duplicate entries with unique constraint
- Support for new and existing batches

### ✅ Favorites
- Local storage-based favorites
- Flag sync across app states

### ✅ Error Handling
- Try-catch error handling on all async calls
- User-friendly error messages
- Graceful fallbacks to empty states

## Component Updates

All components now handle async operations:

1. **App.jsx** - Manages state for async data fetching
2. **LatestTilesGrid.jsx** - Displays products with async support
3. **SearchResults.jsx** - Shows search results
4. **TileInventoryCard.jsx** - Displays inventory with async edit
5. **GodownManager.jsx** - Manages godowns with async creation
6. **AddInventoryModal.jsx** - Modal form with async submission

## Development Notes

### Before Running:
```bash
npm install @supabase/supabase-js
npm run dev
```

### Supabase Project:
- URL: https://gxswvnbzcodvzfqxtbaq.supabase.co
- Tables must be created with the schema above
- Row-Level Security (RLS) can be enabled as needed

### Testing:
1. Add products via Supabase dashboard
2. Create godowns in the app
3. Add inventory entries
4. Search and view stock details
5. Monitor real-time updates

## Important Rules

✅ **Never store stock in products** — Use inventory table
✅ **Always use batch_number** — For batch tracking
✅ **Unique constraint** — Prevents duplicate inventory entries
✅ **Stock logs** — Automatically created on all changes
✅ **Real-time synced** — All clients see updates instantly

## Migration Path

All mock data files are cleared but retained for backwards compatibility:
- `src/mock/mockDb.js` - Now empty stubs
- `src/mock/initialData.js` - Now empty

The app is 100% dependent on Supabase for all data operations.
