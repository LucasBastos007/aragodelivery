// Cálculo de períodos (Hoje/Semana/Mês/Personalizado) sempre no fuso de Brasília —
// nunca Date.getDay()/getHours() cru (AGENTS.md: a Vercel roda em UTC, o navegador do
// lojista pode estar em qualquer fuso). Reaproveita a técnica de offset fixo "-03:00"
// já usada em src/lib/relatorioDiario.ts::limitesDoDataYmdBrt (Brasil não tem mais
// horário de verão desde 2019, então -03:00 é seguro o ano inteiro).

const TZ = "America/Sao_Paulo"

export interface Periodo {
  inicioYmd: string
  fimYmd: string
  inicioUtc: string
  fimUtc: string
}

export function hojeYmdBrt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
}

/** Dia da semana (0=domingo..6=sábado, mesma convenção de Date.getDay()) e minutos
 *  desde meia-noite, AGORA, no fuso de Brasília — pra horário de funcionamento de loja/
 *  cardápio do dia. Nunca `new Date().getDay()`/`getHours()` cru (AGENTS.md). */
export function diaEMinutosAgoraBrt(): { diaSemana: number; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date())
  const mapa = Object.fromEntries(partes.map(p => [p.type, p.value])) as Record<string, string>
  const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { diaSemana: DIAS[mapa.weekday] ?? 0, minutos: Number(mapa.hour) * 60 + Number(mapa.minute) }
}

/** Hora (0-23) de um timestamp ISO, no fuso de Brasília. */
export function horaBrt(iso: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(iso)))
}

/** "YYYY-MM-DD" de um timestamp ISO, no fuso de Brasília. */
export function ymdBrt(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso))
}

export function limitesDoDiaBrt(ymd: string): [string, string] {
  return [new Date(`${ymd}T00:00:00-03:00`).toISOString(), new Date(`${ymd}T23:59:59.999-03:00`).toISOString()]
}

function addDiasYmd(ymd: string, dias: number): string {
  const [a, m, d] = ymd.split("-").map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dias)
  return dt.toISOString().slice(0, 10)
}

/** Dia da semana de um "YYYY-MM-DD", 0 = segunda .. 6 = domingo. */
export function diaSemanaYmd(ymd: string): number {
  const [a, m, d] = ymd.split("-").map(Number)
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay() // 0=dom..6=sáb
  return (dow + 6) % 7
}

function periodoDe(inicioYmd: string, fimYmd: string): Periodo {
  const [inicioUtc] = limitesDoDiaBrt(inicioYmd)
  const [, fimUtc] = limitesDoDiaBrt(fimYmd)
  return { inicioYmd, fimYmd, inicioUtc, fimUtc }
}

export function periodoHoje(): Periodo {
  const ymd = hojeYmdBrt()
  return periodoDe(ymd, ymd)
}

/** Mesmo dia da semana, 7 dias atrás — "vs. terça passada". */
export function periodoHojeAnterior(): Periodo {
  const ymd = addDiasYmd(hojeYmdBrt(), -7)
  return periodoDe(ymd, ymd)
}

/** Semana atual (segunda até hoje) — nunca inclui dias futuros. */
export function periodoSemana(): Periodo {
  const hoje = hojeYmdBrt()
  const inicioYmd = addDiasYmd(hoje, -diaSemanaYmd(hoje))
  return periodoDe(inicioYmd, hoje)
}

/** Semana anterior, cobrindo o mesmo número de dias já decorridos na semana atual —
 * comparar seg-qua desta semana com seg-qua da anterior, não a semana inteira, senão o
 * período anterior sempre pareceria "maior" só por ter mais dias completos. */
export function periodoSemanaAnterior(): Periodo {
  const hoje = hojeYmdBrt()
  const dow = diaSemanaYmd(hoje)
  const inicioSemanaAtual = addDiasYmd(hoje, -dow)
  const inicioYmd = addDiasYmd(inicioSemanaAtual, -7)
  const fimYmd = addDiasYmd(inicioYmd, dow)
  return periodoDe(inicioYmd, fimYmd)
}

/** Mês atual (dia 1 até hoje). */
export function periodoMes(): Periodo {
  const hoje = hojeYmdBrt()
  const inicioYmd = `${hoje.slice(0, 7)}-01`
  return periodoDe(inicioYmd, hoje)
}

/** Mês anterior, cobrindo até o mesmo dia (com clamp se o mês anterior for mais curto). */
export function periodoMesAnterior(): Periodo {
  const hoje = hojeYmdBrt()
  const [ano, mes, dia] = hoje.split("-").map(Number)
  const refMesAnterior = new Date(Date.UTC(ano, mes - 2, 1))
  const anoP = refMesAnterior.getUTCFullYear()
  const mesP = refMesAnterior.getUTCMonth() + 1
  const ultimoDiaMesP = new Date(Date.UTC(anoP, mesP, 0)).getUTCDate()
  const diaFim = Math.min(dia, ultimoDiaMesP)
  const inicioYmd = `${anoP}-${String(mesP).padStart(2, "0")}-01`
  const fimYmd = `${anoP}-${String(mesP).padStart(2, "0")}-${String(diaFim).padStart(2, "0")}`
  return periodoDe(inicioYmd, fimYmd)
}

export function periodoPersonalizado(inicioYmd: string, fimYmd: string): Periodo {
  return periodoDe(inicioYmd, fimYmd)
}

export type ChavePeriodo = "hoje" | "semana" | "mes" | "custom"

export function resolverPeriodo(chave: ChavePeriodo, customInicio?: string, customFim?: string): Periodo {
  if (chave === "hoje") return periodoHoje()
  if (chave === "semana") return periodoSemana()
  if (chave === "mes") return periodoMes()
  const hoje = hojeYmdBrt()
  return periodoPersonalizado(customInicio || hoje, customFim || hoje)
}

export function resolverPeriodoAnterior(chave: ChavePeriodo): Periodo | null {
  if (chave === "hoje") return periodoHojeAnterior()
  if (chave === "semana") return periodoSemanaAnterior()
  if (chave === "mes") return periodoMesAnterior()
  return null // personalizado não tem "período anterior" definido
}

export function labelComparacao(chave: ChavePeriodo): string {
  if (chave === "hoje") {
    const diaSemana = new Date(hojeYmdBrt() + "T12:00:00-03:00")
      .toLocaleDateString("pt-BR", { weekday: "long", timeZone: TZ })
    return `vs. ${diaSemana} passada`
  }
  if (chave === "semana") return "vs. semana anterior"
  if (chave === "mes") return "vs. mês anterior"
  return ""
}

export function variacaoPct(atual: number, anterior: number | null): number | null {
  if (anterior == null) return null
  if (anterior === 0) return atual > 0 ? 100 : null
  return ((atual - anterior) / anterior) * 100
}
