# CaseCellShop Backend (desafio técnico)

Backend mínimo em **Node.js + TypeScript + Fastify** que expõe catálogo com cache, inicia checkout assíncrono e permite consultar status do pedido. Foco em cache, observabilidade, consistência de estoque e processamento em fila — não é um e-commerce completo.

## Escopo entregue

| Requisito | Implementação |
|-----------|----------------|
| `GET /products` + cache TTL | Cache `products:all`, TTL 60s (Redis ou memória) |
| `POST /checkout` → 202 | Reserva estoque + fila + `orderId` / `processing` |
| `GET /orders/{orderId}/status` | `processing` → `completed` / `failed` |
| Contrato OpenAPI | `openapi.yaml` + Swagger UI em `/docs` |
| Logs estruturados | Pino JSON com `requestId`, `correlationId`, `orderId` |
| Métricas | Prometheus em `/metrics` (cache hit/miss, checkout, worker) |
| Tracing | OpenTelemetry spans (request → cache → repo → queue → worker) |
| Estoque concorrente | `async-mutex` por `productId` + decremento atômico |
| Idempotência | Header `Idempotency-Key` persistido no cache |
| Worker ERP fake | BullMQ (prod) ou fila in-memory (testes) |
| Testes | Vitest: cache, checkout, idempotência, concorrência |

## Simplificações (desafio)

- Sem autenticação, pagamento real ou ERP real.
- Repositório de produtos/pedidos **em memória** (estoque e pedidos não sobrevivem restart).
- Lock **local** (`async-mutex`); em produção usaria lock distribuído (Redis/Redlock).
- Idempotência sem lock distribuído: race rara em retry simultâneo aceita como limitação documentada.
- Tracing registra spans in-process; export OTLP para Datadog seria plugado no agent.
- Modo `USE_IN_MEMORY=true` (padrão em testes) dispensa Redis para CI local.

## Decisões e trade-offs

1. **Cache aside** no catálogo: simples, métricas claras de hit/miss; invalidação manual não é necessária no desafio (TTL curto).
2. **Reserva de estoque síncrona** antes do 202: garante que não aceitamos pedido sem estoque; worker só simula ERP.
3. **Fila BullMQ** com Redis em runtime real; testes usam fila in-memory para não depender de infra.
4. **Fastify + schemas** para validação e documentação viva; `openapi.yaml` é a fonte de contrato versionável.

## Como rodar

```bash
npm install

# Opção A — só API (memória + fila local, sem Docker)
USE_IN_MEMORY=true npm run dev

# Opção B — com Redis (recomendado para fila BullMQ)
docker compose up -d redis
npm run dev:redis
```

### Dev Container (VS Code / Cursor)

1. **Reopen in Container** (`.devcontainer/`)
2. Aguarde `postCreateCommand` (`npm install` + `npm run seed`)
3. No terminal do container:

```bash
npm run dev:redis
```

Redis já sobe como serviço `redis`; `REDIS_URL=redis://redis:6379` vem configurado. Portas **3000** (API/Swagger) e **6379** (Redis) são encaminhadas automaticamente.

- API: http://localhost:3000  
- **Swagger UI (testar API):** http://localhost:3000/docs — use **Try it out** em cada endpoint  
- Redirecionamento: http://localhost:3000 → `/docs`  
- OpenAPI YAML: http://localhost:3000/openapi.yaml  
- OpenAPI JSON: http://localhost:3000/docs/json  
- Métricas: http://localhost:3000/metrics  

### Testar no Swagger UI

1. `npm run dev`
2. Abra http://localhost:3000/docs
3. **GET /products** → Try it out → Execute (catálogo em cache)
4. **POST /checkout** → Try it out → body de exemplo → Execute → copie `orderId`
5. **GET /orders/{orderId}/status** → cole o `orderId` → Execute (aguarde `completed` após ~200ms)
6. Opcional: header `Idempotency-Key` no checkout para testar retry

### Seed do catálogo

Produtos iniciais em `src/seed/catalog.seed.ts` (carregados automaticamente ao subir a API).

```bash
npm run seed   # regenera data/products.seed.json e lista o catálogo
```

### Testes

```bash
npm test
```

### Exemplos curl

```bash
curl -s http://localhost:3000/products | jq

curl -s -X POST http://localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: my-key-1' \
  -H 'x-correlation-id: corr-demo-1' \
  -d '{"items":[{"productId":"p1","quantity":1}]}' | jq

curl -s http://localhost:3000/orders/<orderId>/status | jq
```

## Observabilidade

### Logs (Pino)

```json
{
  "level": 30,
  "service": "casecellshop-backend",
  "requestId": "a1b2-...",
  "correlationId": "corr-demo-1",
  "orderId": "ord_...",
  "msg": "checkout accepted"
}
```

Envie `x-request-id` e `x-correlation-id` para correlacionar retries e filas.

### Métricas Prometheus

- `cache_hit_total` / `cache_miss_total`
- `checkout_started_total` / `checkout_completed_total` / `checkout_failed_total`
- `worker_jobs_total{result}` / `worker_duration_ms`
- `http_request_duration_ms{method,route,status_code}`

### Datadog — exemplo de dashboard / alertas / runbook

**Dashboard (widgets sugeridos)**

1. **Cache hit ratio** — `sum:cache_hit_total / (sum:cache_hit_total + sum:cache_miss_total)`  
2. **Checkout throughput** — `rate(checkout_started_total)` vs `rate(checkout_completed_total)`  
3. **Falhas** — `rate(checkout_failed_total)`  
4. **Latência worker** — p95 de `worker_duration_ms`  
5. **HTTP p95** — `http_request_duration_ms` por rota  

**Alertas**

| Alerta | Condição | Runbook |
|--------|----------|---------|
| Alta taxa de falha checkout | `checkout_failed / checkout_started > 5%` (5m) | Ver logs com `orderId`, checar worker/Redis; reprocessar job manualmente se DLQ existir |
| Fila lenta | p95 `worker_duration_ms > 2000` (10m) | Escalar workers; verificar ERP simulado / rede |
| Cache ineficiente | hit ratio < 70% (15m) | Revisar TTL; verificar cold start ou chave incorreta |
| Erro 5xx HTTP | `http 5xx rate > 1%` | Trace por `correlationId`; rollback deploy |

**Runbook rápido — pedido preso em `processing`**

1. `GET /orders/{id}/status`  
2. Buscar log `orderId` + `correlationId`  
3. Confirmar worker ativo e Redis up (`docker compose ps`)  
4. Se job falhou 3x no BullMQ, status deve ser `failed` com `failureReason`

### Tracing

Spans: `products.list` → `cache.get` / `repository.findAll`, `checkout.start` → `checkout.reserveStock` → `queue.publish`, `worker.processCheckout` → `worker.fakeERP`.

Em produção: `OTEL_EXPORTER_OTLP_ENDPOINT` para Datadog Agent.

## Uso de IA

Ferramentas de IA foram usadas para:

- Estruturar o repositório e o `pronpt.md` inicial
- Gerar boilerplate de rotas, métricas e testes
- Redigir README e runbook

Todas as decisões (reserva síncrona, mutex local, fila dual-mode) foram revisadas manualmente.

## Estrutura

```text
.devcontainer/  # Node 22 + Redis 7 para desenvolvimento no container
src/
  app.ts, server.ts
  routes/       # products, checkout, orders, health, metrics
  services/     # catalog, checkout, idempotency, orders
  repositories/ # in-memory products & orders
  cache/        # Redis + memory
  queue/        # BullMQ + in-memory
  workers/      # ERP simulation
  seed/         # Catálogo inicial (produtos/estoque); `npm run seed` → `data/products.seed.json`
  observability/ # Logs Pino, métricas Prometheus, tracing OpenTelemetry, request context
tests/
data/           # JSON gerado pelo script de seed (referência / integrações)
scripts/        # `seed.ts` — regenera o catálogo em disco
openapi.yaml
docker-compose.yml
```
