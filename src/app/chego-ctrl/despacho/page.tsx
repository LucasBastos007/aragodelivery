import { redirect } from "next/navigation"

// Despacho virou uma aba do Ao vivo (admin 2.0, 20/10/2026). O endereço antigo continua valendo.
export default function DespachoPage() { redirect("/chego-ctrl/ao-vivo?aba=despacho") }
