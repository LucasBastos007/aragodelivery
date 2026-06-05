"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import type { Produto, CategoriaProduto } from "@/types"

type ProdutoForm = {
  nome: string
  descricao: string
  preco: string
  categoria_id: string
  disponivel: boolean
  foto_url: string
}
const FORM_VAZIO: ProdutoForm = { nome: "", descricao: "", preco: "", categoria_id: "", disponivel: true, foto_url: "" }

async function uploadFoto(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("imagens")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error || !data) return ""
  const { data: { publicUrl } } = supabase.storage.from("imagens").getPublicUrl(data.path)
  return publicUrl
}

export default function CardapioPage() {
  const { sessao } = useAuth()
  const lojaId = sessao?.role === "lojista" ? sessao.loja_id : null

  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtos, setProdutos]     = useState<Produto[]>([])
  const [loading, setLoading]       = useState(true)

  const [modalProd, setModalProd]   = useState(false)
  const [modalCat, setModalCat]     = useState(false)
  const [editando, setEditando]     = useState<Produto | null>(null)
  const [formProd, setFormProd]     = useState<ProdutoForm>(FORM_VAZIO)
  const [fotoFile, setFotoFile]     = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>("")
  const [nomeCat, setNomeCat]       = useState("")
  const [salvando, setSalvando]     = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

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

  // ── Categorias ──────────────────────────────────────────────────────────
  async function salvarCategoria() {
    if (!nomeCat.trim() || !lojaId) return
    setSalvando(true)
    await supabase.from("categorias_produto").insert({
      loja_id: lojaId,
      nome: nomeCat.trim(),
      ordem: categorias.length,
    })
    setNomeCat(""); setModalCat(false)
    await carregarTudo()
    setSalvando(false)
  }

  async function deletarCategoria(id: string) {
    if (!confirm("Deletar categoria? Os produtos desta categoria ficarão sem categoria.")) return
    await supabase.from("categorias_produto").delete().eq("id", id)
    await carregarTudo()
  }

  // ── Produtos ────────────────────────────────────────────────────────────
  function abrirNovoProduto() {
    setEditando(null)
    setFormProd(FORM_VAZIO)
    setFotoFile(null)
    setFotoPreview("")
    setModalProd(true)
  }

  function abrirEditarProduto(p: Produto) {
    setEditando(p)
    setFormProd({
      nome: p.nome,
      descricao: p.descricao,
      preco: p.preco.toFixed(2),
      categoria_id: p.categoria_id ?? "",
      disponivel: p.disponivel,
      foto_url: p.foto_url ?? "",
    })
    setFotoFile(null)
    setFotoPreview(p.foto_url ?? "")
    setModalProd(true)
  }

  function fecharModalProd() {
    setModalProd(false)
    setFotoFile(null)
    setFotoPreview("")
  }

  async function salvarProduto() {
    if (!formProd.nome.trim() || !formProd.preco || !lojaId) return
    setSalvando(true)

    let fotoUrlFinal = formProd.foto_url
    if (fotoFile) {
      const path = `produtos/${lojaId}/${Date.now()}_${fotoFile.name.replace(/\s+/g, "_")}`
      fotoUrlFinal = await uploadFoto(fotoFile, path)
    }

    const dados = {
      loja_id:      lojaId,
      nome:         formProd.nome.trim(),
      descricao:    formProd.descricao.trim(),
      preco:        parseFloat(formProd.preco),
      categoria_id: formProd.categoria_id || null,
      disponivel:   formProd.disponivel,
      foto_url:     fotoUrlFinal || null,
    }
    if (editando) {
      await supabase.from("produtos").update(dados).eq("id", editando.id)
    } else {
      await supabase.from("produtos").insert(dados)
    }
    fecharModalProd(); setEditando(null); setFormProd(FORM_VAZIO)
    await carregarTudo()
    setSalvando(false)
  }

  async function toggleDisponivel(p: Produto) {
    await supabase.from("produtos").update({ disponivel: !p.disponivel }).eq("id", p.id)
    await carregarTudo()
  }

  async function deletarProduto(id: string) {
    if (!confirm("Deletar este produto?")) return
    await supabase.from("produtos").delete().eq("id", id)
    await carregarTudo()
  }

  const semCategoria = produtos.filter(p => !p.categoria_id)
  const porCategoria = categorias.map(c => ({
    cat: c,
    items: produtos.filter(p => p.categoria_id === c.id),
  }))

  if (!lojaId) return null

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Cardápio</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {produtos.length} produto{produtos.length !== 1 ? "s" : ""} · {categorias.length} categoria{categorias.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setModalCat(true)} className="btn-ghost" style={{ fontSize: 13 }}>
            + Categoria
          </button>
          <button onClick={abrirNovoProduto} className="btn-primary">
            + Adicionar produto
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Carregando...</p>
      ) : produtos.length === 0 && categorias.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🍽️</p>
          <p className="text-lg font-black text-white mb-2">Cardápio vazio</p>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.38)" }}>
            Crie categorias (ex: Lanches, Bebidas) e adicione seus produtos.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setModalCat(true)} className="btn-ghost">+ Criar categoria</button>
            <button onClick={abrirNovoProduto} className="btn-primary">+ Adicionar produto</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {porCategoria.map(({ cat, items }) => (
            <div key={cat.id}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-black text-white">{cat.nome}</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                  {items.length}
                </span>
                <button onClick={() => deletarCategoria(cat.id)}
                  className="text-xs ml-auto"
                  style={{ color: "rgba(255,255,255,0.2)" }}>
                  Deletar categoria
                </button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>Nenhum produto nesta categoria.</p>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {items.map(p => <ProdutoCard key={p.id} p={p} onEdit={abrirEditarProduto} onToggle={toggleDisponivel} onDelete={deletarProduto} />)}
                </div>
              )}
            </div>
          ))}

          {semCategoria.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-base font-black text-white">Sem categoria</h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                  {semCategoria.length}
                </span>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {semCategoria.map(p => <ProdutoCard key={p.id} p={p} onEdit={abrirEditarProduto} onToggle={toggleDisponivel} onDelete={deletarProduto} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Novo/Editar Produto ── */}
      {modalProd && (
        <Modal title={editando ? "Editar produto" : "Novo produto"} onClose={fecharModalProd}>
          <div className="flex flex-col gap-4">

            {/* Foto */}
            <div>
              <label className="label">Foto do produto</label>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 90, height: 90, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                  background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 28, color: "rgba(255,255,255,0.15)" }}>📷</span>
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
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
                      onClick={() => {
                        setFotoFile(null)
                        setFotoPreview("")
                        setFormProd(f => ({ ...f, foto_url: "" }))
                        if (fotoInputRef.current) fotoInputRef.current.value = ""
                      }}
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Remover foto
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>JPG, PNG ou WEBP · recomendado 400×400px</p>
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
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label className="label">Preço (R$) *</label>
                <input className="input" type="number" step="0.50" min="0" placeholder="0,00" value={formProd.preco}
                  onChange={e => setFormProd(f => ({ ...f, preco: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Categoria</label>
                <select className="input" value={formProd.categoria_id}
                  onChange={e => setFormProd(f => ({ ...f, categoria_id: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setFormProd(f => ({ ...f, disponivel: !f.disponivel }))}
                style={{
                  width: 40, height: 22, borderRadius: 11, transition: "background 0.2s",
                  background: formProd.disponivel ? "#f97316" : "rgba(255,255,255,0.1)",
                  position: "relative", cursor: "pointer",
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, transition: "left 0.2s",
                  left: formProd.disponivel ? 20 : 2,
                }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                {formProd.disponivel ? "Disponível para pedidos" : "Indisponível (oculto no cardápio)"}
              </span>
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={fecharModalProd} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={salvarProduto} disabled={salvando || !formProd.nome || !formProd.preco}
                className="btn-primary flex-1 justify-center">
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Adicionar produto"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Nova Categoria ── */}
      {modalCat && (
        <Modal title="Nova categoria" onClose={() => setModalCat(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Nome da categoria</label>
              <input className="input" placeholder="Ex: Lanches, Bebidas, Pratos..." value={nomeCat}
                onChange={e => setNomeCat(e.target.value)}
                onKeyDown={e => e.key === "Enter" && salvarCategoria()} autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalCat(false)} className="btn-ghost flex-1 justify-center">Cancelar</button>
              <button onClick={salvarCategoria} disabled={salvando || !nomeCat.trim()}
                className="btn-primary flex-1 justify-center">
                {salvando ? "Salvando..." : "Criar categoria"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function ProdutoCard({ p, onEdit, onToggle, onDelete }: {
  p: Produto
  onEdit: (p: Produto) => void
  onToggle: (p: Produto) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="card flex flex-col" style={{ opacity: p.disponivel ? 1 : 0.55, overflow: "hidden" }}>
      {/* Foto */}
      {p.foto_url ? (
        <div style={{ width: "100%", height: 130, overflow: "hidden", flexShrink: 0 }}>
          <img src={p.foto_url} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <div style={{ width: "100%", height: 80, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 28, color: "rgba(255,255,255,0.08)" }}>📷</span>
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{p.nome}</p>
            {p.descricao && (
              <p className="text-xs mt-0.5 leading-relaxed"
                style={{ color: "rgba(255,255,255,0.38)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.descricao}
              </p>
            )}
          </div>
          <p className="text-base font-black flex-shrink-0" style={{ color: "#f97316" }}>
            R$ {p.preco.toFixed(2).replace(".", ",")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => onToggle(p)}
            className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg flex-1 justify-center"
            style={{
              background: p.disponivel ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
              color: p.disponivel ? "#22c55e" : "rgba(255,255,255,0.3)",
              border: p.disponivel ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.08)",
            }}>
            {p.disponivel ? "✓ Disponível" : "✕ Indisponível"}
          </button>
          <button onClick={() => onEdit(p)} className="btn-ghost" style={{ fontSize: 12, padding: "7px 12px" }}>
            Editar
          </button>
          <button onClick={() => onDelete(p.id)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      overflowY: "auto",
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card p-6 w-full" style={{ maxWidth: 480, margin: "auto" }}>
        <div className="flex items-center justify-between mb-5">
          <p className="font-black text-white text-lg">{title}</p>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
