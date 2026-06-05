import { createClient } from "@supabase/supabase-js"

const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SB_URL = raw.startsWith("http") ? raw : "https://placeholder.supabase.co"
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"

export const supabase = createClient(SB_URL, SB_KEY)
