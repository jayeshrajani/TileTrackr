// Mock DB removed - using Supabase instead
// This file is kept for backwards compatibility but all data operations are now in Supabase
export const getDb = () => ({ tiles: [], batches: [], godowns: [], inventory: [] })
export const updateDb = () => {}
export const subscribeDb = () => () => {}
export const resetDb = () => {}
