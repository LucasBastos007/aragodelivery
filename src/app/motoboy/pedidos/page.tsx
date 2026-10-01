"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"

const STATUS_LABEL: Record<string, { texto: string; cor: string; bg: string; border: string }> = {
  aceito:     { texto: "Aceito pela loja", cor: "#60a5fa", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.2)" },
  preparando: { texto: "Sendo preparado",  cor: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.2)" },
  aguardando: { texto: "Avulsa disponível", cor: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.2)" },
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

    const normalizados = [
      ...((pedidosData ?? []) as any[])
        .filter(p => (cidadeFixaRef.current && p.loja?.cidade && p.loja.cidade === cidadeFixaRef.current) || dentroDoRaio(p.loja?.lat, p.loja?.lng))
        .map(p => ({ id: p.id, codigo: p.codigo, criado_em: p.criado_em, status: p.status, lojaNome: p.loja?.nome, avulsa: false })),
      ...((avulsasData ?? []) as any[])
        .filter(a => dentroDoRaio(a.loja_lat, a.loja_lng))
        .map(a => ({ id: a.id, codigo: a.codigo, criado_em: a.criado_em, status: a.status, lojaNome: a.loja_nome, avulsa: true })),
    ].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())

    setPedidos(normalizados)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
    const iv = setInterval(carregar, 15_000)
    return () => clearInterval(iv)
  }, [carregar])

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 14px 90px", overflowX: "hidden" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ color: "white", fontWeight: 900, fontSize: 20 }}>Pedidos</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>
          Pedidos em preparo e entregas avulsas disponíveis perto de você — fique de olho
        </p>
      </div>

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : pedidos.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Nada por perto agora</p>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 4 }}>
            Assim que uma loja aceitar um pedido, ou surgir uma entrega avulsa, aparece aqui
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pedidos.map(p => {
            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.aceito
            return (
              <div key={p.id} style={{
                background: "#111", borderRadius: 14, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <p style={{ color: "white", fontSize: 14, fontWeight: 800 }}>#{p.codigo}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: st.bg, color: st.cor, border: `1px solid ${st.border}`,
                  }}>
                    {st.texto}
                  </span>
                  {p.avulsa && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                      AVULSA
                    </span>
                  )}
                </div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                  {p.avulsa ? "📦" : "🍽️"} {p.avulsa ? "Entrega avulsa de" : "Pedido sendo preparado em"} <strong>{p.lojaNome ?? "loja"}</strong>
                </p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 6 }}>
                  {new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
