import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { motoboy_id } = await req.json()
    if (!motoboy_id) return new Response("missing id", { status: 400 })
    await supabase
      .from("motoboys")
      .update({ disponivel: false, last_seen: new Date().toISOString() })
      .eq("id", motoboy_id)
  } catch {}
  return new Response("ok")
}
