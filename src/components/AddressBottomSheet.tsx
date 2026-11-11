"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/lib/supabase"

const MapaPicker = dynamic(() => import("@/components/MapaPicker"), { ssr: false })
const CENTRO: Record<string, { lat: number; lng: number }> = {
  "Aragoiânia": { lat: -16.9214, lng: -49.4497 },
  "Guapó": { lat: -16.8306, lng: -49.5319 },
}
const IcVoltar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
const IcPin = ({ c = "currentColor" }: { c?: string }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>

export interface Endereco {
  id: string
  rotulo?: string   // "Casa", "Trabalho" etc.
  rua: string
  numero: string
  complemento?: string
  bairro?: string
  cidade?: string
  texto: string     // linha resumida p/ exibir no header
}

function gerarId() {
  return Math.random().toString(36).slice(2, 10)
}

function formatarTexto(e: Partial<Endereco>): string {
  return [
    [e.rua, e.numero].filter(Boolean).join(", "),
    e.complemento,
    e.bairro,
  ].filter(Boolean).join(" — ")
}

interface Props {
  currentAddress: string
  onSelect: (texto: string) => void
  onClose: () => void
}

export default function AddressBottomSheet({ currentAddress, onSelect, onClose }: Props) {
  const [enderecos, setEnderecos]     = useState<Endereco[]>([])
  const [busca, setBusca]             = useState("")
  const [menu, setMenu]               = useState<string | null>(null)  // id com ⋮ aberto
  const [actionAddr, setActionAddr]   = useState<Endereco | null>(null) // action sheet
  const [gpsLoading, setGpsLoading]   = useState(false)
  const [form, setForm]               = useState<Partial<Endereco> | null>(null) // null = fechado
  const [formErro, setFormErro]       = useState("")
  const buscarRef = useRef<HTMLInputElement>(null)
  // Marcar no mapa (tela 7 da proposta): cidade escolhida → arrasta o pino → confirma
  const [mapa, setMapa] = useState<{ lat: number; lng: number } | null>(null)
  const [mapaRotulo, setMapaRotulo] = useState<{ rua: string; bairro: string; cidade: string } | null>(null)
  const [abertas, setAbertas] = useState<Record<string, number>>({})
  useEffect(() => {
    supabase.from("lojas").select("cidade, aberto").eq("status", "ativo").then(({ data }) => {
      const c: Record<string, number> = {}
      for (const l of (data ?? []) as any[]) if (l.aberto && l.cidade) c[l.cidade] = (c[l.cidade] ?? 0) + 1
      setAbertas(c)
    })
  }, [])
  useEffect(() => {
    if (!mapa) return
    const t = setTimeout(() => {
      fetch(`/api/geocode/reverse?lat=${mapa.lat}&lon=${mapa.lng}`).then(r => r.json()).then(d => {
        const a = d?.address ?? {}
        setMapaRotulo({ rua: a.road || a.pedestrian || "", bairro: a.suburb || a.neighbourhood || "", cidade: a.city || a.town || a.village || "" })
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(t)
  }, [mapa])

  // Carrega endereços salvos
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arago_enderecos")
      if (raw) setEnderecos(JSON.parse(raw))
    } catch {}
    setTimeout(() => buscarRef.current?.focus(), 200)
  }, [])

  function salvar(list: Endereco[]) {
    setEnderecos(list)
    localStorage.setItem("arago_enderecos", JSON.stringify(list))
  }

  function selecionarEndereco(addr: Endereco) {
    localStorage.setItem("arago_last_address", addr.texto)
    onSelect(addr.texto)
    onClose()
  }

  function excluir(id: string) {
    salvar(enderecos.filter(e => e.id !== id))
    setActionAddr(null)
  }

  async function usarGPS() {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=pt-BR`,
            { headers: { "User-Agent": "AragoDelivery/1.0" } }
          )
          const d = await res.json()
          const a = d.address ?? {}
          const rua    = a.road || a.pedestrian || a.path || "Minha localização"
          const bairro = a.suburb || a.neighbourhood || a.city_district || ""
          const cidade = a.city || a.town || a.village || "Aragoiânia"
          const texto  = [rua, bairro, cidade].filter(Boolean).join(", ")
          localStorage.setItem("arago_last_address", texto)
          onSelect(texto)
        } catch {
          onSelect("Minha localização")
        }
        setGpsLoading(false)
        onClose()
      },
      () => setGpsLoading(false),
      { timeout: 8000 }
    )
  }

  function abrirAdicionar() {
    setActionAddr(null)
    setForm({ id: gerarId(), cidade: "Aragoiânia" })
    setFormErro("")
  }

  function abrirEditar(addr: Endereco) {
    setActionAddr(null)
    setForm({ ...addr })
    setFormErro("")
  }

  function salvarForm() {
    if (!form) return
    if (!form.rua?.trim()) { setFormErro("Informe a rua"); return }
    if (!form.numero?.trim()) { setFormErro("Informe o número"); return }
    const texto = formatarTexto(form)
    const novoEndereco: Endereco = {
      id:          form.id ?? gerarId(),
      rotulo:      form.rotulo?.trim() || undefined,
      rua:         form.rua.trim(),
      numero:      form.numero.trim(),
      complemento: form.complemento?.trim() || undefined,
      bairro:      form.bairro?.trim() || undefined,
      cidade:      form.cidade?.trim() || "Aragoiânia",
      texto,
    }
    const idx = enderecos.findIndex(e => e.id === novoEndereco.id)
    const lista = idx >= 0
      ? enderecos.map((e, i) => i === idx ? novoEndereco : e)
      : [...enderecos, novoEndereco]
    salvar(lista)
    setForm(null)
  }

  const filtrados = enderecos.filter(e =>
    !busca || e.texto.toLowerCase().includes(busca.toLowerCase()) ||
    (e.rotulo?.toLowerCase().includes(busca.toLowerCase()))
  )

  // ── Marcar no mapa ──
  if (mapa) {
    return (
      <div className="cn end-tela" style={{ background: "#000" }}>
        <div className="mapa-cheio"><MapaPicker lat={mapa.lat} lng={mapa.lng} onMove={(lat, lng) => setMapa({ lat, lng })} /></div>
        <button className="voltar flutua" onClick={() => setMapa(null)} aria-label="Voltar"><IcVoltar /></button>
        <div className="mapa-painel">
          <div className="h2">Arraste o mapa até a sua porta</div>
          <p className="mut" style={{ fontSize: 14, margin: "4px 0 12px" }}>O entregador vai direto ao ponto do pino.</p>
          <div className="mapa-rotulo"><IcPin c="var(--pimenta)" /><span><b>{mapaRotulo?.rua || "Procurando a rua…"}</b><small className="mut">{[mapaRotulo?.bairro, mapaRotulo?.cidade].filter(Boolean).join(" · ")}</small></span></div>
          <button className="btn btn-p" onClick={() => {
            setForm({ id: gerarId(), rua: mapaRotulo?.rua ?? "", bairro: mapaRotulo?.bairro ?? "", cidade: mapaRotulo?.cidade || "Aragoiânia" })
            setFormErro(""); setMapa(null)
          }}>Confirmar localização</button>
        </div>
      </div>
    )
  }

  // ── Form ──
  if (form !== null) {
    const isEdit = enderecos.some(e => e.id === form.id)
    return (
      <div className="cn end-tela">
        <div className="topo branco"><div className="linha-topo">
          <button className="voltar" onClick={() => setForm(null)} aria-label="Voltar"><IcVoltar /></button>
          <span className="h2" style={{ flex: 1 }}>{isEdit ? "Editar endereço" : "Novo endereço"}</span>
        </div></div>
        <div style={{ padding: "16px 18px 40px", overflowY: "auto", flex: 1 }}>
          {[
            { key: "rua", label: "Rua *", placeholder: "Rua das Flores" },
            { key: "numero", label: "Número *", placeholder: "42" },
            { key: "complemento", label: "Complemento", placeholder: "Apto 3, casa dos fundos" },
            { key: "bairro", label: "Bairro", placeholder: "Centro" },
            { key: "cidade", label: "Cidade", placeholder: "Aragoiânia" },
            { key: "rotulo", label: "Apelido (opcional)", placeholder: "Casa, Trabalho…" },
          ].map(f => (
            <label key={f.key} className="campo" style={{ marginBottom: 12 }}><span>{f.label}</span>
              <input value={(form as any)[f.key] ?? ""} onChange={e => setForm(prev => ({ ...prev!, [f.key]: e.target.value }))} placeholder={f.placeholder} /></label>
          ))}
          {formErro && <p className="aviso-vermelho" style={{ margin: "0 0 12px" }}>{formErro}</p>}
          <button className="btn btn-p" onClick={salvarForm}>Salvar endereço</button>
        </div>
      </div>
    )
  }

  // ── Endereço de entrega (tela 6 da proposta) ──
  return (
    <div className="cn end-tela">
      <div className="topo branco"><div className="linha-topo">
        <button className="voltar" onClick={onClose} aria-label="Voltar"><IcVoltar /></button>
        <span className="h2" style={{ flex: 1 }}>Endereço de entrega</span>
      </div></div>
      <div style={{ padding: "16px 14px 40px", overflowY: "auto", flex: 1 }}>
        <button className="cartao usar-loc" onClick={usarGPS} disabled={gpsLoading}>
          <span className="ic"><IcPin c="var(--pimenta)" /></span>
          <span style={{ flex: 1, textAlign: "left" }}><b className="h3" style={{ display: "block" }}>{gpsLoading ? "Procurando você…" : "Usar minha localização"}</b><small className="mut">Pede a permissão do celular e marca no mapa</small></span>
          <span style={{ color: "var(--pimenta)", fontSize: 22 }}>›</span>
        </button>
        <div className="end-ou"><span>ou</span></div>

        <span className="h3" style={{ display: "block", marginBottom: 8 }}>Busque o endereço</span>
        <input ref={buscarRef} className="end-busca" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Rua, número e bairro" />

        {filtrados.length > 0 && <div className="cartao" style={{ marginTop: 10, padding: "4px 0" }}>
          {filtrados.map(addr => {
            const ativo = addr.texto === currentAddress
            return (
              <div key={addr.id} className="end-salvo">
                <span style={{ color: ativo ? "var(--pimenta)" : "var(--suave)" }}><IcPin /></span>
                <button onClick={() => selecionarEndereco(addr)} style={{ flex: 1, textAlign: "left" }}>
                  <b>{addr.rotulo ? `${addr.rotulo} · ` : ""}{[addr.rua, addr.numero].filter(Boolean).join(", ")}</b>
                  <small className="mut">{[addr.complemento, addr.bairro, addr.cidade].filter(Boolean).join(" · ")}</small>
                </button>
                <button className="mut" aria-label="Opções" onClick={() => setActionAddr(addr)} style={{ padding: 6, fontSize: 18 }}>⋮</button>
              </div>
            )
          })}
        </div>}
        <button onClick={abrirAdicionar} style={{ display: "block", margin: "12px 4px 0", color: "var(--pimenta)", fontWeight: 700, fontSize: 14.5 }}>+ Digitar um endereço novo</button>

        <span className="h3" style={{ display: "block", margin: "22px 0 10px" }}>Ou escolha a cidade e marque no mapa</span>
        <div className="end-cidades">
          {Object.keys(CENTRO).map(c => (
            <button key={c} className="cartao" onClick={() => setMapa(CENTRO[c])}>
              <span className="mut" style={{ fontSize: 12.5 }}>{abertas[c] ?? 0} {abertas[c] === 1 ? "aberta" : "abertas"} agora</span>
              <b>{c}</b>
            </button>
          ))}
        </div>
      </div>

      {actionAddr && (
        <div className="cn-veu on" onClick={() => setActionAddr(null)}>
          <div className="cn folha on" onClick={e => e.stopPropagation()} style={{ padding: "20px 20px calc(env(safe-area-inset-bottom,0px) + 22px)" }}>
            <div className="h3" style={{ textAlign: "center", marginBottom: 16 }}>{actionAddr.rotulo || [actionAddr.rua, actionAddr.numero].filter(Boolean).join(", ")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button className="btn btn-s" onClick={() => excluir(actionAddr.id)}>Excluir</button>
              <button className="btn btn-p" onClick={() => abrirEditar(actionAddr)}>Editar</button>
            </div>
            <button className="btn btn-s" style={{ marginTop: 10 }} onClick={() => setActionAddr(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
