"use client"

// Escala no app do motoboy (03/11/2026): só leitura. Mostra a semana de todos, com os horários dele em destaque.
import EscalaSemana from "@/components/EscalaSemana"

export default function EscalaMotoboyPage() {
  return (
    <div className="mb-pagina">
      <h1 className="t28" style={{ marginBottom: 14 }}>Escala</h1>
      <EscalaSemana />
    </div>
  )
}
