import { NextResponse } from "next/server"

// Link das notificações de live (17/11/2026, pedido do Lucas): o envio de notificação só aceita
// telas do app, então /live leva direto pro Instagram do Chegô.
export function GET() {
  return NextResponse.redirect("https://www.instagram.com/appchegodelivery/", 302)
}
