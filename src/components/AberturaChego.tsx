"use client"

// Abertura do app do cliente (layout novo aprovado pelo Lucas em 19/10/2026): fundo preto,
// um celular mostra alguém rolando os pratos, finalizando no Pix e o pedido marcado como
// entregue; termina com a logo do Chegô. Toca a mesma música do app (/splash.mp3). Navegador
// bloqueia som antes do 1º toque: se bloquear, toca no primeiro toque na tela.

import { useEffect, useRef, useState } from "react"

const PRATOS = [
  { n: "Prato Executivo", loja: "Petiscaria Tábua dos Sabores", p: 22.99, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/produtos/29f50d38-c46f-4274-81c4-9ab3cc1413e9/1786399705225.jpeg" },
  { n: "Copo de Açaí", loja: "Trilhas da Amazônia", p: 24, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/produtos/0c33fd72-1a5a-48bd-bf9a-dceaae1d500f/26a31e16-164b-4842-bd6b-4e2e08b3a5a1.png" },
  { n: "Misto tudo", loja: "Padaria Flor de Ipê", p: 18, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/produtos/17599fdf-9fc6-4796-93cc-7a985121f129/ee9b9da5-9091-4f05-9975-3577db30b567.jpg" },
  { n: "Prato do Dia", loja: "Armazém Gastrobar", p: 18.9, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/entregas/produtos/73d8672b-595b-4c08-8115-b57d508a5320/1792245420212.jpeg" },
  { n: "Gunkan Saint Peter", loja: "Sushi Biscuit", p: 19.73, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/produtos/c4f7b62b-bf2c-4c4d-9118-2b309902d648/1788822624047.webp" },
  { n: "Monte seu Macarrão", loja: "Macarrão da Poly", p: 25, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/produtos/294d456a-2eef-416b-9165-9c9b14096c01/monte-seu-macarrao.jpeg" },
  { n: "X Salada Simples", loja: "Quintal Gastrobar", p: 22, f: "https://vgnqyalxqhgtlfbitpwx.supabase.co/storage/v1/object/public/produtos/6b85b3d8-2de0-4897-832a-786228ae5703/fe2bcbaf-685a-4c11-82ae-a98172144464.jpeg" },
]
const R = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const DURACAO_MS = 8200

export default function AberturaChego({ onFim }: { onFim: () => void }) {
  const [mudo, setMudo] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const fim = useRef(false)
  const escolhido = PRATOS[3]

  function terminar() {
    if (fim.current) return
    fim.current = true
    audio.current?.pause()
    setSaindo(true)
    setTimeout(onFim, 400)
  }

  useEffect(() => {
    const a = new Audio("/splash.mp3"); a.volume = 0.85; audio.current = a
    const tocarNoToque = () => { if (!fim.current && !a.muted) a.play().catch(() => {}) }
    a.play().catch(() => document.addEventListener("pointerdown", tocarNoToque, { once: true, capture: true }))
    const t = setTimeout(terminar, DURACAO_MS)
    return () => { clearTimeout(t); a.pause(); document.removeEventListener("pointerdown", tocarNoToque, true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function alternarSom() {
    const a = audio.current; if (!a) return
    const m = !mudo; setMudo(m); a.muted = m
    if (!m && a.paused) a.play().catch(() => {})
  }

  return (
    <div className="ab4" style={{ opacity: saindo ? 0 : 1 }} aria-label="Abertura: alguém pede pelo celular, finaliza e recebe o pedido">
      <button className="ab4-som" onClick={alternarSom} aria-label="Ligar ou desligar o som">{mudo ? "🔇" : "🔊"}</button>
      <button className="ab4-pular" onClick={terminar}>Pular</button>
      <div className="ab4-cel"><div className="ab4-notch" /><div className="ab4-vidro">
        <div className="ab4-t t1"><div className="ab4-cab"><b>Pra matar a fome</b><small>Mais pedidos hoje</small></div>
          <div className="ab4-rolo">{PRATOS.map(p => (
            <div className="ab4-card" key={p.n}><img src={p.f} alt="" /><div><b>{p.n}</b><small>{p.loja}</small><span>{R(p.p)}</span></div></div>
          ))}</div><i className="ab4-dedo d1" /></div>
        <div className="ab4-t t2"><div className="ab4-cab"><b>Finalizar pedido</b><small>{escolhido.loja}</small></div>
          <div className="ab4-item"><img src={escolhido.f} alt="" /><div><b>1× {escolhido.n}</b><span>{R(escolhido.p)}</span></div></div>
          <div className="ab4-lin"><span>Entrega</span><span>{R(5)}</span></div><div className="ab4-lin tot"><span>Total</span><span>{R(escolhido.p + 5)}</span></div>
          <div className="ab4-pag">◆ Pix</div><div className="ab4-btn">Fazer pedido</div><i className="ab4-dedo d2" /></div>
        <div className="ab4-t t3"><div className="ab4-cab"><b>Acompanhar</b><small>Pedido #4821</small></div>
          <ol className="ab4-passos"><li className="p1">Pedido confirmado</li><li className="p2">Preparando</li><li className="p3">Saiu para entrega</li><li className="p4">Entregue</li></ol>
          <div className="ab4-estrada"><span className="ab4-moto"><b>🛵</b></span></div>
          <div className="ab4-ok"><i>✓</i><b>Pedido entregue!</b><small>Bom apetite 😋</small></div></div>
      </div></div>
      <div className="ab4-fim"><img src="/logo-chego-transparente.png" alt="Chegô" /><p>Pediu, Chegô.</p></div>
      <div className="ab4-barra"><i /></div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.ab4{position:fixed;inset:0;z-index:9999;background:#000;overflow:hidden;display:grid;place-items:center;transition:opacity .4s;font-family:var(--font-corpo),system-ui,sans-serif}
.ab4-cel{width:min(62vw,236px);aspect-ratio:236/484;border-radius:38px;background:#111;padding:9px;box-shadow:0 0 0 2px #2a2a2a,0 30px 80px rgba(215,38,30,.18);position:relative;animation:ab4entra .8s cubic-bezier(.2,.8,.2,1) both,ab4sai .7s 6.3s cubic-bezier(.6,0,.4,1) both}
@keyframes ab4entra{from{transform:translateY(60px) scale(.92);opacity:0}}
@keyframes ab4sai{to{transform:scale(.55);opacity:0;filter:blur(6px)}}
.ab4-notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:62px;height:17px;border-radius:10px;background:#000;z-index:5}
.ab4-vidro{position:relative;width:100%;height:100%;border-radius:30px;overflow:hidden;background:#F2F2EF}
.ab4-t{position:absolute;inset:0;padding:36px 11px 11px;background:#F2F2EF}
.ab4-t.t2{transform:translateX(100%);z-index:3;animation:ab4tela .45s 2.75s cubic-bezier(.2,.8,.2,1) both}
.ab4-t.t3{transform:translateX(100%);z-index:4;animation:ab4tela .45s 4s cubic-bezier(.2,.8,.2,1) both}
@keyframes ab4tela{to{transform:none}}
.ab4-cab{position:relative;z-index:2;background:#F2F2EF;margin:-36px -11px 8px;padding:36px 11px 8px}
.ab4-cab b{display:block;font-family:var(--font-display),system-ui,sans-serif;font-weight:800;font-size:15px;color:#22201C}
.ab4-cab small{font-size:10px;color:#77736B}
.ab4-rolo{display:flex;flex-direction:column;gap:7px;animation:ab4rola 1.8s .7s cubic-bezier(.45,.05,.3,1) both}
@keyframes ab4rola{to{transform:translateY(-190px)}}
.ab4-card{display:flex;gap:8px;background:#fff;border-radius:12px;padding:6px;align-items:center;box-shadow:0 1px 2px rgba(34,32,28,.06)}
.ab4-card img{width:52px;height:52px;border-radius:9px;object-fit:cover;flex-shrink:0}
.ab4-card b{font-size:10.5px;line-height:1.2;color:#22201C;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ab4-card small{display:block;font-size:9px;color:#77736B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ab4-card span{font-weight:700;font-size:11px;color:#22201C}
.ab4-card:nth-child(4){animation:ab4toque .35s 2.45s both}
@keyframes ab4toque{50%{transform:scale(.95);background:#FDECEB}}
.ab4-dedo{position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 0 0 2px rgba(0,0,0,.15);opacity:0;pointer-events:none}
.ab4-dedo.d1{left:45%;top:52%;animation:ab4dedo .6s 2.3s both}
.ab4-dedo.d2{left:44%;bottom:22px;animation:ab4dedo .6s 3.45s both}
@keyframes ab4dedo{0%{opacity:0;transform:scale(1.5)}40%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1)}}
.ab4-item{display:flex;gap:8px;align-items:center;background:#fff;border-radius:12px;padding:7px;margin-bottom:10px}
.ab4-item img{width:46px;height:46px;border-radius:9px;object-fit:cover}
.ab4-item b{display:block;font-size:10.5px;color:#22201C}
.ab4-item span{font-size:10.5px;font-weight:700}
.ab4-lin{display:flex;justify-content:space-between;font-size:10.5px;padding:3px 2px;color:#3D3A35}
.ab4-lin.tot{font-weight:800;color:#22201C;font-size:12px;border-top:1px solid #E6E5E1;margin-top:4px;padding-top:7px}
.ab4-pag{background:#fff;border:1.5px solid #22201C;border-radius:10px;padding:8px;font-size:11px;font-weight:700;margin-top:10px;color:#32BCAD}
.ab4-btn{position:absolute;left:11px;right:11px;bottom:14px;height:38px;border-radius:12px;background:#D7261E;color:#fff;font-weight:700;font-size:12px;display:grid;place-items:center;animation:ab4aperta .3s 3.6s both}
@keyframes ab4aperta{50%{transform:scale(.95);background:#B01D16}}
.ab4-passos{list-style:none;margin:6px 0 0;padding:0}
.ab4-passos li{position:relative;padding:0 0 15px 22px;font-size:11px;color:#77736B;font-weight:600}
.ab4-passos li::before{content:"";position:absolute;left:0;top:1px;width:12px;height:12px;border-radius:50%;border:2px solid #E6E5E1;background:#fff;box-sizing:border-box}
.ab4-passos .p1{animation:ab4passo .3s 4.45s both}.ab4-passos .p1::before{animation:ab4bola .3s 4.45s both}
.ab4-passos .p2{animation:ab4passo .3s 4.8s both}.ab4-passos .p2::before{animation:ab4bola .3s 4.8s both}
.ab4-passos .p3{animation:ab4passo .3s 5.1s both}.ab4-passos .p3::before{animation:ab4bola .3s 5.1s both}
.ab4-passos .p4{animation:ab4passo .3s 5.6s both}.ab4-passos .p4::before{animation:ab4bola .3s 5.6s both}
@keyframes ab4passo{to{color:#22201C}}
@keyframes ab4bola{to{background:#1E8A4C;border-color:#1E8A4C}}
.ab4-estrada{position:relative;height:26px;margin:2px 4px 0;border-bottom:2px dashed #E6E5E1}
.ab4-moto{position:absolute;bottom:2px;left:0;width:24px;height:24px;animation:ab4moto .55s 5.1s ease-in-out both}
.ab4-moto b{display:block;font-size:20px;line-height:24px;transform:scaleX(-1)}
@keyframes ab4moto{to{left:calc(100% - 24px)}}
.ab4-ok{position:absolute;left:11px;right:11px;bottom:16px;background:#E6F4EC;border-radius:14px;padding:12px;text-align:center;opacity:0;animation:ab4pop .45s 5.7s cubic-bezier(.3,1.6,.5,1) both}
.ab4-ok i{display:grid;place-items:center;width:34px;height:34px;margin:0 auto 6px;border-radius:50%;background:#1E8A4C;color:#fff;font-style:normal;font-weight:800;font-size:18px}
.ab4-ok b{display:block;font-weight:800;color:#1E8A4C;font-size:14px}
.ab4-ok small{font-size:10.5px;color:#3D3A35}
@keyframes ab4pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.ab4-fim{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.ab4-fim img{width:min(66vw,260px);opacity:0;animation:ab4logo .9s 6.75s both}
@keyframes ab4logo{from{opacity:0;transform:scale(.86);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
.ab4-fim p{margin-top:14px;color:#fff;font-family:var(--font-display),system-ui,sans-serif;font-weight:700;font-size:18px;opacity:0;animation:ab4sobe .5s 7.3s both}
@keyframes ab4sobe{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}
.ab4-barra{position:absolute;left:24px;right:24px;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
.ab4-barra i{display:block;height:100%;width:0;background:#D7261E;animation:ab4barra 8s linear both}
@keyframes ab4barra{to{width:100%}}
.ab4-pular{position:absolute;right:16px;top:calc(env(safe-area-inset-top,0px) + 16px);z-index:5;background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer}
.ab4-som{position:absolute;right:92px;top:calc(env(safe-area-inset-top,0px) + 16px);z-index:5;width:34px;height:31px;background:rgba(255,255,255,.14);border:0;border-radius:999px;font-size:14px;cursor:pointer}
@media (prefers-reduced-motion:reduce){.ab4 *{animation-duration:.01s!important;animation-delay:0s!important}}
`
