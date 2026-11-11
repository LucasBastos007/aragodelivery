"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const STATUS_LABEL: Record<string, { texto: string; cor: string; bg: string; border: string }> = {
  aceito:     { texto: "Loja aceitou", cor: "#1E5BD8", bg: "#E8EFFC", border: "#E8EFFC" },
  preparando: { texto: "Em preparo",   cor: "#8A5A00", bg: "#FFF6D6", border: "#FFF6D6" },
  aguardando: { texto: "Avulsa disponível", cor: "#1E8A4C", bg: "#E6F4EC", border: "#E6F4EC" },
}

const DEFAULT_LAT = -17.0549
const DEFAULT_LNG = -49.2295

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function MotoboyPedidosPage() {
  const { sessao } = useAuth()
  const motoboy_id = sessao?.role === "motoboy" ? sessao.motoboy_id : null
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const raioRef = useRef(12)
  const posRef  = useRef<{ lat: number; lng: number } | null>(null)
  // cidade_fixa (2026-09-26): mesmo bypass usado no despacho — ver
  // migration-motoboy-cidade-fixa.sql e a mesma regra em motoboy/page.tsx e
  // api/escalada/route.ts.
  const cidadeFixaRef = useRef<string | null>(null)

  // Raio e localização do motoboy — mesma regra usada no despacho (escalada) e na lista
  // "pronto": só mostra pedido de loja dentro do raio configurado, calculado pela
  // localização AO VIVO do motoboy (ver AGENTS.md).
  useEffect(() => {
    if (!motoboy_id) return
    supabase.from("motoboys").select("lat, lng, raio_km, cidade_fixa").eq("id", motoboy_id).single()
      .then(({ data }) => {
        if (data?.raio_km) raioRef.current = data.raio_km
        if (data?.lat && data?.lng) posRef.current = { lat: data.lat, lng: data.lng }
        cidadeFixaRef.current = (data as any)?.cidade_fixa ?? null
      })
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          // Leitura de baixa precisão não substitui a posição já carregada do banco —
          // mesma guarda usada em motoboy/page.tsx (ver ACCURACY_MAX_M lá).
          if (coords.accuracy != null && coords.accuracy > 500) return
          posRef.current = { lat: coords.latitude, lng: coords.longitude }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      )
    }
  }, [motoboy_id])

  const carregar = useCallback(async () => {
    // Só pedidos/avulsas que ainda vão precisar de motoboy — retirada na loja nunca entra
    // na fila de despacho, então não faz sentido o motoboy ficar de olho nesses.
    const [{ data: pedidosData }, { data: avulsasData }] = await Promise.all([
      supabase.from("pedidos")
        .select("id, codigo, criado_em, status, endereco_entrega, loja:lojas(nome, lat, lng, cidade)")
        .in("status", ["aceito", "preparando"])
        .not("endereco_entrega", "ilike", "%Retirada%")
        .order("criado_em", { ascending: false }),
      // Avulsa não tem fase de "preparo" antes de virar disponível — "aguardando" já É
      // o equivalente de "pronto pra corrida" (motoboy pode aceitar agora, ver
      // /api/motoboy/aceitar-avulsa). Mostra aqui como aviso de "tem uma disponível".
      supabase.from("entregas_avulsas")
        .select("id, codigo, criado_em, status, endereco, loja_nome, loja_lat, loja_lng")
        .eq("status", "aguardando")
        .order("criado_em", { ascending: false }),
    ])

    const pos = posRef.current
    const temGps = !!pos && (pos.lat !== DEFAULT_LAT || pos.lng !== DEFAULT_LNG)
    function dentroDoRaio(lat?: number | null, lng?: number | null): boolean {
      if (!temGps || !lat || !lng || !pos) return true
      return haversineKm(pos.lat, pos.lng, lat, lng) <= raioRef.current
    }
    function distancia(lat?: number | null, lng?: number | null): number | null {
      if (!temGps || !lat || !lng || !pos) return null
      return haversineKm(pos.lat, pos.lng, lat, lng)
    }

    const normalizados = [
      ...((pedidosData ?? []) as any[])
        .filter(p => (cidadeFixaRef.current && p.loja?.cidade && p.loja.cidade === cidadeFixaRef.current) || dentroDoRaio(p.loja?.lat, p.loja?.lng))
        .map(p => ({ id: p.id, codigo: p.codigo, criado_em: p.criado_em, status: p.status, lojaNome: p.loja?.nome, avulsa: false, km: distancia(p.loja?.lat, p.loja?.lng) })),
      ...((avulsasData ?? []) as any[])
        .filter(a => dentroDoRaio(a.loja_lat, a.loja_lng))
        .map(a => ({ id: a.id, codigo: a.codigo, criado_em: a.criado_em, status: a.status, lojaNome: a.loja_nome, avulsa: true, km: distancia(a.loja_lat, a.loja_lng) })),
    ].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())

    setPedidos(normalizados)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    const iv = setInterval(carregar, 15_000)
    return () => clearInterval(iv)
  }, [carregar])

  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const iv = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(iv) }, [])
  const minutos = (iso: string) => Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000))
  const emPreparo = pedidos.filter(p => !p.avulsa).length
  const avulsas = pedidos.length - emPreparo

  // Layout novo (20/10/2026): mesma consulta e mesmo filtro de raio de antes, só a tela mudou.
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "calc(env(safe-area-inset-top,0px) + 20px) 14px calc(var(--nav-h) + 24px)", overflowX: "hidden" }}>
      <h1 style={{ fontFamily: "var(--display)", color: "var(--grafite)", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>Pedidos</h1>
      <p style={{ color: "var(--suave)", fontSize: 14, marginTop: 4, lineHeight: 1.45 }}>
        O que as lojas perto de você estão preparando agora. Quando ficar pronto, a corrida chega no Mapa.
      </p>

      {!loading && pedidos.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <span style={{ flex: 1, background: "var(--pequi-claro)", borderRadius: 14, padding: "10px 12px" }}>
            <b style={{ fontFamily: "var(--display)", fontSize: 22, color: "var(--grafite)", fontVariantNumeric: "tabular-nums" }}>{emPreparo}</b>
            <span style={{ display: "block", fontSize: 12, color: "var(--texto)" }}>em preparo</span>
          </span>
          <span style={{ flex: 1, background: "var(--folha-claro)", borderRadius: 14, padding: "10px 12px" }}>
            <b style={{ fontFamily: "var(--display)", fontSize: 22, color: "var(--grafite)", fontVariantNumeric: "tabular-nums" }}>{avulsas}</b>
            <span style={{ display: "block", fontSize: 12, color: "var(--texto)" }}>avulsas disponíveis</span>
          </span>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--suave)", marginTop: 24 }}>Carregando…</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <div style={{ fontSize: 44 }}>🍳</div>
          <p style={{ color: "var(--grafite)", fontWeight: 700, marginTop: 8 }}>Nenhuma loja preparando pedido perto de você</p>
          <p style={{ color: "var(--suave)", fontSize: 13, marginTop: 4 }}>
            Assim que uma loja aceitar um pedido, ou surgir uma entrega avulsa, aparece aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {pedidos.map(p => {
            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.aceito
            const min = minutos(p.criado_em)
            return (
              <div key={p.id} style={{ background: "var(--branco)", borderRadius: 16, padding: "14px 16px", border: "1px solid var(--linha)", boxShadow: "var(--sombra)", display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: p.avulsa ? "var(--folha-claro)" : "var(--pequi-claro)", display: "grid", placeItems: "center", fontSize: 22, flex: "none" }}>{p.avulsa ? "📦" : "🍳"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", color: "var(--grafite)", fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.lojaNome ?? "Loja"}</b>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: st.bg, color: st.cor }}>{st.texto}</span>
                    <span style={{ fontSize: 12, color: "var(--suave)" }}>#{p.codigo}</span>
                  </span>
                </span>
                <span style={{ textAlign: "right", flex: "none" }}>
                  <b style={{ display: "block", color: "var(--grafite)", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{min < 1 ? "agora" : `há ${min} min`}</b>
                  {p.km != null && <span style={{ fontSize: 12, color: "var(--suave)", fontVariantNumeric: "tabular-nums" }}>{p.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km de você</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
