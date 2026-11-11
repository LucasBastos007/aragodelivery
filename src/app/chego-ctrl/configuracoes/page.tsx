"use client"

// Configurações da operação (admin 2.0, 20/10/2026). Mesmas chaves de antes em /api/admin/configuracoes;
// grava só o que esta tela muda (pedidos por motoboy e raio pra juntar pedidos).
import { useEffect, useState } from "react"

export default function ConfiguracoesPage() {
  const [cfg, setCfg] = useState<Record<string, string> | null>(null)
  const [max, setMax] = useState(2), [raio, setRaio] = useState(5)
  const [env, setEnv] = useState(false), [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  useEffect(() => { fetch("/api/admin/configuracoes", { credentials: "include" }).then(r => r.json()).then(j => { const c = j.configuracoes ?? {}; setCfg(c); setMax(Number(c.max_pedidos_motoboy ?? 2)); setRaio(Number(c.raio_compatibilidade_km ?? 5)) }).catch(() => setMsg({ t: "Não foi possível carregar.", ok: false })) }, [])
  const mudou = cfg && (String(max) !== String(cfg.max_pedidos_motoboy ?? 2) || String(raio) !== String(cfg.raio_compatibilidade_km ?? 5))

  async function salvar() {
    setEnv(true); setMsg(null)
    const r = await fetch("/api/admin/configuracoes", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_pedidos_motoboy: String(max), raio_compatibilidade_km: String(raio) }) })
    const j = await r.json().catch(() => ({})); setEnv(false)
    if (!r.ok || j.error) { setMsg({ t: j.error ?? "Não deu certo.", ok: false }); return }
    setCfg(c => ({ ...(c ?? {}), max_pedidos_motoboy: String(max), raio_compatibilidade_km: String(raio) })); setMsg({ t: "Salvo. Já vale pros próximos pedidos.", ok: true })
  }

  if (!cfg) return <p className="mut">{msg?.t ?? "Carregando…"}</p>
  return (
    <div className="cf">
      {msg && <div className={`aviso ${msg.ok ? "vd" : "vm"}`} role="status" style={{ marginBottom: 12 }}>{msg.t}</div>}
      <div className="cartao cf-it">
        <div><b className="t16b">Pedidos ao mesmo tempo por motoboy</b><p className="t14 mut">Quantas entregas um motoboy pode levar juntas. Mais pedidos rende mais pra ele, mas atrasa quem está no fim da rota.</p></div>
        <div className="cf-num">{[1, 2, 3, 4, 5, 6, 7].map(n => <button key={n} aria-pressed={max === n} onClick={() => setMax(n)}>{n}</button>)}</div>
      </div>
      <div className="cartao cf-it">
        <div><b className="t16b">Distância pra juntar pedidos</b><p className="t14 mut">Pedidos com entrega até essa distância um do outro podem ir com o mesmo motoboy.</p></div>
        <div className="cf-raio"><input type="range" min={1} max={30} value={raio} onChange={e => setRaio(Number(e.target.value))} /><b className="num">{raio} km</b></div>
      </div>
      {cfg.fechamento_inicio && <div className="cartao cf-it"><div><b className="t16b">Fechamento diário</b><p className="t14 mut">Sai todo dia às 23h59 pra você e pra equipe, contando a partir de {new Date(cfg.fechamento_inicio + "T12:00:00").toLocaleDateString("pt-BR")}.</p></div></div>}
      <button className="btn btn-p" style={{ marginTop: 6 }} disabled={!mudou || env} onClick={salvar}>{env ? "Salvando…" : mudou ? "Salvar" : "Nada mudou"}</button>
    </div>
  )
}
