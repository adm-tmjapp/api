# TMJApp API - Planejamento da Feature de Pagamentos Multi-Gateway

## Objetivo

Estruturar a feature de pagamentos do TMJApp com arquitetura preparada para multi-gateway.

O primeiro provedor previsto e a Asaas, mas o desenho precisa permitir no futuro:

- Stone
- Pagar.me
- Mercado Pago
- outro provedor compativel com cartao e PIX

O objetivo funcional permanece:

- pagamento via cartao de credito a vista
- pagamento via PIX com QR Code dinamico
- tokenizacao de cartao para compras futuras
- conciliacao financeira do valor pago
- separacao clara entre parcela da plataforma e parcela do motorista
- geracao de comprovante e historico de pagamento

Este documento existe para amadurecer a feature antes da implementacao definitiva.

---

## Escopo funcional esperado

### Cartao de credito

O fluxo ideal do produto e:

1. o passageiro cadastra um cartao uma unica vez
2. o backend salva apenas um token seguro do cartao
3. nas proximas corridas, o app reutiliza esse token
4. o passageiro nao precisa redigitar os dados do cartao

### PIX

O fluxo ideal do produto e:

1. o passageiro escolhe PIX
2. a API gera uma cobranca PIX na Asaas
3. o app recebe um QR Code dinamico e um payload copia-e-cola
4. a confirmacao do pagamento acontece via webhook

### Financeiro

Precisamos registrar internamente:

1. valor bruto cobrado do passageiro
2. valor da taxa da plataforma
3. valor da taxa do gateway
4. valor liquido que pertence ao motorista
5. valor liquido que pertence a plataforma
6. comprovante do pagamento

---

## Principios da arquitetura

### 1. A API TMJ continua sendo a fonte de verdade

O gateway sera apenas um provedor externo.

Mas a fonte de verdade operacional do TMJ precisa continuar sendo a nossa API para:

- status da corrida
- status do pagamento
- conciliacao
- carteira do motorista
- auditoria
- suporte
- comprovante exibido no app

### 2. Webhook e obrigatorio

Nao devemos confiar apenas na resposta sincrona da criacao de cobranca.

Eventos do webhook devem atualizar o estado do pagamento local.

### 3. Ledger interno e obrigatorio

Mesmo com qualquer gateway, o TMJ precisa manter um ledger interno para:

- valor bruto
- comissao da plataforma
- taxa do provedor
- valor do motorista
- status do pagamento
- status do repasse

### 4. Nunca salvar dados sensiveis brutos do cartao

Se for adotado cartao salvo com token:

- salvar apenas token do cartao
- salvar apenas metadados seguros: bandeira, final, titular
- nunca salvar PAN completo
- nunca salvar CVV

### 5. O dominio de pagamento deve ser neutro em relacao ao provedor

As regras do TMJ nao devem depender diretamente da Asaas.

Precisamos separar:

1. dominio de pagamento do TMJ
2. adaptadores de provedor

Isso permite trocar gateway sem reescrever:

- carteira
- comprovante
- ledger
- conciliacao
- endpoints do app

### 6. Status internos devem ser nossos

Nao devemos usar o status bruto do provedor como status oficial da plataforma.

Precisamos de uma maquina de estados interna unica e um mapeamento por provider.

### 7. Token de cartao pertence ao provedor

Isso precisa estar explicito desde o inicio:

- token gerado na Asaas pertence a Asaas
- token gerado na Stone pertence a Stone

Trocar de gateway no futuro pode exigir recadastro de cartao ou estrategia de migracao especifica.

---

## Arquitetura recomendada para multi-gateway

### Camada 1 - dominio interno

Essa camada nao conhece Asaas, Stone ou qualquer gateway especifico.

Responsabilidades:

- criar intencao de pagamento
- calcular divisao financeira
- manter status interno
- atualizar carteira do motorista
- persistir ledger
- gerar comprovante
- fazer conciliacao
- reagir a webhooks normalizados

### Camada adicional - politica de meios de pagamento

Antes de criar qualquer cobranca, a API deve validar quais meios de pagamento estao habilitados para aquele contexto.

Essa politica precisa permitir:

- somente PIX
- somente cartao
- PIX e cartao
- bloqueio temporario de um meio
- habilitacao por cidade
- habilitacao por produto
- habilitacao por operacao

### Camada 2 - interface do provedor

Precisamos de uma interface unica de provider, por exemplo:

- `createCustomer`
- `tokenizeCard`
- `createCardCharge`
- `createPixCharge`
- `getPixQrCode`
- `getPayment`
- `refundPayment`
- `parseWebhook`
- `getReceipt`

### Camada 3 - adapters concretos

Implementacoes previstas:

- `AsaasPaymentProvider`
- `StonePaymentProvider`
- `MockPaymentProvider`

### Beneficio pratico

O app e os services internos continuam falando com o dominio TMJ.

So o adapter conhece payload, status e webhooks especificos do gateway.

---

## Decisao importante: como salvar cartao

Existem dois caminhos.

### Opcao A - fluxo mais seguro operacionalmente

Usar fluxo hospedado/gerenciado pelo provedor para pagamento.

Vantagens:

- menor risco de vazamento
- menor escopo de responsabilidade de seguranca
- menor impacto de compliance

Desvantagens:

- pior experiencia de compra
- menor controle do fluxo dentro do app
- experiencia inferior para compra recorrente

### Opcao B - tokenizacao do cartao no provedor

Usar tokenizacao e salvar o token do provider para compras futuras.

Vantagens:

- melhor UX
- pagamento futuro sem redigitar dados
- mais aderente ao comportamento esperado de apps de mobilidade

Desvantagens:

- exige muito cuidado com seguranca
- amplia responsabilidade tecnica
- precisa avaliar escopo de compliance/PCI

### Recomendacao para o TMJ

1. usar PIX primeiro
2. estruturar tokenizacao de cartao em seguida
3. so liberar cartao salvo em producao depois de revisar seguranca/compliance

---

## Fluxo recomendado - Cartao de credito

### Cadastro do cartao

1. app envia intencao de cadastrar cartao
2. API valida se `CREDIT_CARD` esta habilitado
3. API garante ou cria `customer` no provider para o passageiro
4. API cria token do cartao no provider
5. API salva localmente apenas:
   - `provider`
   - `providerCustomerId`
   - `providerPaymentMethodToken`
   - `brand`
   - `last4`
   - `holderName`
   - `isDefault`
   - `status`

### Pagamento da corrida com cartao salvo

1. app escolhe metodo salvo
2. API valida se `CREDIT_CARD` esta habilitado
3. API localiza token do cartao
4. API cria cobranca no provider usando token
5. API registra pagamento local como `PENDING`
6. webhook atualiza para:
   - `AUTHORIZED`
   - `RECEIVED`
   - `FAILED`
   - `REFUNDED`

### Dados que a API local deve persistir

- `rideId`
- `passengerId`
- `driverId`
- `provider`
- `providerCustomerId`
- `providerPaymentId`
- `providerPaymentMethodToken`
- `billingType = CREDIT_CARD`
- `status`
- `grossAmount`
- `platformCommissionAmount`
- `providerFeeAmount`
- `driverNetAmount`
- `platformNetAmount`
- `confirmedAt`
- `receivedAt`
- `invoiceUrl`
- `receiptUrl`

---

## Fluxo recomendado - PIX

### Geracao do pagamento

1. app escolhe PIX
2. API valida se `PIX` esta habilitado
3. API cria cobranca no provider com `billingType = PIX`
4. API consulta QR Code dinamico do pagamento
5. API devolve ao app:
   - `paymentId`
   - `payload`
   - `encodedImage`
   - `expirationDate`

### Confirmacao

1. passageiro paga no banco
2. provider envia webhook
3. API atualiza pagamento local
4. corrida muda de status financeiro
5. app pode consultar o comprovante

### Dados que a API local deve persistir

- `providerPaymentId`
- `billingType = PIX`
- `pixPayload`
- `pixEncodedImage`
- `pixExpirationDate`
- `status`
- `grossAmount`
- `platformCommissionAmount`
- `providerFeeAmount`
- `driverNetAmount`
- `platformNetAmount`

---

## Split vs ledger interno

Essa decisao precisa ser tomada antes da implementacao final.

### Opcao 1 - usar split do gateway

Faz sentido somente se:

- motorista tiver estrutura/conta/carteira na Asaas
- o modelo de repasse for suportado operacionalmente pela plataforma

Vantagens:

- repasse nativo no provedor
- conciliacao mais automatica

Desvantagens:

- mais acoplamento com o gateway
- mais exigencias operacionais
- pode conflitar com a carteira interna ja criada no TMJ

### Opcao 2 - receber tudo na plataforma e fazer ledger interno

Esse e o caminho mais coerente com a arquitetura atual do TMJ.

Vantagens:

- preserva a carteira do motorista ja existente
- permite regras proprias de repasse
- reduz acoplamento direto com split do provedor
- facilita mudar de gateway no futuro

Desvantagens:

- repasse fica sob responsabilidade da nossa plataforma
- exige conciliacao financeira propria

### Recomendacao para o TMJ

Usar `ledger interno` primeiro.

Receber o valor na conta da plataforma e controlar:

- saldo disponivel do motorista
- saldo pendente
- taxa da plataforma
- taxa do gateway
- historico financeiro

---

## Politica de habilitacao de meios de pagamento

Precisamos de uma camada de configuracao para definir quais meios de pagamento estao ativos.

### Casos que a plataforma precisa suportar

- habilitar somente `PIX`
- habilitar somente `CREDIT_CARD`
- habilitar `PIX` e `CREDIT_CARD`
- desabilitar temporariamente um meio por incidente
- habilitar por cidade
- habilitar por produto
- habilitar por operacao ou campanha

### Modelagem sugerida

#### PaymentSettings

- `scopeType`: `GLOBAL | CITY | PRODUCT | OPERATION`
- `scopeId`
- `enabledMethods`: `["PIX", "CREDIT_CARD"]`
- `defaultMethod`
- `allowSavedCard`
- `pixEnabled`
- `creditCardEnabled`
- `updatedAt`
- `updatedBy`

### Regra de precedencia

Sugestao:

1. configuracao global
2. override por cidade
3. override por produto
4. override por operacao

O resultado final sempre deve ser resolvido no backend.

### Validacao obrigatoria no backend

Mesmo se o app esconder a opcao na interface, o backend deve validar novamente antes de:

- tokenizar cartao
- criar cobranca com cartao
- criar cobranca PIX

### Resposta sugerida para o app

Endpoint sugerido:

- `GET /api/v2/passenger/payments/options?rideId=...`

Payload sugerido:

```json
{
  "enabledMethods": [
    {
      "type": "PIX",
      "enabled": true,
      "label": "PIX"
    },
    {
      "type": "CREDIT_CARD",
      "enabled": false,
      "label": "Cartão de Crédito",
      "reason": "Forma de pagamento temporariamente indisponível."
    }
  ],
  "defaultMethod": "PIX"
}
```

### Erro sugerido para tentativas invalidas

```json
{
  "statusCode": 422,
  "error": "PAYMENT_METHOD_DISABLED",
  "message": "Forma de pagamento indisponível para esta operação."
}
```

---

## Formula financeira recomendada

Campos principais:

- `grossAmount`
- `platformCommissionAmount`
- `providerFeeAmount`
- `driverNetAmount`
- `platformNetAmount`

Exemplo:

1. `grossAmount = 30.00`
2. `platformCommissionAmount = 6.00`
3. `providerFeeAmount = 1.20`
4. `driverNetAmount = 24.00` ou `22.80`, dependendo da regra de negocio
5. `platformNetAmount = 6.00 - 1.20 = 4.80`

Precisamos definir com o negocio:

### Regra A

A taxa do gateway fica com a plataforma.

- motorista recebe sem ser impactado pela taxa do provider

### Regra B

A taxa do gateway e descontada do valor do motorista.

- plataforma preserva a propria margem

### Recomendacao

Adotar a Regra A inicialmente, porque e mais simples para o motorista entender.

---

## Estados recomendados do pagamento local

Sugestao de maquina de estados:

- `PENDING`
- `WAITING_PIX_PAYMENT`
- `AUTHORIZED`
- `RECEIVED`
- `FAILED`
- `CANCELED`
- `REFUNDED`
- `CHARGEBACK`

Observacao:

Os nomes internos podem ser diferentes dos nomes do gateway, mas precisamos mapear explicitamente por provider.

---

## Mapeamento de status por provider

Precisamos de uma camada de traducao:

- status bruto do provider
- status interno TMJ

Exemplo conceitual:

- Asaas `RECEIVED` -> TMJ `PAID`
- Stone `APPROVED` -> TMJ `AUTHORIZED` ou `PAID`, conforme fluxo

O importante e que o app e o financeiro nao dependam do nome do status do gateway.

---

## Webhooks obrigatorios

Precisamos registrar e tratar no backend pelo menos:

- criacao do pagamento
- autorizacao
- confirmacao/recebimento
- falha de captura
- cancelamento
- estorno

O webhook deve:

1. validar origem/autenticidade
2. localizar pagamento local por `providerPaymentId`
3. transformar o payload bruto em evento interno
4. atualizar o estado local de forma idempotente
5. registrar auditoria
6. disparar efeitos secundarios:
   - liberar corrida
   - atualizar carteira
   - notificar app
   - gerar comprovante

O processador de webhook nao deve conter regras especificas da Asaas espalhadas pelo dominio.

Ele deve chamar o adapter do provider para normalizar o evento.

---

## Comprovante de pagamento

Precisamos ter dois niveis de comprovante:

### 1. Referencia do provedor

- `invoiceUrl`
- `providerPaymentId`

### 2. Comprovante proprio do TMJ

Payload recomendado:

- `paymentId`
- `rideId`
- `passengerName`
- `driverName`
- `billingType`
- `status`
- `paidAt`
- `grossAmount`
- `platformCommissionAmount`
- `providerFeeAmount`
- `driverNetAmount`
- `platformNetAmount`
- `originAddress`
- `destinationAddress`
- `providerReference`

No futuro:

- PDF
- HTML
- compartilhamento no app

---

## Modelos sugeridos

### PassengerGatewayCustomer

- `userId`
- `provider`
- `providerCustomerId`
- `createdAt`
- `updatedAt`

### PassengerPaymentMethod

- `userId`
- `provider`
- `providerCustomerId`
- `providerPaymentMethodToken`
- `brand`
- `last4`
- `holderName`
- `isDefault`
- `status`
- `createdAt`
- `updatedAt`

### RidePayment

- `rideId`
- `passengerId`
- `driverId`
- `provider`
- `providerPaymentId`
- `providerCustomerId`
- `paymentMethodId`
- `billingType`
- `status`
- `grossAmount`
- `platformCommissionAmount`
- `providerFeeAmount`
- `driverNetAmount`
- `platformNetAmount`
- `invoiceUrl`
- `receiptUrl`
- `pixPayload`
- `pixEncodedImage`
- `pixExpirationDate`
- `providerPayload`
- `createdAt`
- `updatedAt`
- `paidAt`

### RidePaymentEvent

- `ridePaymentId`
- `provider`
- `providerEvent`
- `providerPaymentId`
- `payload`
- `processed`
- `processedAt`
- `createdAt`

---

## Endpoints sugeridos da API TMJ

### Metodos de pagamento do passageiro

- `GET /api/v2/passenger/payments/methods`
- `POST /api/v2/passenger/payments/methods/card-tokenize`
- `DELETE /api/v2/passenger/payments/methods/:id`
- `PATCH /api/v2/passenger/payments/methods/:id/default`

### Pagamento da corrida

- `POST /api/v2/passenger/rides/:rideId/payments/card`
- `POST /api/v2/passenger/rides/:rideId/payments/pix`
- `GET /api/v2/passenger/rides/:rideId/payments/status`
- `GET /api/v2/passenger/rides/:rideId/payments/receipt`

### Webhook

- `POST /api/v2/webhooks/asaas`

No futuro:

- `POST /api/v2/webhooks/stone`
- `POST /api/v2/webhooks/:provider`

### Admin/operacao

- `GET /api/v2/admin/payments`
- `GET /api/v2/admin/payments/:paymentId`
- `GET /api/v2/admin/payments/reconciliation`

---

## Sequencia recomendada de implementacao

### Fase 1 - PIX

Objetivo:

- colocar pagamento real em producao com menor risco

Itens:

1. criar customer Asaas
2. criar cobranca PIX
3. devolver QR Code dinamico
4. webhook de confirmacao
5. ledger interno
6. comprovante basico

### Fase 2 - Cartao sem salvar

Objetivo:

- validar compra com cartao e conciliacao

Itens:

1. pagamento cartao a vista
2. webhook de autorizacao/recebimento
3. comprovante
4. conciliacao

### Fase 3 - Cartao salvo com token

Objetivo:

- recompra sem redigitar cartao

Itens:

1. tokenizacao
2. salvar metodo de pagamento
3. definir cartao padrao
4. compra usando token
5. remocao de cartao

### Fase 4 - operacao financeira

Objetivo:

- robustez operacional e contabilidade interna

Itens:

1. dashboard admin de pagamentos
2. auditoria
3. reprocessamento de webhook
4. conciliacao manual
5. alertas de divergencia

### Fase 5 - segundo gateway

Objetivo:

- permitir trocar ou combinar provedores sem refatorar o dominio

Itens:

1. implementar `StonePaymentProvider` ou outro adapter
2. criar configuracao de provider padrao por ambiente
3. permitir roteamento por metodo de pagamento
4. manter o mesmo contrato para o app

---

## Estrategia de selecao de gateway

Inicialmente:

- `defaultProvider = asaas`

No futuro:

- `PIX = Asaas`
- `CARD = Stone`

Ou ate:

- fallback por indisponibilidade
- selecao por custo
- selecao por risco

Sugestao de desenho:

- `provider`
- `providerStrategy`
- `providerPriority`

Isso evita reescrever a feature quando houver expansao.

---

## Riscos e cuidados

### Seguranca

- cartao salvo aumenta a responsabilidade de seguranca
- nunca registrar PAN/CVV em log
- mascarar qualquer dado sensivel
- revisar requisitos de compliance antes da fase de tokenizacao

### Conciliacao

- o status do provedor pode divergir temporariamente do status local
- webhooks devem ser idempotentes
- eventos devem ser persistidos

### UX

- PIX precisa expor expiracao e possibilidade de reconsulta
- cartao precisa deixar claro se esta salvo, vencido ou recusado

### Financeiro

- decidir antes quem absorve a taxa do gateway
- decidir se o motorista recebe imediatamente ou via carteira interna

### Portabilidade

- customer id e especifico por provider
- token de cartao e especifico por provider
- webhook e especifico por provider
- split e especifico por provider

Entao a portabilidade precisa acontecer na arquitetura, nao nos ids ou tokens.

---

## Decisoes em aberto

1. Vamos usar split nativo da Asaas ou ledger interno?
2. A taxa do gateway fica com a plataforma ou impacta o motorista?
3. O cartao salvo sera implementado na primeira release ou fica para fase 3?
4. O comprovante do app sera apenas JSON inicialmente ou PDF tambem?
5. Vamos exigir antifraude adicional no pagamento com cartao?
6. Queremos preparar desde ja `provider interface` e `adapter` mesmo usando apenas Asaas na primeira entrega?
7. Vamos permitir um provider por metodo (`PIX` em um, `CARD` em outro) ou um provider unico por ambiente?

---

## Recomendacao final

Para o TMJ hoje:

1. implementar `PIX` primeiro
2. manter `ledger interno`
3. desenhar desde o inicio uma interface de provider
4. implementar `AsaasPaymentProvider` como primeiro adapter
5. adicionar `cartao a vista` na sequencia
6. liberar `cartao salvo com token` somente depois da revisao de seguranca
7. usar webhook como fonte oficial de confirmacao
8. manter comprovante proprio do TMJ desde a primeira fase

Esse caminho entrega valor rapido sem comprometer a arquitetura futura.
