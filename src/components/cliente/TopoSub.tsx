"use client"

// Topo das subtelas do Perfil no layout novo: botão redondo de voltar e o título.
import { useRouter } from "next/navigation"

export function TopoSub({ titulo, voltarPara = "/cliente/meu-perfil", direita }: { titulo: string; voltarPara?: string; direita?: React.ReactNode }) {
  const router = useRouter()
  return (
    <div className="topo branco">
      <div className="linha-topo">
        <button className="voltar" onClick={() => (window.history.length > 1 ? router.back() : router.push(voltarPara))} aria-label="Voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="h2" style={{ flex: 1, minWidth: 0 }}>{titulo}</span>
        {direita}
      </div>
    </div>
  )
}
