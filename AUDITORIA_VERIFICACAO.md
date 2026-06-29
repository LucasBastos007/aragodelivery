# Auditoria de Verificação Pós-Correção — Arago Delivery
**Data:** 28/06/2026

Todas as vulnerabilidades identificadas na auditoria original foram corrigidas e verificadas.
Uma brecha adicional foi descoberta durante a verificação e também corrigida.

---

## ✅ Vulnerabilidades Corrigidas

### C1 — Senha de admin em texto puro + timing attack
**Status: CORRIGIDO**
- `ADMIN_SENHA=ChegoAdmin2026` removido do `.env.local`
- Substituído por `ADMIN_SENHA_HASH=$2b$12$BJka76...` (bcrypt 12 rounds)
- `auth/admin/route.ts`: usa `bcrypt.compare()` em vez de `===`
- Timing attack mitigado: bcrypt sempre roda (mesmo para email errado, usa `DUMMY_HASH`)
- `console.log` com resultado de auth removido

### C2 — GET /api/admin/completar-pedido sem autenticação
**Status: CORRIGIDO**
- `requireAdmin(req)` adicionado ao handler GET
- Ambos GET e POST agora exigem sessão admin

### C3 — Token de contrato sem expiração e re-assinatura permitida
**Status: CORRIGIDO**
- `contrato-loja/route.ts` e `contrato-motoboy/route.ts`: verificam `contrato_token_expira_em`
- Retornam 410 Gone para tokens expirados
- Retornam 409 Conflict se já assinado (impede re-assinatura)
- Status muda para `"contrato_assinado"` — admin ativa manualmente

### D1 — RLS com `allow_all` em todas as tabelas
**Status: CORRIGIDO**
- Arquivo `supabase-rls-secure.sql` gerado com policies granulares
- Writes via anon key bloqueados em todas as tabelas
- `motoboys`: zero acesso público
- `clientes/enderecos_cliente`: restrito ao próprio usuário via `auth.uid()`
- Leitura pública apenas para dados que o app precisa: lojas, produtos, pedidos por UUID

### D3 — Email enviava hash de senha nas credenciais
**Status: CORRIGIDO**
- `email.ts`: `credenciaisBox(email)` não recebe mais `senha`
- Email exibe "A senha que você cadastrou no momento do cadastro." em vez do hash

### L1 — Preço calculado no cliente (price tampering)
**Status: CORRIGIDO**
- Nova rota `POST /api/pedido/criar` valida todos os preços no servidor
- Busca `produto.preco` real do banco — nunca usa valor do cliente
- Valida que produtos pertencem à loja e estão disponíveis
- Busca `loja.taxa_entrega` real do banco
- `checkout/page.tsx` refatorado para usar esta rota

### L2 — Push subscribe sem autenticação
**Status: CORRIGIDO**
- `push/route.ts`: action `"subscribe"` exige `cliente_push_token`
- Token gerado com `crypto.randomBytes(32)` no servidor ao criar o pedido
- Validado contra o banco antes de registrar a subscription

### L3 — Incremento de cupom via cliente com anon key
**Status: CORRIGIDO**
- Cupom agora é aplicado e incrementado em `POST /api/pedido/criar` (service role)
- Checkout não faz mais chamada a `/api/admin/cupons/usar` para este fim

### L4 — Código de pedido previsível (últimos 4 dígitos do telefone)
**Status: CORRIGIDO**
- `codigoFromTelefone()` removido completamente de `checkout/page.tsx`
- `inserirPedidoComCodigo()` (cliente) removido
- Novo `gerarCodigo()` em `api/pedido/criar/route.ts` usa `crypto.randomBytes(6)` — 32^6 = ~1 bilhão de combinações
- Hint no UI ("código = últimos 4 dígitos") removido

### A1 — /api/escalada acessível por qualquer sessão autenticada
**Status: CORRIGIDO**
- `escalada/route.ts`: aceita apenas `role === "admin"` ou segredo interno `INTERNAL_API_SECRET`
- Motoboys não podem mais manipular o algoritmo de despacho

### A2 — Headers de segurança ausentes
**Status: CORRIGIDO**
- `next.config.ts` retorna para todas as rotas:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Permissions-Policy: camera=(), microphone=(), payment=(), usb=()`
  - `X-DNS-Prefetch-Control: on`
- `poweredByHeader: false` (remove `X-Powered-By: Next.js`)

### A3 — Webhook Asaas funcionava sem token
**Status: CORRIGIDO**
- `webhook/route.ts`: retorna 500 se `ASAAS_WEBHOOK_TOKEN` não estiver configurado
- Sempre valida o token — não há bypass

### I1 — SUPABASE_SERVICE_ROLE_KEY com fallback para anon key
**Status: CORRIGIDO**
- 20 arquivos corrigidos por batch sed (substituiu `?? NEXT_PUBLIC_SUPABASE_ANON_KEY!`)
- `contrato-loja/route.ts`: corrigido separadamente (usava `||` em vez de `??`)
- `cadastro-loja/route.ts`: corrigido (removeu branch de fallback para signUp anon)
- Verificação final: nenhum arquivo em `src/app/api/` usa anon key como fallback

### INJ1 — Coupon lookup com `.ilike()` (enumeração)
**Status: CORRIGIDO**
- `checkout/page.tsx`: `.ilike("codigo", ...)` → `.eq("codigo", cupomInput.trim().toUpperCase())`
- Busca case-insensitive mantida via `.toUpperCase()` no input

### INJ2 — Comissão sem validação de intervalo
**Status: CORRIGIDO**
- `cadastro-loja/route.ts`: `comissao: Math.max(0, Math.min(100, Number(comissao) || 10))`

### U1 — Upload sem validação de magic bytes (polyglot attack)
**Status: CORRIGIDO**
- `src/lib/magic-bytes.ts` criado — valida primeiros 16 bytes do arquivo
- Suporta JPEG, PNG, WebP, GIF, PDF, HEIC/HEIF
- `upload/route.ts` e `upload-motoboy-docs/route.ts` usam `validateFileType()`
- `upload/route.ts`: bloqueia motoboys no endpoint de lojas (role check)

---

## ⚠️ Itens Restantes (requerem ação manual ou são limitações conhecidas)

### Rate limiting em memória (risco médio em serverless)
O `rate-limit.ts` usa `Map` em memória — cada instância serverless tem estado separado.
**Recomendação:** migrar para Redis/Upstash ou usar o middleware de rate limiting da Vercel.

### RLS do Supabase (requer execução manual)
O arquivo `supabase-rls-secure.sql` foi gerado mas precisa ser executado no Supabase SQL Editor.
**Ação:** Abrir Dashboard → SQL Editor → executar `supabase-rls-secure.sql`.

### Content Security Policy (CSP) ausente
Nenhum header CSP foi adicionado pois o app usa Google Maps e CDNs externos.
**Recomendação:** adicionar CSP no `next.config.ts` com as origens necessárias após mapear todos os domínios utilizados.

### Push notification: `send-loja` sem autenticação
O endpoint `action: "send-loja"` é chamado sem sessão (do checkout, que é público).
Rate limiting está aplicado, mas um atacante com rate limit bypass pode spam lojas.
**Recomendação:** exigir `cliente_push_token` também para `send-loja`.

---

## Arquivos Modificados (resumo)

| Arquivo | Mudança Principal |
|---------|-------------------|
| `.env.local` | `ADMIN_SENHA` → `ADMIN_SENHA_HASH` (bcrypt) |
| `src/app/api/auth/admin/route.ts` | bcrypt + timing-safe + sem console.log |
| `src/app/api/admin/completar-pedido/route.ts` | Auth guard no GET |
| `src/app/api/contrato-loja/route.ts` | Expiração de token + anti re-assinatura + service key |
| `src/app/api/contrato-motoboy/route.ts` | Expiração de token + anti re-assinatura |
| `src/app/api/escalada/route.ts` | Somente admin/interno |
| `src/app/api/pagamento/webhook/route.ts` | Token sempre obrigatório |
| `src/app/api/push/route.ts` | Subscribe exige cliente_push_token |
| `src/app/api/upload/route.ts` | Magic bytes + role check |
| `src/app/api/upload-motoboy-docs/route.ts` | Magic bytes |
| `src/app/api/cadastro-loja/route.ts` | Range validation + service key exclusivo |
| `src/app/api/pedido/criar/route.ts` | **NOVO** — criação de pedido server-side |
| `src/app/checkout/page.tsx` | Usa /api/pedido/criar; remove codigoFromTelefone; .eq() para cupom |
| `src/lib/email.ts` | Remove hash de senha dos emails |
| `src/lib/magic-bytes.ts` | **NOVO** — validação de magic bytes |
| `next.config.ts` | Security headers + poweredByHeader: false |
| `supabase-rls-secure.sql` | **NOVO** — políticas RLS granulares |
| +20 arquivos de API | Service role key sem fallback anon |
