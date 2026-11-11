// `produtos.ncm` guarda duas coisas: o NCM fiscal (só dígitos) e marcadores do cardápio
// ("destaque" = aparece nos destaques da loja, "almoco" = só das 11h às 14h). O campo
// "Código NCM" do formulário só mexe no NCM — o marcador não aparece nem se perde ao salvar.

const ehMarcador = (ncm: string | null | undefined) => !!ncm && !/\d/.test(ncm)

/** Valor que vai pro campo "Código NCM" do formulário (marcador fica escondido). */
export function ncmParaFormulario(ncm: string | null | undefined): string {
  return ehMarcador(ncm) ? "" : ncm ?? ""
}

/** Valor a gravar: o NCM digitado; sem NCM digitado, mantém o marcador que já existia. */
export function ncmAoSalvar(digitado: string, original: string | null | undefined): string | null {
  return digitado.replace(/\D/g, "") || (ehMarcador(original) ? original! : null)
}
