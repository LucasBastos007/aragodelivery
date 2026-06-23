import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireMotoboy } from "@/lib/session"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const _sess = requireMotoboy(req)
    if (!_sess) return new Response("unauthorized", { status: 401 })
    const motoboy_id = _sess.motoboy_id

    await supabase
      .from("motoboys")
      .update({ disponivel: false, last_seen: new Date().toISOString() })
      .eq("id", motoboy_id)
  } catch {}
  return new Response("ok")
}
