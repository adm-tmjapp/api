# Driver Matching + Push Backlog

## Objetivo

Evoluir o fluxo de distribuição de corridas para o motorista, saindo do modelo
apenas por consulta manual no dashboard para um modelo híbrido:

1. motorista continua podendo consultar corridas pendentes
2. backend passa a distribuir corridas por proximidade
3. backend envia push para os motoristas elegíveis
4. aceite continua atômico no backend

## Estado atual

Hoje a API já possui:

- `PATCH /api/v2/driver/availability`
- `GET /api/v2/driver/dashboard`
- `GET /api/v2/driver/rides/pending`
- `POST /api/v2/driver/rides/:rideId/accept`
- `POST /api/v2/driver/rides/:rideId/realtime-token`

Limitações atuais:

1. `Driver.isAvailable` existe, mas não há fluxo operacional de atualização
   contínua da localização do motorista fora da corrida.
2. O filtro por distância no dashboard depende do app enviar `lat/lng/radiusKm`
   a cada consulta.
3. Não existe matching automático por proximidade.
4. Não existe push de nova corrida para os motoristas elegíveis.
5. Não existe trilha operacional do dispatch por corrida.

## Decisões de modelagem

### Driver

Expandir o model `Driver` para suportar operação em tempo real:

- `location`: manter em formato GeoJSON
- `lastLocationAt: Date`
- `lastHeading?: number`
- `lastSpeed?: number`
- `lastAccuracy?: number`
- índice `2dsphere` em `location`
- índice composto em `isAvailable + lastLocationAt`

Arquivo:
- `src/models/Driver.ts`

### DriverDeviceToken

Criar model para push notification:

- `driverUserId`
- `provider` (`fcm`)
- `token`
- `platform` (`android|ios`)
- `isActive`
- `lastSeenAt`
- `createdAt`
- `updatedAt`

Arquivo novo:
- `src/models/DriverDeviceToken.ts`

### RideDispatchAttempt

Criar model para auditoria e controle de reoferta:

- `rideId`
- `dispatchRound`
- `radiusKm`
- `candidateDriverUserIds`
- `notifiedDriverUserIds`
- `acceptedDriverUserId`
- `status` (`OPEN|ACCEPTED|EXPIRED|CANCELED`)
- `startedAt`
- `expiresAt`
- `completedAt`

Arquivo novo:
- `src/models/RideDispatchAttempt.ts`

## Endpoints novos

### 1. Atualizar localização operacional do motorista

`POST /api/v2/driver/location`

Request:

```json
{
  "lat": -8.05,
  "lng": -34.90,
  "heading": 120,
  "speed": 18,
  "accuracy": 12
}
```

Response:

```json
{
  "success": true,
  "location": {
    "lat": -8.05,
    "lng": -34.90,
    "heading": 120,
    "speed": 18,
    "accuracy": 12,
    "updatedAt": "2026-03-13T20:00:00Z"
  }
}
```

Regras:

1. somente motorista autenticado
2. persistir `Driver.location`
3. atualizar `lastLocationAt`
4. aplicar rate limit leve
5. ignorar payload inválido

### 2. Registrar token do dispositivo do motorista

`POST /api/v2/driver/device-token`

Request:

```json
{
  "provider": "fcm",
  "token": "string",
  "platform": "android"
}
```

Response:

```json
{
  "success": true,
  "message": "Token do dispositivo atualizado com sucesso."
}
```

Regras:

1. upsert por `driverUserId + token`
2. marcar token antigo como inativo se necessário
3. atualizar `lastSeenAt`

## Serviços novos

### DriverLocationService

Arquivo novo:
- `src/v2/services/driverLocationService.ts`

Responsabilidades:

1. validar payload de localização
2. persistir `Driver.location`
3. atualizar `lastLocationAt`
4. expor resposta para o app

### DriverDeviceTokenService

Arquivo novo:
- `src/v2/services/driverDeviceTokenService.ts`

Responsabilidades:

1. registrar/atualizar token do device
2. inativar tokens inválidos
3. buscar tokens ativos para push

### RideMatchingService

Arquivo novo:
- `src/v2/services/rideMatchingService.ts`

Responsabilidades:

1. receber uma corrida disponível
2. buscar motoristas elegíveis por proximidade
3. ordenar por distância
4. limitar candidatos por rodada
5. registrar tentativa de dispatch
6. entregar payload para push

Regra inicial sugerida:

1. raio inicial: `3km`
2. máximo por rodada: `10` motoristas
3. localização válida: `lastLocationAt <= 120s`
4. expandir para `5km` e depois `8km` se necessário
5. timeout inicial por rodada: `10s`

Variáveis sugeridas para configuração no backend:

- `DRIVER_MATCHING_LOCATION_FRESHNESS_MS`
- `DRIVER_MATCHING_INITIAL_RADIUS_KM`
- `DRIVER_MATCHING_MAX_CANDIDATES`
- `DRIVER_MATCHING_DISPATCH_TIMEOUT_MS`

### DriverPushService

Arquivo novo:
- `src/v2/services/driverPushService.ts`

Responsabilidades:

1. usar `firebase-admin` para envio FCM
2. enviar `NEW_RIDE_REQUEST`
3. tratar falhas e inativar token inválido

Payload sugerido:

```json
{
  "type": "NEW_RIDE_REQUEST",
  "rideId": "string",
  "pickupAddress": "string",
  "distanceKm": 2.4,
  "etaMin": 5,
  "price": 18.9
}
```

## Fluxo operacional sugerido

### Corrida criada / checkout concluído

1. passageiro cria ou finaliza checkout
2. corrida fica elegível para dispatch
3. `RideMatchingService` busca motoristas `ONLINE`
4. filtra por `Driver.location`
5. cria `RideDispatchAttempt`
6. envia push aos candidatos
7. app motorista recebe oferta
8. `POST /driver/rides/:rideId/accept` continua sendo o aceite oficial

Observação:

- o tempo oficial de espera deve ser controlado pelo backend
- o app deve apenas exibir o contador usando os campos `startedAt`,
  `expiresAt` e `dispatchTimeoutMs` retornados pela API

### Fallback

Se ninguém aceitar:

1. marcar tentativa anterior como expirada
2. ampliar raio
3. criar nova rodada
4. reenviar push
5. manter `GET /driver/rides/pending` como fallback de UX

## Regras de concorrência

1. push não substitui aceite atômico
2. somente um motorista pode aceitar
3. `acceptRide` continua usando update condicional
4. não reenviar para motorista que já recebeu a mesma corrida na mesma janela

## OpenAPI

Atualizar:

- `src/v2/docs/openapi.yaml`

Adicionar:

1. `POST /driver/location`
2. `POST /driver/device-token`
3. schemas de request/response
4. erros padronizados

## Rotas

Atualizar:

- `src/v2/routes/driverV2Routes.ts`

Adicionar:

1. `POST /location`
2. `POST /device-token`

## Controllers

Arquivos novos:

- `src/v2/controllers/driverLocationController.ts`
- `src/v2/controllers/driverDeviceTokenController.ts`

## Integração com fluxo atual

### `driverDashboardService`

Melhorias futuras:

1. usar `Driver.location` como default do filtro quando o app não mandar `lat/lng`
2. opcionalmente expor `locationFreshness`

Arquivo:
- `src/v2/services/driverDashboardService.ts`

### `passengerAppService`

Ponto de integração:

1. após criar a corrida ou concluir checkout
2. chamar `RideMatchingService.startDispatch(rideId)`

Arquivo:
- `src/v2/services/passengerAppService.ts`

## Ordem recomendada de entrega

### Fase 1

1. model `Driver` com `lastLocationAt` + índice geoespacial
2. `POST /driver/location`
3. `POST /driver/device-token`
4. `DriverPushService`

### Fase 2

1. `RideMatchingService`
2. `RideDispatchAttempt`
3. dispatch inicial por raio
4. push para motoristas elegíveis

### Fase 3

1. expansão automática de raio
2. auditoria de dispatch
3. regras de timeout por rodada
4. score operacional do candidato

## Riscos e cuidados

1. localização velha não pode entrar no matching
2. volume alto de updates exige rate limit
3. push não é garantia de entrega, manter fallback
4. evitar reoferta duplicada para o mesmo motorista
5. garantir índices antes de escalar consultas geográficas
