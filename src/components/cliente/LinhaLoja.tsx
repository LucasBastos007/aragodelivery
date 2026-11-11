"use client"

// Linha de loja igual à proposta (Início, Busca, favoritas): dados corridos com "·" e o coração.
import { useEffect, useState } from "react"
import Link from "next/link"
import { brl } from "@/lib/precoExibicao"
import { lerFavoritas, alternarFavorita } from "@/lib/favoritas"

type L = { id: string; nome: string; logo_url?: string | null; aberto?: boolean | null; nota_media?: number | null; categoria?: string | null; cidade?: string | null; tempo_min?: number | null; tempo_max?: number | null; taxa_entrega?: number | null }

export function LinhaLoja({ l }: { l: L }) {
  const [fav, setFav] = useState(false)
  useEffect(() => { setFav(lerFavoritas().includes(l.id)) }, [l.id])
  const taxa = Number(l.taxa_entrega ?? 0)
  return (
    <Link className={`loja-l ${l.aberto ? "" : "fechada"}`} href={`/restaurante/${l.id}`}>
      {l.logo_url ? <img className="logo" src={l.logo_url} alt="" loading="lazy" /> : <span className="logo" />}
      <span className="info">
        <b>{l.nome}</b>
        <span className="meta">
          {l.nota_media ? <><span className="estrela">★</span> {Number(l.nota_media).toFixed(1).replace(".", ",")} · </> : ""}{l.categoria} · {l.cidade || "Aragoiânia"}{" "}
          {l.aberto ? `${l.tempo_min ?? 30}-${l.tempo_max ?? 50} min` : "Fechada agora"}
        </span>
      </span>
      <span role="button" tabIndex={0} className="fav" aria-label={fav ? "Tirar dos favoritos" : "Salvar nos favoritos"} aria-pressed={fav}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setFav(alternarFavorita(l.id)) }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill={fav ? "var(--pimenta)" : "none"} stroke={fav ? "var(--pimenta)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7.5-4.8-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.2 12 20 12 20z" /></svg>
      </span>
    </Link>
  )
}
