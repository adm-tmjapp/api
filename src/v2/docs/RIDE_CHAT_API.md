# Chat de corrida

Os endpoints abaixo exigem `Authorization: Bearer <token>` e só permitem acesso ao passageiro ou motorista vinculado à corrida. O envio e a leitura ficam disponíveis apenas nos status `accepted` e `ongoing`; após conclusão ou cancelamento, a comunicação é encerrada por segurança.

## Mensagens

`GET /api/v2/passenger/rides/:rideId/messages` e `GET /api/v2/driver/rides/:rideId/messages`

Retorna as últimas 100 mensagens. O histórico é removido automaticamente após 30 dias.

`POST /api/v2/{passenger|driver}/rides/:rideId/messages`

Body: `{ "content": "Estou no local" }`. O conteúdo tem limite de 500 caracteres, bloqueia links/telefones e possui limite de 30 mensagens por minuto por usuário.

`PATCH /api/v2/{passenger|driver}/rides/:rideId/messages/read`

Marca como lidas as mensagens recebidas.

`GET /api/v2/{passenger|driver}/rides/:rideId/messages/unread-count`

Retorna `{ "success": true, "unreadCount": 0 }`.

## Push

`POST /api/v2/passenger/device-token` registra o token FCM do passageiro. O motorista já usa `/api/v2/driver/device-token`.

Ao enviar uma mensagem, a API dispara uma notificação FCM para o outro participante. Tokens inválidos são desativados automaticamente.
