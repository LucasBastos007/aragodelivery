"use client"

// Equipe e segurança (admin 2.0, 20/10/2026): quem entra no painel, quem recebe os relatórios,
// o que roda sozinho e como está a proteção dos dados. Só leitura (/api/admin/equipe).
import { useEffect, useState } from "react"

type D = { admin: string | null; fechamento: string[]; senhasTexto: { motoboys: string[]; lojas: number }; totais: { motoboys: number; lojas: number } }
const ROTINAS: [string, string, string][] = [
  ["A cada 2 minutos", "Cancela pedido com Pix não pago", "Pedido que ficou esperando pagamento demais é cancelado e some da fila."],
  ["A cada 10 minutos", "Monitora a saúde do app", "Se algo para de funcionar, chega um e-mail de alerta."],
  ["Todo dia, 23h59", "Fechamento diário", "Vendas, quem recebeu o quê e o saldo, por e-mail."],
  ["Todo dia, 3h", "Confere mensalidades", "Bloqueia a loja com 4 dias de atraso."],
  ["Toda sexta, 9h", "Relatório semanal", "Resumo da semana por e-mail."],
  ["Todo dia 1º, 9h", "Relatório de clientes", "Clientes novos e quem voltou no mês."],
]
const PROTECAO: [boolean, string, string][] = [
  [true, "Ninguém de fora grava no banco", "Escrita só pelo servidor do Chegô, com login de admin, loja ou motoboy (fase 1, 19/10)."],
  [true, "Cofre de chaves fechado", "Certificados e tokens fiscais ficam no cofre, sem acesso público."],
  [true, "Comprovantes em pasta privada", "Cada comprovante abre por um link que vale 2 minutos."],
  [false, "Esconder CPF, Pix, banco e senha das leituras", "Fase 2: hoje ainda dá pra ler esses campos com a chave pública do app. É o próximo passo de segurança."],
]

export default function EquipePage() {
  const [d, setD] = useState<D | null>(null), [erro, setErro] = useState("")
  useEffect(() => { fetch("/api/admin/equipe", { credentials: "include" }).then(r => r.ok ? r.json() : Promise.reject()).then(setD).catch(() => setErro("Não foi possível carregar.")) }, [])
  if (!d) return <p className="mut">{erro || "Carregando…"}</p>
  const pend = d.senhasTexto.motoboys.length + d.senhasTexto.lojas
  return (
    <div className="eq">
      <div className="cartao eq-sec">
        <b className="t16b">Quem entra no painel</b>
        <div className="lj-dado"><span>Conta de admin</span><b>{d.admin ?? "não configurada"}</b></div>
        <p className="t14 mut">Uma conta só, com a senha guardada embaralhada no servidor. Pra trocar a senha ou dar acesso a mais alguém, o ajuste é no servidor (peça pro Claude).</p>
      </div>
      <div className="cartao eq-sec">
        <b className="t16b">Quem recebe o fechamento diário</b>
        {d.fechamento.map(e => <div key={e} className="lj-dado"><span>E-mail</span><b>{e}</b></div>)}
      </div>
      <div className="cartao eq-sec">
        <b className="t16b">O que roda sozinho</b>
        {ROTINAS.map(([q, n, t]) => <div key={n} className="eq-rot"><span className="selo cinza">{q}</span><span><b>{n}</b><small>{t}</small></span></div>)}
      </div>
      <div className="cartao eq-sec">
        <b className="t16b">Proteção dos dados</b>
        {PROTECAO.map(([ok, n, t]) => <div key={n} className="eq-rot"><span className={`eq-ok ${ok ? "sim" : "nao"}`}>{ok ? "✓" : "!"}</span><span><b>{n}</b><small>{t}</small></span></div>)}
        <div className="eq-rot"><span className={`eq-ok ${pend ? "nao" : "sim"}`}>{pend ? "!" : "✓"}</span><span><b>{pend ? `${pend} senha${pend > 1 ? "s" : ""} sem embaralhar` : "Todas as senhas embaralhadas"}</b>
          <small>{pend ? `Motoboys: ${d.senhasTexto.motoboys.join(", ") || "nenhum"}${d.senhasTexto.lojas ? `; ${d.senhasTexto.lojas} loja(s)` : ""}. Some quando eles trocarem a senha ou o Claude converter.` : `${d.totais.motoboys} motoboys e ${d.totais.lojas} lojas com senha protegida.`}</small></span></div>
      </div>
    </div>
  )
}
