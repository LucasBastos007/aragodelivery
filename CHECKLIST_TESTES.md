# Checklist de Testes — Chegô Delivery
> Marque cada item conforme for testando. Anote bugs encontrados no campo "Obs".

---

## 👤 FLUXO DO CLIENTE

### Acesso e Cadastro
- [ ] Abre o app em **iOS** sem erros de layout
- [ ] Abre o app em **Android** sem erros de layout
- [ ] Abre o app no **desktop/navegador** sem erros de layout
- [ ] Tela inicial (home) carrega lista de restaurantes/lojas
- [ ] Botão "Entrar" redireciona para tela de login do cliente
- [ ] Login com telefone/senha funciona
- [ ] Mensagem de erro ao errar a senha
- [ ] Opção de cadastro leva para o formulário correto
- [ ] Cadastro de novo cliente completo (nome, telefone, senha)
- [ ] Após cadastro, cliente é redirecionado para home logado
- [ ] Logout funciona e volta para tela inicial

**Obs:** _______________

---

### Navegação e Busca
- [ ] Home exibe todas as lojas ativas
- [ ] Lojas fechadas aparecem marcadas como fechadas
- [ ] Lojas suspensas **não** aparecem na listagem
- [ ] Busca (`/busca`) filtra lojas por nome corretamente
- [ ] Busca filtra por produto/categoria
- [ ] Resultado "nenhum resultado" aparece quando não há match
- [ ] Clicar em uma loja abre a página da loja (`/restaurante/[id]`)

**Obs:** _______________

---

### Página da Loja
- [ ] Logo, nome e descrição da loja aparecem corretamente
- [ ] Cardápio carrega com produtos e preços
- [ ] Produto sem estoque/indisponível não permite adicionar
- [ ] Adicionar produto ao carrinho funciona
- [ ] Botão flutuante do carrinho aparece ao adicionar item
- [ ] Quantidade de itens no carrinho é atualizada em tempo real

**Obs:** _______________

---

### Carrinho
- [ ] Página do carrinho (`/carrinho`) lista todos os itens
- [ ] Alterar quantidade de um item no carrinho funciona
- [ ] Remover item do carrinho funciona
- [ ] Remover todos os itens esvazia o carrinho e volta para home
- [ ] Subtotal, taxa de entrega e total calculados corretamente
- [ ] Campo de cupom de desconto aparece
- [ ] Cupom válido aplica desconto corretamente
- [ ] Cupom inválido/expirado exibe mensagem de erro
- [ ] Botão "Ir para o pagamento" leva para checkout

**Obs:** _______________

---

### Checkout e Pagamento
- [ ] Página de checkout (`/checkout`) carrega endereço do cliente
- [ ] Campo de endereço de entrega é editável
- [ ] Seleção de forma de pagamento: **PIX**
- [ ] Seleção de forma de pagamento: **Cartão de crédito/débito**
- [ ] Seleção de forma de pagamento: **Dinheiro** (troco aparece quando necessário)
- [ ] Pagamento via PIX gera QR Code corretamente
- [ ] QR Code PIX tem valor correto
- [ ] Após pagamento PIX confirmado, pedido é criado automaticamente
- [ ] Pagamento com cartão processa sem erros
- [ ] Falha no pagamento exibe mensagem de erro clara
- [ ] Confirmação de pedido exibe número/código do pedido
- [ ] E-mail ou notificação de confirmação disparada

**Obs:** _______________

---

### Acompanhamento do Pedido
- [ ] Página de tracking (`/pedido/[codigo]`) abre corretamente
- [ ] Status atualiza em tempo real (aguardando → aceito → em rota → entregue)
- [ ] Nome e telefone do motoboy aparecem após aceite
- [ ] Botão para ligar/WhatsApp para o motoboy funciona
- [ ] Estimativa de tempo de entrega aparece
- [ ] Status "Entregue" aparece ao confirmar entrega
- [ ] Avaliação do pedido pode ser feita após entrega

**Obs:** _______________

---

### Perfil e Histórico do Cliente
- [ ] Página de perfil (`/cliente/perfil`) exibe dados corretos
- [ ] Editar dados (`/cliente/alterar-dados`) salva alterações
- [ ] Histórico de pedidos (`/cliente/historico`) lista pedidos anteriores
- [ ] Clicar em pedido antigo mostra os detalhes
- [ ] Seção de notificações (`/cliente/notificacoes`) funciona
- [ ] Página "Convide amigos" (`/cliente/convide`) abre sem erros

**Obs:** _______________

---

## 🏪 FLUXO DO LOJISTA

### Cadastro e Contrato
- [ ] Formulário de cadastro de loja (`/cadastro-loja`) abre corretamente
- [ ] Todos os campos obrigatórios são validados
- [ ] Envio do formulário cria loja com status "pendente"
- [ ] Link de contrato enviado para o lojista (via WhatsApp/e-mail)
- [ ] Página do contrato (`/contrato/loja/[token]`) abre e exibe dados corretos da loja
- [ ] Plano, mensalidade e dia de vencimento aparecem corretos
- [ ] Botão "Baixar Contrato em PDF" faz download do PDF
- [ ] PDF gerado contém nome e CNPJ/CPF da loja preenchidos
- [ ] Cláusulas do contrato estão completas (12 cláusulas)

**Obs:** _______________

---

### Login e Acesso ao Painel
- [ ] Login do lojista (`/entrar`) funciona com credenciais corretas
- [ ] Senha errada retorna mensagem de erro
- [ ] Loja com status "pendente" **não** consegue acessar o painel
- [ ] Loja com status "suspenso" vê tela de bloqueio (inadimplência)
- [ ] Tela de bloqueio exibe botão de WhatsApp para regularizar
- [ ] Loja ativa entra no painel normalmente

**Obs:** _______________

---

### Dashboard do Lojista
- [ ] Dashboard (`/loja/dashboard`) carrega sem erros
- [ ] Cards de resumo (pedidos do dia, faturamento, ticket médio) estão corretos
- [ ] Notificações de novos pedidos aparecem em tempo real
- [ ] Som ou alerta ao receber novo pedido
- [ ] Lista de pedidos ativos carrega corretamente
- [ ] Aceitar pedido muda status para "aceito"
- [ ] Recusar pedido com motivo funciona
- [ ] Marcar pedido como "pronto" funciona
- [ ] Tempo de preparo é registrado corretamente

**Obs:** _______________

---

### Cardápio
- [ ] Página de cardápio (`/loja/cardapio`) lista todos os produtos
- [ ] Adicionar novo produto (nome, preço, foto, categoria) funciona
- [ ] Foto do produto faz upload corretamente
- [ ] Editar produto existente salva alterações
- [ ] Ativar/desativar produto muda visibilidade no app do cliente
- [ ] Excluir produto remove da listagem
- [ ] Criar nova categoria funciona
- [ ] Reordenar itens do cardápio funciona
- [ ] Produto indisponível aparece como tal para o cliente

**Obs:** _______________

---

### Cupons
- [ ] Página de cupons (`/loja/cupons`) lista cupons criados
- [ ] Criar cupom com desconto percentual funciona
- [ ] Criar cupom com desconto fixo (R$) funciona
- [ ] Definir uso máximo por cupom funciona
- [ ] Cupom expirado não é aceito no checkout
- [ ] Desativar cupom impede seu uso imediatamente

**Obs:** _______________

---

### Financeiro do Lojista
- [ ] Página financeira (`/loja/financeiro`) carrega corretamente
- [ ] Saldo disponível para saque está correto
- [ ] Histórico de transações (pedidos recebidos) lista corretamente
- [ ] Solicitar saque funciona
- [ ] Saque pendente aparece na listagem
- [ ] Comprovante/confirmação de saque é exibido

**Obs:** _______________

---

### Entrega Avulsa
- [ ] Página de entrega avulsa (`/loja/entrega-avulsa`) abre corretamente
- [ ] Criar solicitação de entrega avulsa (sem pedido no app) funciona
- [ ] Campos obrigatórios são validados
- [ ] Entrega avulsa aparece para motoboys disponíveis
- [ ] Status da entrega avulsa é atualizado em tempo real

**Obs:** _______________

---

### Perfil da Loja
- [ ] Editar nome, descrição e categoria funciona
- [ ] Trocar foto/logo da loja funciona
- [ ] Horários de funcionamento podem ser configurados
- [ ] Abrir/fechar loja manualmente funciona
- [ ] Loja fechada manualmente não recebe pedidos

**Obs:** _______________

---

## 🏍️ FLUXO DO MOTOBOY

### Cadastro e Contrato
- [ ] Formulário de cadastro de motoboy (`/cadastro-motoboy`) abre corretamente
- [ ] Upload de foto da CNH (frente e verso) funciona
- [ ] Upload de CRLV funciona
- [ ] Selfie com documento faz upload corretamente
- [ ] Envio do formulário cria motoboy com status "pendente"
- [ ] Página do contrato (`/contrato/motoboy/[token]`) abre com dados corretos
- [ ] Cláusulas do contrato estão completas (11 cláusulas)
- [ ] Área de assinatura digital (canvas) aceita assinatura com dedo/mouse
- [ ] Selfie segurando documento pode ser tirada/enviada
- [ ] Botão "Assinar contrato" fica ativo somente com assinatura + selfie preenchidos
- [ ] Assinar contrato salva e exibe tela de confirmação

**Obs:** _______________

---

### Login e Acesso
- [ ] Login do motoboy (`/entrar/motoboy`) funciona
- [ ] Motoboy pendente/não aprovado não acessa o painel
- [ ] Motoboy ativo acessa o painel normalmente

**Obs:** _______________

---

### Dashboard do Motoboy
- [ ] Dashboard (`/motoboy/dashboard`) carrega sem erros
- [ ] Botão de ficar online/offline funciona
- [ ] Ao ficar online, começa a receber solicitações de entrega
- [ ] Notificação de nova entrega aparece em tempo real
- [ ] Card da entrega exibe: loja, endereço de entrega, valor
- [ ] **Aceitar entrega** atribui pedido ao motoboy
- [ ] **Recusar entrega** passa para outro motoboy
- [ ] Status atualiza: "indo para a loja" → "coletado" → "entregue"
- [ ] Confirmar coleta na loja funciona
- [ ] Confirmar entrega ao cliente funciona
- [ ] Histórico de entregas do dia aparece no dashboard

**Obs:** _______________

---

### Financeiro do Motoboy
- [ ] Página financeira (`/motoboy/financeiro`) carrega corretamente
- [ ] Saldo acumulado (entregas realizadas) está correto
- [ ] Histórico de corridas com valores aparece
- [ ] Repasses recebidos (toda terça e sexta) listados

**Obs:** _______________

---

### Perfil do Motoboy
- [ ] Dados pessoais (nome, telefone, CNH, placa) estão corretos
- [ ] Editar chave PIX funciona
- [ ] Foto de perfil pode ser alterada

**Obs:** _______________

---

## 📍 LOCALIZAÇÃO

- [ ] Ao abrir o app, permissão de localização é solicitada corretamente
- [ ] Lojas são exibidas por proximidade ou região correta
- [ ] Endereço do cliente é detectado automaticamente no checkout
- [ ] Campo de endereço manual funciona quando GPS está desativado
- [ ] Motoboy online aparece no radar de pedidos da região
- [ ] Motoboy offline não recebe pedidos mesmo estando logado
- [ ] Taxa de entrega varia conforme distância (se configurado)
- [ ] Endereço de entrega inválido/fora da área exibe erro

**Obs:** _______________

---

## 💳 PAGAMENTO (ASAAS)

### PIX
- [ ] QR Code PIX é gerado em menos de 5 segundos
- [ ] QR Code tem valor exato do pedido
- [ ] Cópia do código PIX ("Pix Copia e Cola") funciona
- [ ] Após pagamento PIX, status do pedido muda automaticamente para "pago/pendente"
- [ ] Pagamento PIX expirado mostra mensagem de expiração
- [ ] Não é possível pagar o mesmo QR Code duas vezes

### Cartão
- [ ] Formulário de cartão aparece corretamente
- [ ] Cartão inválido retorna mensagem de erro clara
- [ ] Cartão com saldo insuficiente retorna erro
- [ ] Pagamento aprovado cria pedido imediatamente
- [ ] Parcelamento (se habilitado) funciona corretamente

### Reembolsos e Cancelamentos
- [ ] Cancelar pedido antes da aceitação pelo lojista estorna o pagamento
- [ ] Cancelar pedido após aceitação segue a política correta
- [ ] Reembolso aparece no painel admin (`/chego-ctrl/reembolsos`)
- [ ] Estorno PIX chega na conta do cliente

### Repasse ao Lojista
- [ ] Pedido entregue computa no saldo do lojista
- [ ] Relatório financeiro admin (`/chego-ctrl/relatorio`) mostra pedidos entregues
- [ ] Taxa Chegô (R$ 1,00/entrega) deduzida corretamente no relatório
- [ ] Taxa Asaas (R$ 1,99/pedido) deduzida corretamente no relatório
- [ ] Loja Gold: comissão de 10% calculada corretamente
- [ ] Loja Select/Prime/Black: sem comissão sobre pedidos

**Obs:** _______________

---

## 🔧 PAINEL ADMIN (chego-ctrl)

### Gestão de Lojas
- [ ] Login admin (`/chego-ctrl-login`) funciona
- [ ] Lista de lojas exibe todas com status correto
- [ ] Aprovar loja muda status para "aprovado" e gera token de contrato
- [ ] **Bloquear gerar contrato sem plano definido** — botão de aprovar bloqueia e mostra aviso
- [ ] Definir plano da loja antes de aprovar funciona
- [ ] Reenviar contrato gera novo token e link
- [ ] Suspender/bloquear loja manualmente funciona
- [ ] Reativar loja suspensa funciona
- [ ] Documentos da loja (`/chego-ctrl/documentos/loja`) acessíveis

**Obs:** _______________

---

### Gestão de Motoboys
- [ ] Lista de motoboys com status e veículo
- [ ] Aprovar motoboy muda status e envia contrato
- [ ] Rejeitar motoboy com motivo funciona
- [ ] Documentos do motoboy (`/chego-ctrl/documentos/motoboy`) — CNH, CRLV, selfie visíveis
- [ ] Bloquear motoboy impede acesso imediato

**Obs:** _______________

---

### Pedidos e Despacho
- [ ] Painel de pedidos (`/chego-ctrl/pedidos`) lista todos os pedidos ativos
- [ ] Filtro por status funciona (pendente, em rota, entregue, cancelado)
- [ ] Despacho manual (`/chego-ctrl/despacho`) atribui motoboy a pedido
- [ ] Histórico completo de pedidos do dia
- [ ] Pedidos com problema podem ser cancelados pelo admin

**Obs:** _______________

---

### Mensalidades
- [ ] Painel de mensalidades (`/chego-ctrl/mensalidades`) carrega corretamente
- [ ] Cards de resumo: em dia / pendentes / atrasados / bloqueados / recebido / a receber
- [ ] Lista exibe todas as lojas Select/Prime/Black com status de pagamento
- [ ] Loja com 4+ dias de atraso aparece como "atrasado/bloqueado"
- [ ] Alterar dia de vencimento de uma loja funciona (campo inline)
- [ ] Confirmar pagamento manualmente muda status para "pago"
- [ ] Confirmar pagamento de loja suspensa a **reativa automaticamente**
- [ ] Loja gold **não aparece** na lista de mensalidades

**Obs:** _______________

---

### Cupons (Admin)
- [ ] Criar cupom global (vale em todas as lojas) funciona
- [ ] Cupom com limite de uso é respeitado
- [ ] Desativar cupom impede uso imediato

**Obs:** _______________

---

### Saques e Financeiro
- [ ] Lista de saques solicitados pelos lojistas aparece
- [ ] Aprovar saque muda status e registra data
- [ ] Rejeitar saque com motivo funciona
- [ ] Relatório geral (`/chego-ctrl/relatorio`) filtra por período (7/15/30 dias)
- [ ] Relatório exibe ranking de lojas por faturamento
- [ ] Filtro de data personalizado funciona
- [ ] Botão de imprimir/exportar relatório funciona

**Obs:** _______________

---

## 🔔 NOTIFICAÇÕES E TEMPO REAL

- [ ] Lojista recebe notificação sonora de novo pedido
- [ ] Motoboy recebe notificação de nova entrega
- [ ] Cliente recebe atualização de status do pedido
- [ ] Notificações funcionam com o app em segundo plano (mobile)
- [ ] Atualizações de status são em tempo real (sem precisar recarregar)

**Obs:** _______________

---

## 📱 COMPATIBILIDADE E PERFORMANCE

- [ ] App carrega em menos de 3 segundos em Wi-Fi
- [ ] App carrega em menos de 5 segundos em 4G
- [ ] Nenhuma tela quebrada/com overflow em celular com tela pequena (< 375px)
- [ ] Nenhuma tela quebrada em iPad/tablet
- [ ] Imagens carregam com boa resolução e sem distorção
- [ ] Scroll suave em todas as páginas longas
- [ ] Formulários funcionam bem com teclado aberto no mobile
- [ ] Sem travar ao navegar rapidamente entre telas

**Obs:** _______________

---

## ⚠️ CASOS DE BORDA (erros esperados)

- [ ] Tentar finalizar pedido com carrinho vazio → bloqueia com aviso
- [ ] Tentar acessar painel lojista sem login → redireciona para /entrar
- [ ] Tentar acessar painel motoboy sem login → redireciona para /entrar/motoboy
- [ ] Tentar acessar painel admin sem login → redireciona para /chego-ctrl-login
- [ ] Link de contrato inválido/expirado → exibe "Link inválido"
- [ ] Loja offline recebe pedido → não exibe para clientes
- [ ] Motoboy offline recebe pedido → não recebe notificações
- [ ] Cupom com 0 usos restantes → bloqueado no checkout
- [ ] Pedido cancelado por timeout → cliente notificado e estorno iniciado

**Obs:** _______________

---

## 📝 REGISTRO DE BUGS

| # | Tela / Fluxo | Dispositivo | Descrição do Bug | Severidade (Alta/Média/Baixa) | Responsável |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

---

**Data dos testes:** ___/___/______
**Versão testada:** chegodelivery.com
**Responsável pelos testes:** _______________
