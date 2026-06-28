# Driver Dashboard API Spec (V2)

## Objetivo
Disponibilizar endpoints da API v2 para suportar o novo dashboard do app motorista (`tmjappdrive`) com:
- estado online/offline
- cards de corridas pendentes com filtros
- resumo operacional do dia
- fluxo de aceite e acompanhamento da corrida atual

Base path: `/api/v2/driver`
Auth: `Bearer JWT` com role `driver`

---

## P0 - Necessario para entrada em producao

## 1) GET `/dashboard`

### Objetivo
Retornar, em uma chamada unica, os dados principais da tela inicial do motorista.

### Query params (opcionais)
- `highPriority`: `true|false`
- `category`: `delivery|passenger`
- `lat`: `number`
- `lng`: `number`
- `radiusKm`: `number`

### Response 200
```json
{
  "success": true,
  "availability": "ONLINE",
  "summary": {
    "todayRides": 9,
    "todayEarnings": 207.2,
    "progressPercent": 72
  },
  "pendingRides": [
    {
      "id": "ride_123",
      "typeLabel": "Entrega rápida • Motoboy",
      "category": "delivery",
      "highPriority": true,
      "routeLabel": "Rua da Consolação -> Av. Paulista",
      "distanceKm": 3.1,
      "etaMin": 12,
      "price": 24.8,
      "paymentMethod": "APP",
      "pickup": {
        "address": "Rua da Consolação",
        "lat": -23.55,
        "lng": -46.66
      },
      "dropoff": {
        "address": "Av. Paulista",
        "lat": -23.56,
        "lng": -46.65
      }
    }
  ],
  "currentRide": null
}
```

### Regras
- `availability` deve refletir `Driver.isAvailable`.
- `pendingRides` deve considerar apenas corridas `status = pending`.
- `currentRide` deve retornar corrida com status `accepted|ongoing` do motorista autenticado (ou `null`).

---

## 2) PATCH `/availability`

### Objetivo
Alternar motorista entre online/offline.

### Request body
```json
{
  "availability": "ONLINE"
}
```

### Response 200
```json
{
  "success": true,
  "availability": "ONLINE",
  "updatedAt": "2026-03-10T10:00:00.000Z"
}
```

### Regras
- Persistir em `Driver.isAvailable`.
- Bloquear valores fora de `ONLINE|OFFLINE` com `400`.

---

## 3) GET `/rides/pending`

### Objetivo
Listagem de corridas pendentes com filtros operacionais do dashboard.

### Query params (opcionais)
- `highPriority`: `true|false`
- `category`: `delivery|passenger`
- `lat`: `number`
- `lng`: `number`
- `radiusKm`: `number`
- `limit`: `number` (default `20`, max `100`)
- `offset`: `number` (default `0`)

### Response 200
```json
{
  "success": true,
  "items": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

### Observacao
- Endpoint ja existe, mas precisa padronizar payload e suportar filtros.

---

## 4) POST `/rides/{rideId}/accept`

### Objetivo
Aceitar uma corrida pendente.

### Response 200
```json
{
  "success": true,
  "ride": {
    "id": "ride_123",
    "status": "accepted",
    "driverId": "driver_001",
    "acceptedAt": "2026-03-10T10:01:00.000Z"
  }
}
```

### Erros
- `404`: corrida nao encontrada
- `409`: corrida ja aceita/indisponivel
- `422`: motorista offline

### Regras
- Operacao atomica para evitar corrida dupla (concorrencia).
- So aceitar corrida em `pending`.

---

## 5) GET `/rides/current`

### Objetivo
Recuperar corrida atual do motorista autenticado.

### Response 200
```json
{
  "success": true,
  "ride": null
}
```

ou

```json
{
  "success": true,
  "ride": {
    "id": "ride_123",
    "status": "ongoing"
  }
}
```

### Regras
- Retornar a corrida mais recente em `accepted|ongoing`.
- Se nao existir, retornar `ride: null`.

---

## P1 - Recomendado para completar fluxo operacional

## 6) PATCH `/rides/{rideId}/status`

### Request body
```json
{
  "status": "ARRIVED"
}
```

### Status permitidos
- `ARRIVED`
- `ONGOING`
- `COMPLETED`
- `CANCELED`

### Regras
- Validar maquina de estados (nao permitir transicao invalida).
- Registrar timestamps por transicao.

---

## 7) GET `/earnings/summary`

### Query params
- `period`: `today|week|month` (default `today`)

### Response 200
```json
{
  "success": true,
  "period": "today",
  "ridesCount": 9,
  "grossAmount": 207.2,
  "netAmount": 178.4,
  "currency": "BRL"
}
```

---

## 8) POST `/location`

### Request body
```json
{
  "lat": -23.55,
  "lng": -46.66,
  "heading": 120
}
```

### Objetivo
Atualizar localizacao operacional do motorista para matching/proximidade.

---

## Criterios de aceite (backend)

1. Endpoints P0 implementados e protegidos por `authMiddleware("driver")`.
2. OpenAPI atualizado em `src/v2/docs/openapi.yaml` com schemas e exemplos.
3. Padrao de erro consistente (`success=false`, `message`, `code`).
4. Cobertura minima de testes:
   - aceite de corrida com concorrencia (`409`)
   - toggle online/offline
   - filtro de corridas pendentes
5. Performance:
   - `GET /dashboard` com resposta <= 300ms (ambiente local sem carga).

---

## Mapeamento rapido para o app motorista

- Header + botao online/offline -> `PATCH /availability`
- Cards "Corridas hoje / Faturamento / Meta" -> `GET /dashboard` (`summary`)
- Lista "Novas corridas proximas" + filtros -> `GET /dashboard` ou `GET /rides/pending`
- Botao "Aceitar" -> `POST /rides/{rideId}/accept`
- Retomada de sessao -> `GET /rides/current`

