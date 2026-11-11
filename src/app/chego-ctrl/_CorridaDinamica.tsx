"use client"

// Corrida dinâmica (chuva), 25/10/2026: liga um acréscimo por corrida até uma hora marcada.
// O cliente paga e o valor vai inteiro pro motoboy (lib/corridaDinamica.ts). Desliga sozinha.
import { useEffect, useState } from "react"
import { R } from "./_dinheiro"

type Estado = { ativa: boolean; config: { valor: number; ate: string } | null }

const mascara = (t: string) => { const c = t.replace(/\D/g, "").slice(0, 4); return c ? (Number(c) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "" }
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h")

export function CorridaDinamica() {
  const [e, setE] = useState<Estado | null>(null)
  const [valor, setValor] = useState("1,00")
  const [ate, setAte] = useState(() => {
    const d = new Date(Date.now() + 2 * 3600000)
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(/:\d\d$/, ":00")
  })
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("")

  const carregar = () => fetch("/api/admin/corrida-dinamica", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(j => j && setE(j)).catch(() => {})
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t) }, [])

  async function enviar(corpo: object) {
    setOcupado(true); setErro("")
    const r = await fetch("/api/admin/corrida-dinamica", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })
    const j = await r.json().catch(() => ({})); setOcupado(false)
    if (!r.ok) { setErro(j.error ?? "Não deu certo. Tente de novo."); return }
    setE(j)
  }

  const ativa = !!e?.ativa && !!e.config
  return (
    <div className="cartao cd-cartao" data-ativa={ativa || undefined}>
      <div className="lin" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        <span style={{ flex: 1, minWidth: 240 }}>
          <b className="t20">Corrida dinâmica</b>
          {ativa
            ? <p className="t14" style={{ marginTop: 4 }}><b>Ligada: + {R(e!.config!.valor)} por entrega até {hora(e!.config!.ate)}.</b> O cliente paga e o valor vai inteiro pro motoboy. Desliga sozinha nesse horário.</p>
            : <p className="t14 mut" style={{ marginTop: 4 }}>Pra chuva: soma um valor fixo em toda entrega, de todas as lojas, até a hora que você escolher. O cliente paga e o motoboy recebe tudo. Retirada não muda.</p>}
        </span>
        {ativa && <button className="btn btn-s" disabled={ocupado} onClick={() => enviar({ acao: "desligar" })}>{ocupado ? "Desligando…" : "Desligar agora"}</button>}
      </div>
      {!ativa && (
        <div className="lin cd-form">
          <label className="campo"><span>Valor por entrega</span><input inputMode="numeric" value={valor} placeholder="R$ 0,00" onChange={ev => setValor(mascara(ev.target.value))} /></label>
          <label className="campo"><span>Até que horas</span><input type="time" value={ate} onChange={ev => setAte(ev.target.value)} /></label>
          <button className="btn btn-p" disabled={ocupado || !valor || !ate}
            onClick={() => enviar({ acao: "ligar", valor: Number(valor.replace(/\./g, "").replace(",", ".")), ate })}>{ocupado ? "Ligando…" : "Ligar dinâmica"}</button>
        </div>
      )}
      {erro && <div className="aviso vm" style={{ marginTop: 10 }}>{erro}</div>}
    </div>
  )
}
