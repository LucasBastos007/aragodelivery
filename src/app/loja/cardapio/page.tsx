"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Produto, CategoriaProduto, AdicionalProduto } from "@/types"

const DIAS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
]

type ProdutoForm = {
  nome: string
  descricao: string
  preco: string
  categoria_id: string
  disponivel: boolean
  foto_url: string
  dias_semana: number[]
  ncm: string
}
const FORM_VAZIO: ProdutoForm = { nome: "", descricao: "", preco: "", categoria_id: "", disponivel: true, foto_url: "", dias_semana: [], ncm: "" }

async function uploadFoto(file: File, path: string): Promise<{ url: string; erro?: string }> {
  try {
    const form = new FormData()
    form.append("file", file)
    form.append("path", path)
    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" })
    let data: any = {}
    try { data = await res.json() } catch {}
    if (!res.ok) return { url: "", erro: data.error ?? "Falha no upload da foto" }
    return { url: data.url ?? "" }
  } catch (e: any) {
    return { url: "", erro: e?.message ?? "Erro ao enviar a foto" }
  }
}

export default function CardapioPage() {
  const { sessao } = useAuth()
  const lojaId = sessao?.role === "lojista" ? sessao.loja_id : null

  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)

  const [modalProd, setModalProd] = useState(false)
  const [modalCat, setModalCat] = useState(false)
  const [uploadingCatId, setUploadingCatId] = useState<string | null>(null)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [formProd, setFormProd] = useState<ProdutoForm>(FORM_VAZIO)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>("")
  const [nomeCat, setNomeCat] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState("")
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [adicionais, setAdicionais] = useState<AdicionalProduto[]>([])
  const [novoAdicNome, setNovoAdicNome] = useState("")
  const [novoAdicPreco, setNovoAdicPreco] = useState("")

  useEffect(() => {
    if (!lojaId) return
    carregarTudo()
  }, [lojaId])

  async function carregarTudo() {
    setLoading(true)
    const [catRes, prodRes] = await Promise.all([
      supabase.from("categorias_produto").select("*").eq("loja_id", lojaId).order("ordem"),
      supabase.from("produtos").select("*").eq("loja_id", lojaId).order("criado_em"),
    ])
    setCategorias(catRes.data ?? [])
    setProdutos(prodRes.data ?? [])
    setLoading(false)
  }

  async function salvarCategoria() {
    if (!nomeCat.trim() || !lojaId) return
    setSalvando(true)
    setErroSalvar("")
    const res = await fetch("/api/loja/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loja_id: lojaId, nome: nomeCat.trim(), ordem: categorias.length }),
    })
    if (!res.ok) {
      const d = await res.json()
      setErroSalvar(d.error ?? "Erro ao salvar categoria")
      setSalvando(false)
      return
    }
    setNomeCat(""); setModalCat(false)
    await carregarTudo()
    setSalvando(false)
  }

  async function deletarCategoria(id: string) {
    if (!confirm("Deletar categoria? Os produtos desta categoria ficarão sem categoria.")) return
    await fetch("/api/loja/categorias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, loja_id: lojaId }),
    })
    await carregarTudo()
  }

  async function uploadFotoCategoria(catId: string, file: File) {
    setUploadingCatId(catId)
    const ext = file.name.split(".").pop() ?? "jpg"
    const path = `categorias/${lojaId}/${catId}.${ext}`
    const { url, erro } = await uploadFoto(file, path)
    if (erro || !url) { alert("Erro ao enviar foto: " + (erro ?? "desconhecido")); setUploadingCatId(null); return }
    await fetch("/api/loja/categorias", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: catId, foto_url: url }),
      credentials: "include",
    })
    await carregarTudo()
    setUploadingCatId(null)
  }

  function uid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }

  function adicionarAdicional() {
    if (!novoAdicNome.trim() || !novoAdicPreco) return
    setAdicionais(prev => [...prev, {
      id: uid(),
      nome: novoAdicNome.trim(),
      preco: parseFloat(novoAdicPreco),
    }])
    setNovoAdicNome("")
    setNovoAdicPreco("")
  }

  function abrirNovoProduto() {
    setEditando(null)
    setFormProd(FORM_VAZIO)
    setFotoFile(null)
    setFotoPreview("")
    setErroSalvar("")
    setAdicionais([])
    setNovoAdicNome("")
    setNovoAdicPreco("")
    setModalProd(true)
  }

  function abrirEditarProduto(p: Produto) {
    setEditando(p)
    setFormProd({
      nome: p.nome ?? "", descricao: p.descricao ?? "",
      preco: p.preco.toFixed(2),
      categoria_id: p.categoria_id ?? "",
      disponivel: p.disponivel,
      foto_url: p.foto_url ?? "",
      dias_semana: p.dias_semana ?? [],
      ncm: p.ncm ?? "",
    })
    setFotoFile(null)
    setFotoPreview(p.foto_url ?? "")
    setErroSalvar("")
    setAdicionais((p.adicionais ?? []).filter((a): a is AdicionalProduto => !("itens" in a)))
    setNovoAdicNome("")
    setNovoAdicPreco("")
    setModalProd(true)
  }

  function fecharModalProd() {
    setModalProd(false)
    setFotoFile(null)
    setFotoPreview("")
    setErroSalvar("")
    setAdicionais([])
  }

  async function salvarProduto() {
    if (!formProd.nome.trim() || !formProd.preco || !lojaId) return
    setSalvando(true)
    setErroSalvar("")

    try {
    let fotoUrlFinal = formProd.foto_url
    if (fotoFile) {
      const path = `produtos/${lojaId}/${Date.now()}.${fotoFile.name.split(".").pop() ?? "jpg"}`
      const { url, erro } = await uploadFoto(fotoFile, path)
      if (!url) {
        setErroSalvar(erro ?? "Falha ao enviar a foto. Verifique o tamanho (máx. 5MB) e tente novamente.")
        setSalvando(false)
        return
      }
      fotoUrlFinal = url
    }

    const body = {
      id: editando?.id,
      loja_id: lojaId,
      nome: formProd.nome.trim(),
      descricao: formProd.descricao.trim(),
      preco: parseFloat(formProd.preco),
      categoria_id: formProd.categoria_id || null,
      disponivel: formProd.disponivel,
      foto_url: fotoUrlFinal || null,
      adicionais: adicionais,
      dias_semana: formProd.dias_semana,
      ncm: formProd.ncm.replace(/\D/g, "") || null,
    }

    const res = await fetch("/api/loja/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const d = await res.json()
      setErroSalvar(d.error ?? "Erro ao salvar produto")
      setSalvando(false)
      return
    }

    fecharModalProd(); setEditando(null); setFormProd(FORM_VAZIO)
    await carregarTudo()
    } catch (e: any) {
      setErroSalvar(e?.message ?? "Erro inesperado ao salvar")
    } finally {
      setSalvando(false)
    }
  }

  async function toggleDisponivel(p: Produto) {
    await fetch("/api/loja/produtos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: p.id, loja_id: lojaId, disponivel: !p.disponivel }),
    })
    await carregarTudo()
  }

  async function deletarProduto(id: string) {
    if (!confirm("Deletar este produto?")) return
    await fetch("/api/loja/produtos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, loja_id: lojaId }),
    })
    await carregarTudo()
  }

  const semCategoria = produtos.filter(p => !p.categoria_id)
  const porCategoria = categorias.map(c => ({
    cat: c,
    items: produtos.filter(p => p.categoria_id === c.id),
  }))

  if (!lojaId) return null

  return (
    <div style={{ padding: "20px 16px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#111827", margin: 0 }}>Cardápio</h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
            {produtos.length} produto{produtos.length !== 1 ? "s" : ""} · {categorias.length} categoria{categorias.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setModalCat(true)} className="btn-ghost" style={{ fontSize: 13 }}>
            + Categoria
          </button>
          <button onClick={abrirNovoProduto} className="btn-primary" style={{ fontSize: 13 }}>
            + Produto
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#9CA3AF" }}>Carregando...</p>
      ) : produtos.length === 0 && categorias.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>🍽️</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 8 }}>Cardápio vazio</p>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
            Crie categorias (ex: Lanches, Bebidas) e adicione seus produtos.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => setModalCat(true)} className="btn-ghost">+ Criar categoria</button>
            <button onClick={abrirNovoProduto} className="btn-primary">+ Adicionar produto</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {porCategoria.map(({ cat, items }) => (
            <div key={cat.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                {cat.foto_url
                  ? <img src={cat.foto_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F3F4F6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🛍️</div>
                }
                <h2 style={{ fontSize: 15, fontWeight: 900, color: "#111827", margin: 0 }}>{cat.nome}</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280" }}>
                  {items.length}
                </span>
                <input
                  type="file" accept="image/*" style={{ display: "none" }}
                  ref={el => { if (el) el.dataset.catId = cat.id }}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (file) await uploadFotoCategoria(cat.id, file)
                    e.target.value = ""
                  }}
                  id={`cat-foto-${cat.id}`}
                />
                <label htmlFor={`cat-foto-${cat.id}`}
                  style={{ fontSize: 12, color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 10px" }}>
                  {uploadingCatId === cat.id ? "⏳" : "📷"} {cat.foto_url ? "Trocar foto" : "Adicionar foto"}
                </label>
                <button onClick={() => deletarCategoria(cat.id)}
                  style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
                  Deletar
                </button>
              </div>
              {items.length === 0 ? (
                <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum produto nesta categoria.</p>
              ) : (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {items.map(p => <ProdutoCard key={p.id} p={p} onEdit={abrirEditarProduto} onToggle={toggleDisponivel} onDelete={deletarProduto} />)}
                </div>
              )}
            </div>
          ))}

          {semCategoria.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 900, color: "#111827", margin: 0 }}>Sem categoria</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280" }}>
                  {semCategoria.length}
                </span>
              </div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                {semCategoria.map(p => <ProdutoCard key={p.id} p={p} onEdit={abrirEditarProduto} onToggle={toggleDisponivel} onDelete={deletarProduto} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo/Editar Produto */}
      {modalProd && (
        <Modal title={editando ? "Editar produto" : "Novo produto"} onClose={fecharModalProd}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Foto */}
            <div>
              <label className="label">Foto do produto</label>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 88, height: 88, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                  background: "#F3F4F6", border: "2px dashed #D1D5DB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {fotoPreview
                    ? <img src={fotoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 26, color: "#D1D5DB" }}>📷</span>}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      setFotoFile(f)
                      setFotoPreview(URL.createObjectURL(f))
                    }}
                  />
                  <button type="button" onClick={() => fotoInputRef.current?.click()}
                    className="btn-ghost" style={{ fontSize: 12, justifyContent: "center" }}>
                    {fotoPreview ? "📷 Trocar foto" : "📷 Adicionar foto"}
                  </button>
                  {fotoPreview && (
                    <button type="button"
                      onClick={() => { setFotoFile(null); setFotoPreview(""); setFormProd(f => ({ ...f, foto_url: "" })); if (fotoInputRef.current) fotoInputRef.current.value = "" }}
                      style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Remover foto
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: "#D1D5DB" }}>JPG, PNG ou WEBP · máx. 5MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Nome do produto *</label>
              <input className="input" placeholder="Ex: X-Burguer" value={formProd.nome}
                onChange={e => setFormProd(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea className="input" placeholder="Ingredientes, tamanho, diferenciais..." rows={3} value={formProd.descricao}
                onChange={e => setFormProd(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Preço (R$) *</label>
                <input className="input" type="number" step="0.50" min="0" placeholder="0,00" value={formProd.preco}
                  onChange={e => setFormProd(f => ({ ...f, preco: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={formProd.categoria_id}
                  onChange={e => setFormProd(f => ({ ...f, categoria_id: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div onClick={() => setFormProd(f => ({ ...f, disponivel: !f.disponivel }))}
                style={{ width: 40, height: 22, borderRadius: 11, transition: "background 0.2s", background: formProd.disponivel ? "#f97316" : "#E5E7EB", position: "relative", cursor: "pointer" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, transition: "left 0.2s", left: formProd.disponivel ? 20 : 2 }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                {formProd.disponivel ? "Disponível para pedidos" : "Indisponível (oculto no cardápio)"}
              </span>
            </label>

            {/* Dias da semana */}
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Dias disponíveis</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Deixe todos desmarcados para aparecer em todos os dias</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DIAS.map(d => {
                  const sel = formProd.dias_semana.includes(d.v)
                  return (
                    <button key={d.v} type="button"
                      onClick={() => setFormProd(f => ({
                        ...f,
                        dias_semana: sel ? f.dias_semana.filter(x => x !== d.v) : [...f.dias_semana, d.v],
                      }))}
                      style={{
                        padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                        border: sel ? "none" : "1.5px solid #E5E7EB",
                        background: sel ? "#f97316" : "transparent",
                        color: sel ? "#fff" : "#6B7280",
                        cursor: "pointer",
                      }}>
                      {d.l}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* NCM */}
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
              <label className="label">Código NCM <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(para nota fiscal)</span></label>
              <input
                className="input"
                value={formProd.ncm}
                onChange={e => setFormProd(f => ({ ...f, ncm: e.target.value }))}
                placeholder="Ex: 21069090 (alimentos preparados)"
                maxLength={10}
                inputMode="numeric"
                style={{ fontSize: 14 }}
              />
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                Restaurantes: 21069090 · Bebidas: 22029000 · Deixe em branco se não souber
              </p>
            </div>

            {/* Adicionais */}
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 10 }}>Adicionais (opcional)</p>
              {adicionais.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {adicionais.map(a => (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px", borderRadius: 8, background: "#F9FAFB", border: "1px solid #E5E7EB",
                    }}>
                      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{a.nome}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, color: "#f97316", fontWeight: 700 }}>R$ {a.preco.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => setAdicionais(prev => prev.filter(x => x.id !== a.id))}
                          style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Ex: Extra queijo"
                  value={novoAdicNome}
                  onChange={e => setNovoAdicNome(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && adicionarAdicional()}
                  style={{ flex: 2, fontSize: 13 }}
                />
                <input
                  className="input"
                  type="number"
                  step="0.50"
                  min="0"
                  placeholder="R$"
                  value={novoAdicPreco}
                  onChange={e => setNovoAdicPreco(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && adicionarAdicional()}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={adicionarAdicional}
                  disabled={!novoAdicNome.trim() || !novoAdicPreco}
                  className="btn-primary"
                  style={{ fontSize: 13, padding: "0 12px", flexShrink: 0 }}>
                  +
                </button>
              </div>
            </div>

            {erroSalvar && (
              <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, background: "rgba(239,68,68,0.08)", padding: "10px 14px", borderRadius: 10 }}>
                ⚠️ {erroSalvar}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button onClick={fecharModalProd} className="btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={salvarProduto} disabled={salvando || !formProd.nome || !formProd.preco}
                className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                {salvando ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Nova Categoria */}
      {modalCat && (
        <Modal title="Nova categoria" onClose={() => { setModalCat(false); setErroSalvar("") }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="label">Nome da categoria</label>
              <input className="input" placeholder="Ex: Lanches, Bebidas, Pratos..." value={nomeCat}
                onChange={e => setNomeCat(e.target.value)}
                onKeyDown={e => e.key === "Enter" && salvarCategoria()} autoFocus />
            </div>
            {erroSalvar && (
              <p style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, background: "rgba(239,68,68,0.08)", padding: "10px 14px", borderRadius: 10 }}>
                ⚠️ {erroSalvar}
              </p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModalCat(false); setErroSalvar("") }} className="btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={salvarCategoria} disabled={salvando || !nomeCat.trim()}
                className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                {salvando ? "Salvando..." : "Criar categoria"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ProdutoCard({ p, onEdit, onToggle, onDelete }: {
  p: Produto
  onEdit: (p: Produto) => void
  onToggle: (p: Produto) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="card" style={{ opacity: p.disponivel ? 1 : 0.58, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {p.foto_url ? (
        <div style={{ width: "100%", height: 120, overflow: "hidden" }}>
          <img src={p.foto_url} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div style={{ width: "100%", height: 70, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 26, color: "#D1D5DB" }}>📷</span>
        </div>
      )}

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</p>
            {p.descricao && (
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                {p.descricao}
              </p>
            )}
            {p.dias_semana && p.dias_semana.length > 0 && (
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
                📅 {DIAS.filter(d => p.dias_semana!.includes(d.v)).map(d => d.l).join(" · ")}
              </p>
            )}
          </div>
          <p style={{ fontSize: 15, fontWeight: 900, color: "#f97316", flexShrink: 0 }}>
            R$ {p.preco.toFixed(2).replace(".", ",")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => onToggle(p)} style={{
            flex: 1, fontSize: 11, fontWeight: 700, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer",
            background: p.disponivel ? "rgba(34,197,94,0.1)" : "#F3F4F6",
            color: p.disponivel ? "#22c55e" : "#9CA3AF",
          }}>
            {p.disponivel ? "✓ Disponível" : "✗ Indisponível"}
          </button>
          <button onClick={() => onEdit(p)} className="btn-ghost" style={{ fontSize: 12, padding: "7px 10px" }}>
            Editar
          </button>
          <button onClick={() => onDelete(p.id)} style={{ padding: "7px 10px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0, overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: "100%", maxWidth: "min(520px, 100vw)", margin: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: "20px 16px 32px", maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <p style={{ fontWeight: 900, fontSize: 16, color: "#111827", margin: 0 }}>{title}</p>
          <button onClick={onClose} style={{ color: "#9CA3AF", fontSize: 20, lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}