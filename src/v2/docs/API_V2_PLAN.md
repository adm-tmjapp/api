# API V2 - Arquitetura por Visão

## Objetivo
Organizar a API em três visões de negócio com contratos claros e menor acoplamento:

- `admin`
- `passenger`
- `driver`

A `v1` continua ativa durante a migração, e a `v2` entra em paralelo para adoção gradual.

## Diagnóstico da V1

- Rotas muito extensas e com responsabilidades mistas (ex.: `rideRoutes.ts`, `vehicleRoutes.ts`).
- Mistura de contextos no mesmo endpoint (admin/passageiro/motorista) com baixa separação de domínio.
- Duplicidade de arquivos `*.ts` e `*.js` dentro de `src/`.
- Inconsistências de segurança em rotas sensíveis (ex.: tarifas na `v1` sem proteção de papel).
- Falta de padronização de contratos e versionamento por visão.

## Estrutura da V2

Prefixo base: `/api/v2`

- `/api/v2/auth` -> autenticação e verificação
- `/api/v2/admin` -> governança administrativa
- `/api/v2/passenger` -> jornada do passageiro
- `/api/v2/driver` -> jornada do motorista

## Rotas V2 (fase inicial)

### Auth
- `POST /api/v2/auth/login`
- `GET /api/v2/auth/onboarding-status/:id`
- `POST /api/v2/auth/forgot-password`
- `POST /api/v2/auth/forgot-password/verify`
- `POST /api/v2/auth/reset-password`
- `POST /api/v2/auth/email/send-code`
- `POST /api/v2/auth/email/verify`
- `POST /api/v2/auth/phone/send-code`
- `POST /api/v2/auth/phone/verify`
- `POST /api/v2/auth/resend-code`

### Admin
- Usuários: `GET/PUT /users/:id`, `PUT /users/:id/photo`, `PUT /users/:id/block`
- Produtos: `POST/GET /products`, `GET/PUT/DELETE /products/:id`
- Tarifas: `POST/GET /tarifas`, `PUT/DELETE /tarifas/:id`
- Veículos (moderação): `GET /vehicles`, `GET /vehicles/:id`, `PUT /vehicles/:id/approve|reject`
- Documentos de motorista (moderação): `GET /driver-documents`, `GET /driver-documents/:id`, `PUT /driver-documents/:id/approve|reject`
- Corridas (gestão): `GET /rides?status=...`, `DELETE /rides` (batch por ids)

### Passenger
- Corridas: `POST /rides/request`, `POST /rides`, `PUT /rides/:id/checkout`, `GET /rides`
- Pagamentos: `POST /payments`

### Driver
- Perfil: `POST /profile/register`, `GET /profile/:userId`
- Corridas: `GET /rides/pending`
- Veículos: `POST/GET /vehicles`, `GET/PUT/DELETE /vehicles/:id`, `POST/DELETE /vehicles/:id/documents`, `PUT /vehicles/:id/photo`
- Documentos: `POST/GET /driver-documents`, `GET/PUT/DELETE /driver-documents/:id`

## Próximas fases recomendadas

1. Extrair `use-cases` e `repositories` por domínio (`rides`, `users`, `fleet`, `onboarding`).
2. Padronizar respostas e erros (`code`, `message`, `details`, `traceId`).
3. Mover validações para schemas (Zod/Joi) por endpoint.
4. Introduzir testes de contrato para `v2` antes de deprecar a `v1`.
5. Remover arquivos JavaScript legados dentro de `src/` após estabilização.

## Blueprint realtime de tracking

- Documento arquitetural: `src/v2/docs/firebase/FIREBASE_TRACKING_BLUEPRINT.md`
- Contratos de canais: `src/v2/docs/firebase/FIREBASE_REALTIME_CONTRACTS.json`
- Regras base Firebase RTDB: `src/v2/docs/firebase/firebase-realtime-database.rules.json`
