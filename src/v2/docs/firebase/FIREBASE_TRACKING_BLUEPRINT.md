# Firebase Tracking Blueprint (API + Realtime)

## Objetivo
Definir uma arquitetura hibrida para tracking em tempo real de motorista e passageiro, mantendo a API como fonte de verdade da corrida.

- API (`Node + Mongo`) = verdade de negocio (status, aceite, auditoria, pagamento)
- Firebase Realtime Database = canal realtime (localizacao ao vivo, presenca, ETA)
- Redis/Fila = lock, throttling, processamento assíncrono

## Escopo funcional
- Atualizacao de localizacao do motorista durante corrida ativa
- Atualizacao opcional de localizacao do passageiro durante corrida ativa
- Presenca online/offline/background por usuario na corrida
- ETA e distancia em tempo real para UI
- Eventos visuais de corrida em andamento (espelho)

## Fora de escopo
- Persistencia oficial do historico completo da corrida no Firebase
- Fechamento financeiro
- Regra de transicao de status como fonte primaria

## Principios
1. API sempre confirma transicao de status.
2. Firebase apenas acelera UX realtime.
3. Todo evento critico deve ser idempotente no backend.
4. Tokens realtime curtos e por corrida.

## Estrutura de dados (Realtime Database)
Base path: `/rides_live/{rideId}`

1. `/rides_live/{rideId}/meta`
```json
{
  "rideId": "ride_123",
  "driverId": "user_driver_1",
  "passengerId": "user_passenger_1",
  "status": "accepted",
  "createdAt": 1770000000000,
  "updatedAt": 1770000000000
}
```

2. `/rides_live/{rideId}/driver_location`
```json
{
  "lat": -8.05389,
  "lng": -34.88111,
  "speed": 11.2,
  "heading": 120,
  "accuracy": 6,
  "ts": 1770000000123,
  "seq": 109
}
```

3. `/rides_live/{rideId}/passenger_location`
```json
{
  "lat": -8.05410,
  "lng": -34.88140,
  "accuracy": 8,
  "ts": 1770000000456,
  "seq": 20
}
```

4. `/rides_live/{rideId}/presence/{userId}`
```json
{
  "state": "ONLINE",
  "ts": 1770000000789,
  "appState": "foreground"
}
```

5. `/rides_live/{rideId}/eta`
```json
{
  "distanceM": 1240,
  "etaSec": 310,
  "updatedAt": 1770000000999,
  "source": "backend"
}
```

6. `/rides_live/{rideId}/signals`
```json
{
  "arrivedAtPickupAt": 1770000010000,
  "startedAt": 1770000020000,
  "completedAt": null
}
```

## Contratos de API (backend)

### 1) Emitir credencial realtime por corrida
`POST /api/v2/driver/rides/{rideId}/realtime-token`

Response:
```json
{
  "success": true,
  "firebase": {
    "dbUrl": "https://<project>.firebaseio.com",
    "customToken": "<firebase_custom_token>",
    "expiresAt": "2026-03-10T14:00:00.000Z",
    "rideId": "ride_123",
    "role": "driver"
  }
}
```

### 2) Snapshot operacional (auditoria oficial)
`POST /api/v2/driver/rides/{rideId}/location/snapshot`

Body:
```json
{
  "lat": -8.05389,
  "lng": -34.88111,
  "speed": 11.2,
  "heading": 120,
  "accuracy": 6,
  "capturedAt": "2026-03-10T13:59:22.000Z",
  "source": "mobile"
}
```

### 3) ETA backend
`GET /api/v2/driver/rides/{rideId}/eta`

## Claims recomendados no token Firebase
```json
{
  "uid": "user_driver_1",
  "role": "driver",
  "rideId": "ride_123",
  "canWrite": ["driver_location", "presence"],
  "canRead": true,
  "exp": 1770003600
}
```

## Mudancas exatas sugeridas no codigo atual

1. `src/v2/routes/driverV2Routes.ts`
- Adicionar `POST /rides/:rideId/realtime-token`
- Adicionar `POST /rides/:rideId/location/snapshot`
- Adicionar `GET /rides/:rideId/eta`

2. `src/v2/controllers/driverRealtimeController.ts` (novo)
- `issueRealtimeToken`
- `saveLocationSnapshot`
- `getRideEta`

3. `src/v2/services/driverRealtimeService.ts` (novo)
- Validacao de corrida/ator
- Emissao de custom token Firebase
- Rate-limit de snapshot (ex.: 1 por 15s)

4. `src/models/Ride.ts`
- Garantir campos `driver.id`, `rider.id`, `status`, `acceptedAt`, `pickedUpAt`, `completedAt`
- Opcional: `trackingSession`

5. `src/models/Driver.ts`
- Usar `location` com indice geoespacial para matching/heatmap

6. `src/v2/docs/openapi.yaml`
- Documentar os 3 endpoints acima e schemas de token/snapshot/eta

## Estados e responsabilidades
- `pending -> accepted`: API (endpoint accept)
- `accepted -> ongoing`: API (status endpoint)
- `ongoing -> completed`: API (status endpoint)
- `canceled`: API
- Firebase recebe apenas espelho visual de estados

## Frequencia e custo
- Driver foreground: 2-3s
- Driver background: 8-15s
- Passageiro: 5-15s (somente se tela ativa)
- Snapshot backend: a cada 15-30s + marcos de status

## SLOs recomendados
- Latencia de update realtime (p95): <= 800ms
- Disponibilidade do canal realtime: >= 99.9%
- Deriva ETA media: <= 15%

## Observabilidade
1. `traceId` em todos os endpoints de tracking
2. Log de rejeicao de write no Firebase Rules
3. Metricas:
- updates por corrida/minuto
- erro de publish
- custo mensal por 1k corridas

## Rollout sem downtime

### Fase 0 - Foundation
- Provisionar projeto Firebase + service account dedicada
- Configurar variaveis de ambiente no backend
- Publicar rules em staging

### Fase 1 - Shadow mode
- Backend gera token realtime, app conecta, mas UI ainda nao usa
- Coletar metrica de conectividade

### Fase 2 - Read only UI
- UI le localizacao do Firebase, status ainda vindo da API
- Monitorar diferenca de ETA e latencia

### Fase 3 - Full realtime
- UI com mapa realtime e presenca
- API continua fonte de verdade para status/pagamento

### Fase 4 - Otimizacao
- Ajustar frequencia dinamica por velocidade e estado
- Implementar compressao de trilha para historico

## Criterios de aceite tecnico
1. Regras Firebase impedem usuario fora da corrida de ler/escrever
2. Driver nao consegue escrever localizacao de outra corrida
3. Endpoint de token expira em no maximo 60 minutos
4. Snapshot backend respeita rate-limit
5. Status de corrida nao depende do Firebase
