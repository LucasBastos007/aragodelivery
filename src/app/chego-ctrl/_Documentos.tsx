"use client"

// Documentos de loja e de motoboy (admin 2.0, 20/10/2026): fotos grandes que abrem em tela cheia,
// contrato e dados do cadastro. Fotos de motoboy abrem por link temporário (/api/admin/doc-url).
import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

const ST: Record<string, [string, string]> = { pendente: ["Esperando aprovação", "amarelo"], aprovado: ["Contrato enviado", "azul"], contrato_assinado: ["Contrato assinado", "roxo"], ativo: ["Ativo", "verde"], suspenso: ["Suspenso", "vermelho"] }
const pix = (raw: unknown) => { if (!raw) return null; try { const o = JSON.parse(String(raw)); return [o.pix ?? o.chave, o.banco].filter(Boolean).join(", ") } catch { return String(raw) } }

export default function Documentos({ tipo }: { tipo: "loja" | "motoboy" }) {
  const [x, setX] = useState<any>(null), [docs, setDocs] = useState<{ n: string; url: string; contem?: boolean }[]>([]), [erro, setErro] = useState(""), [foto, setFoto] = useState<string | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    if (!id) { setErro("Abra pela tela de " + (tipo === "loja" ? "Lojas" : "Motoboys") + "."); return }
    supabase.from(tipo === "loja" ? "lojas" : "motoboys").select("*").eq("id", id).single().then(async ({ data }) => {
      if (!data) { setErro("Cadastro não encontrado."); return }
      setX(data)
      const d: any = data
      const brutos: [string, string | null, boolean][] = tipo === "loja"
        ? [["Logo", d.logo_url, false], ["Assinatura do contrato", d.contrato_assinatura, true]]
        : [["Documento, frente", d.documentos?.cnhFrente, false], ["Documento, verso", d.documentos?.cnhVerso, false], ["Documento da moto (CRLV)", d.documentos?.crlv, false], ["Selfie do cadastro", d.documentos?.selfie, false], ["Selfie com documento", d.selfie_contrato, false], ["Assinatura do contrato", d.contrato_assinatura, true]]
      const lista = await Promise.all(brutos.filter(b => b[1]).map(async ([n, v, contem]) => {
        if (tipo === "loja" || String(v).startsWith("data:")) return { n, url: v!, contem }
        const r = await fetch("/api/admin/doc-url", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: v }) }).catch(() => null)
        return { n, url: r?.ok ? (await r.json()).signedUrl : v!, contem }
      }))
      setDocs(lista)
    })
  }, [tipo])

  if (!x) return <p className="mut">{erro || "Carregando…"}</p>
  const st = ST[x.status] ?? [x.status, "cinza"]
  const dados: [string, unknown][] = tipo === "loja"
    ? [["Responsável", x.nome_responsavel], ["CPF", x.cpf_responsavel], ["CNPJ", x.cnpj], ["E-mail", x.email], ["Telefone", x.telefone], ["Endereço", x.endereco], ["Pix", pix(x.pix_key ?? x.pix_chave)], ["Cadastro", new Date(x.criado_em).toLocaleDateString("pt-BR")]]
    : [["CPF", x.cpf], ["CNH", x.cnh], ["E-mail", x.email], ["Telefone", x.telefone], ["Veículo", x.veiculo], ["Placa", x.placa], ["Pix", pix(x.pix_key ?? x.pix_chave)], ["Cadastro", new Date(x.criado_em).toLocaleDateString("pt-BR")]]
  return (
    <>
      <div className="lin" style={{ gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {tipo === "loja" && x.logo_url ? <img src={x.logo_url} alt="" className="lj-logo g" /> : <span className="mb-av g">{x.nome?.[0]}</span>}
        <span style={{ flex: 1 }}><b className="t20">{x.nome}</b><br /><span className={`selo ${st[1]}`}>{st[0]}</span></span>
        <Link className="btn btn-s" style={{ minHeight: 42 }} href={tipo === "loja" ? `/chego-ctrl/lojas?id=${x.id}` : `/chego-ctrl/motoboys?id=${x.id}`}>Voltar pro cadastro</Link>
      </div>
      <div className="dc-grade">{docs.map(d => (
        <button key={d.n} className="cartao dc-it" onClick={() => setFoto(d.url)}><img src={d.url} alt={d.n} style={{ objectFit: d.contem ? "contain" : "cover" }} /><span>{d.n}</span></button>))}
        {!docs.length && <div className="cartao dsp-vazio"><b>Nenhum documento enviado</b><span>Quando {tipo === "loja" ? "a loja" : "o motoboy"} enviar, aparece aqui.</span></div>}</div>
      <div className="dupla">
        <div className="cartao" style={{ padding: 16 }}><b className="t16b">Dados do cadastro</b>{dados.filter(([, v]) => v).map(([n, v]) => <div key={n} className="lj-dado"><span>{n}</span><b>{String(v)}</b></div>)}</div>
        <div className="cartao" style={{ padding: 16 }}><b className="t16b">Contrato</b>
          <p className="t14" style={{ margin: "6px 0 10px", color: x.contrato_assinado ? "var(--folha)" : "var(--suave)" }}>{x.contrato_assinado ? `Assinado${x.contrato_assinado_em ? ` em ${new Date(x.contrato_assinado_em).toLocaleDateString("pt-BR")}` : ""}` : "Ainda não assinado"}</p>
          <a className="btn btn-s" href={`/api/chego-ctrl/contrato?tipo=${tipo}&id=${x.id}${x.contrato_assinado ? "" : "&modo=preview"}`} target="_blank" rel="noreferrer">Ver contrato (PDF)</a></div>
      </div>
      {foto && <div className="veu on mb-luz" onClick={() => setFoto(null)}><img src={foto} alt="Documento" onClick={e => e.stopPropagation()} /><div className="lin" style={{ gap: 8 }}><a className="btn btn-s" href={foto} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Abrir em nova aba</a><button className="btn btn-s" onClick={() => setFoto(null)}>Fechar</button></div></div>}
    </>
  )
}
