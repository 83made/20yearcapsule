import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// The anon key can only ever reach `capsule_wall` (redacted metadata). The table holding the actual
// message text has RLS that denies anon entirely — see supabase/migrations. That separation is the
// whole product promise, so it is enforced in the database, not in this client.
export const supabase = url && anon ? createClient(url, anon) : null
export const configured = Boolean(url && anon)
