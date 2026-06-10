export function validateCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "")
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += +c[i] * (10 - i)
  let d1 = 11 - (sum % 11)
  if (d1 >= 10) d1 = 0
  if (d1 !== +c[9]) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += +c[i] * (11 - i)
  let d2 = 11 - (sum % 11)
  if (d2 >= 10) d2 = 0
  return d2 === +c[10]
}

export function validateCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, "")
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false
  const calc = (weights: number[]) => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) sum += +c[i] * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return (
    calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +c[12] &&
    calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === +c[13]
  )
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isAdult(dateStr: string): boolean {
  if (!dateStr) return false
  const dob = new Date(dateStr)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age >= 18
}
