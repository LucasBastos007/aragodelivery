// Dudu Lanches sempre em último lugar nas listas de lojas do cliente (pedido do Lucas, 05/11/2026).
// Só a loja "Dudu Lanches"; "Marmitas do Dudu lanches" segue a ordem normal.
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()
export const ehSempreUltima = (l: { nome: string }) => semAcento(l.nome) === "dudu lanches"
// Fica no fim do próprio grupo: última das abertas quando está aberta, última das fechadas
// quando está fechada (antes ia pro fim da lista toda, abaixo até das fechadas).
export function ultimaPorUltimo<T extends { nome: string; aberto?: boolean | null }>(lista: T[]): T[] {
  const resto = lista.filter(l => !ehSempreUltima(l))
  for (const d of lista.filter(ehSempreUltima)) {
    let i = -1
    resto.forEach((l, j) => { if (!!l.aberto === !!d.aberto) i = j })
    resto.splice(i >= 0 ? i + 1 : d.aberto ? 0 : resto.length, 0, d)
  }
  return resto
}
