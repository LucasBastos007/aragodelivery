export function maskCPF(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

export function maskCNPJ(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

export function maskCEP(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2")
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11)
  if (d.length <= 10)
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2")
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2")
}

export function maskPlaca(v: string): string {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7)
  if (raw.length > 3) return raw.slice(0, 3) + "-" + raw.slice(3)
  return raw
}

export function maskConta(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 6)
  if (d.length <= 5) return d
  return d.slice(0, 5) + "-" + d.slice(5)
}

export function maskCurrency(v: string): string {
  const digits = v.replace(/\D/g, "")
  if (!digits) return ""
  const num = parseInt(digits) / 100
  return (
    "R$ " +
    num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}
