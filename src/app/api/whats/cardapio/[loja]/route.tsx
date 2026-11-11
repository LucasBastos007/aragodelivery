import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cardapio } from "@/lib/roboPedidos"

// Imagem do cardápio numerado para o robô do WhatsApp (14 itens por página, com foto).
// A numeração é a mesma que o robô usa ("quero o 12"). Só lojas liberadas no robô.
export const dynamic = "force-dynamic"
const POR_PAGINA = 14

export async function GET(req: NextRequest, { params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params
  const pg = Math.max(1, Number(req.nextUrl.searchParams.get("p")) || 1)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: cfg } = await sb.from("configuracoes").select("valor").eq("chave", "robo_pedidos").maybeSingle()
  let lojas: string[] = []; try { lojas = JSON.parse(cfg?.valor ?? "{}").lojas ?? [] } catch { /* vazio */ }
  if (!lojas.includes(loja)) return new Response("não encontrado", { status: 404 })
  const { data: l } = await sb.from("lojas").select("nome, logo_url").eq("id", loja).maybeSingle()
  const itens = await cardapio(sb, loja)
  const total = Math.max(1, Math.ceil(itens.length / POR_PAGINA))
  const fatia = itens.slice((pg - 1) * POR_PAGINA, pg * POR_PAGINA)
  const brl = (v: number) => "R$ " + Number(v).toFixed(2).replace(".", ",")
  let catAnterior = ""
  return new ImageResponse(
    <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: "#fbf8f3", fontFamily: "sans-serif", padding: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, borderBottom: "4px solid #1f1a14", paddingBottom: 20 }}>
        {l?.logo_url ? <img src={l.logo_url} width={88} height={88} style={{ borderRadius: 18, objectFit: "cover" }} /> : null}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#1f1a14" }}>{l?.nome ?? "Cardápio"}</div>
          <div style={{ fontSize: 24, color: "#6b6258" }}>{`Cardápio${total > 1 ? `, página ${pg} de ${total}` : ""}. Responda com o número do item.`}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
        {fatia.map((p: any, i: number) => {
          const n = (pg - 1) * POR_PAGINA + i + 1
          const titulo = p.categoria !== catAnterior ? p.categoria : null
          catAnterior = p.categoria
          return (
            <div key={p.id} style={{ display: "flex", flexDirection: "column" }}>
              {titulo ? <div style={{ fontSize: 26, fontWeight: 800, color: "#c2410c", marginTop: 14, marginBottom: 4 }}>{titulo}</div> : null}
              <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "8px 0", borderBottom: "1px solid #e8e1d6", opacity: p.ativa ? 1 : 0.45 }}>
                <div style={{ width: 54, height: 54, borderRadius: 27, background: "#1f1a14", color: "#fff", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{String(n)}</div>
                {p.foto_url ? <img src={p.foto_url} width={64} height={64} style={{ borderRadius: 12, objectFit: "cover" }} /> : <div style={{ width: 64, height: 64, borderRadius: 12, background: "#efe7da", display: "flex" }} />}
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ fontSize: 27, fontWeight: 700, color: "#1f1a14" }}>{String(p.nome).slice(0, 52)}</div>
                  {p.ativa ? null : <div style={{ fontSize: 20, color: "#b45309" }}>{`Disponível ${p.horario ?? "em outro horário"}`}</div>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1f1a14" }}>{brl(Number(p.preco))}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#8a8075" }}>Chegô Delivery</div>
    </div>,
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=120" } },
  )
}
