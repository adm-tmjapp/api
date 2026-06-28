# TMJApp API - Checklist de Informacoes Necessarias da Asaas

Este checklist resume o que ainda precisamos da conta Asaas para iniciar a integracao real em ambiente controlado.

## Obrigatorio para iniciar

### 1. Credenciais

- `ASAAS_API_KEY` do ambiente sandbox
- `ASAAS_BASE_URL` confirmada para sandbox
- `ASAAS_API_KEY` de producao
- `ASAAS_BASE_URL` confirmada para producao

### 2. Webhook

- URL publica que a Asaas vai chamar
- quais eventos serao enviados
- se existe segredo/token de validacao do webhook
- politica de retry do webhook

### 3. PIX

- confirmar se a conta sandbox/producao esta habilitada para PIX
- confirmar se o endpoint de QR Code dinamico esta disponivel para a conta
- confirmar prazo/expiracao padrao do QR Code

### 4. Cartao

- confirmar se a conta esta habilitada para tokenizacao de cartao
- confirmar se existe alguma ativacao adicional na Asaas para `creditCardToken`
- confirmar se o token gerado pode ser reutilizado sem reenvio dos dados do cartao
- confirmar restricoes para ambiente sandbox

### 5. Customer

- confirmar campos minimos obrigatorios para criar customer
- confirmar se CPF e obrigatorio para cartao
- confirmar se telefone e obrigatorio para PIX/cartao

---

## Obrigatorio para decisao de arquitetura

### 6. Split

- a operacao vai usar split nativo da Asaas?
- motorista tera wallet/conta na Asaas?
- ou a plataforma recebera tudo e fara repasse interno?

### 7. Taxas

- quais taxas reais serao cobradas no PIX
- quais taxas reais serao cobradas no cartao a vista
- quem absorve a taxa do gateway:
  - plataforma
  - motorista
  - regra por produto

### 8. Comprovante

- vamos usar apenas `invoiceUrl` da Asaas?
- ou tambem existe comprovante/receipt proprio do provider que queremos guardar?

---

## Importante para seguranca

### 9. Tokenizacao e compliance

- confirmar o fluxo oficial de tokenizacao recomendado pela Asaas
- confirmar se existe alternativa hospedada para reduzir escopo de seguranca
- revisar impacto de compliance se o backend trafegar dados do cartao

### 10. Logs e dados sensiveis

Precisamos validar internamente:

- nenhum numero completo de cartao em log
- nenhum CVV em log
- nenhum payload sensivel persistido sem necessidade

---

## Recomendacao de inicio

Se quisermos comecar rapido e com menos risco:

1. iniciar por `PIX`
2. validar webhook
3. fechar ledger interno
4. depois ativar cartao
5. por ultimo, ativar cartao salvo com token
