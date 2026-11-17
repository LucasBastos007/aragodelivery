"use client"
import { useEffect } from "react"

// Link das notificações e do banner da live: leva pro Instagram do Chegô.
// Se o celular não sair do app sozinho, o botão abre o Instagram.
const INSTA = "https://www.instagram.com/appchegodelivery/"

export default function Live() {
  useEffect(() => { window.location.href = INSTA }, [])
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center", background: "#16234A", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <img src="/logo-chego.png" alt="Chegô" style={{ width: 120, height: 120, borderRadius: 24, background: "#fff" }} />
      <h1 style={{ fontSize: 24, margin: 0 }}>Live do Chegô no Instagram</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>Sorteio e brinde ao vivo, às 20h30.</p>
      <a href={INSTA} target="_blank" rel="noopener noreferrer" style={{ background: "linear-gradient(45deg,#fd5949,#d6249f,#285AEB)", color: "#fff", fontWeight: 800, fontSize: 18, padding: "16px 26px", borderRadius: 14, textDecoration: "none" }}>Abrir o Instagram do Chegô</a>
      <a href="/" style={{ color: "#fff", opacity: 0.75, fontSize: 15 }}>Voltar pro app</a>
    </main>
  )
}
