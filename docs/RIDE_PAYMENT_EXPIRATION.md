# Expiração de pagamento de corrida

O backend expõe `POST /api/v2/internal/rides/expire-payments`. Esse endpoint deve
ser chamado pelo Cloud Scheduler a cada minuto, enviando o header
`x-internal-token` com o mesmo valor de `RIDE_EXPIRATION_TOKEN`.

Exemplo de configuração:

```bash
gcloud scheduler jobs create http tmjapp-expire-ride-payments \
  --location=southamerica-east1 \
  --schedule="* * * * *" \
  --uri="https://api.tmjapp.com.br/api/v2/internal/rides/expire-payments" \
  --http-method=POST \
  --headers="Content-Type=application/json,x-internal-token=$RIDE_EXPIRATION_TOKEN" \
  --message-body='{"limit":100}' \
  --time-zone="America/Recife"
```

O job é idempotente: somente corridas `pending` com pagamento `PENDING` ou
`WAITING_PIX_PAYMENT` e `paymentExpiresAt` vencido são processadas. A API
cancelará a cobrança no gateway, marcará a corrida como `canceled` com motivo
`PAYMENT_TIMEOUT` e encerrará tentativas abertas de despacho.
