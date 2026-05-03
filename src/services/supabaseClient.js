import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxswvnbzcodvzfqxtbaq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4c3d2bmJ6Y29kdnpmcXh0YmFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjkxOTIsImV4cCI6MjA5MzAwNTE5Mn0.oRfwGeLGnujMynT3cUomGUVgpTP4-bzRn_4fHbUCMBQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
