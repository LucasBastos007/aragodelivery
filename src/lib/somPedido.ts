"use client"

// Som de novo pedido do painel do lojista — compartilhado entre o layout (alarme
// em qualquer tela de /loja) e a tela de Pedidos. O navegador só libera áudio
// depois de um clique/tecla do usuário; até lá `somLiberado()` fica false e o
// layout mostra o aviso "Clique para ativar o som".

let _ctx: AudioContext | null = null
let _el: HTMLAudioElement | null = null
let _liberado = false
const _ouvintes = new Set<(v: boolean) => void>()

function setLiberado(v: boolean) {
  if (_liberado === v) return
  _liberado = v
  _ouvintes.forEach(fn => fn(v))
}

export function somLiberado() { return _liberado }

export function onSomLiberado(fn: (v: boolean) => void) {
  _ouvintes.add(fn)
  return () => { _ouvintes.delete(fn) }
}

function getCtx(): AudioContext | null {
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {})
    return _ctx
  } catch { return null }
}

// Tenta liberar o áudio. Chamado em todo clique/tecla até dar certo, e também
// sem gesto ao abrir a página (o Chrome libera direto em sites muito usados).
export function liberarSom(): Promise<boolean> {
  if (_liberado) return Promise.resolve(true)
  const ctx = getCtx()
  const audio = new Audio("/splash.mp3")
  audio.preload = "auto"
  audio.volume = 0.001
  return audio.play()
    .then(() => {
      audio.pause(); audio.currentTime = 0
      _el = audio
      setLiberado(true)
      return true
    })
    .catch(() => {
      if (ctx?.state === "running") { setLiberado(true); return true }
      return false
    })
}

function tocaWebAudio() {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const play = (freq: number, start: number, dur: number, vol = 0.5) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = "sine"
      o.frequency.value = freq
      g.gain.setValueAtTime(vol, ctx.currentTime + start)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      o.start(ctx.currentTime + start)
      o.stop(ctx.currentTime + start + dur + 0.05)
    }
    play(1047, 0,    0.3, 0.5)
    play(784,  0.35, 0.4, 0.4)
    play(1047, 0.75, 0.3, 0.3)
  } catch {}
}

let _ultimoToque = 0
export function tocaSomPedido() {
  // Evita som sobreposto quando layout e tela de Pedidos disparam juntos
  const agora = Date.now()
  if (agora - _ultimoToque < 2500) return
  _ultimoToque = agora
  try {
    const el = _el ?? new Audio("/splash.mp3")
    el.currentTime = 0
    el.volume = 0.9
    el.play()
      .then(() => { _el = el; setLiberado(true) })
      .catch(() => { setLiberado(false); tocaWebAudio() })
  } catch { tocaWebAudio() }
}
