# CaseCellShop Backend Challenge

## Escopo da mini-tarefa (agent / desafio)

Implementar um pequeno serviço backend para a CaseCellShop que:

- exponha catálogo de produtos com **cache**;
- inicie um **checkout assíncrono**;
- permita consultar o **status do pedido**.

Usar dados em memória ou serviços locais/simulados. Objetivo: demonstrar raciocínio sênior de backend, cache, observabilidade e consistência — **não** construir e-commerce completo.

**Fora de escopo:** autenticação, pagamento real, deploy obrigatório, front-end, ERP real.

### Checklist de entrega

**Back-end — API, cache e contrato**

- [x] `GET /products` retorna produtos e usa cache com TTL ou equivalente
- [x] `POST /checkout` inicia compra e retorna **202 Accepted** com `orderId` / `status`
- [x] `GET /orders/{orderId}/status` acompanha processamento
- [x] OpenAPI ou contrato equivalente com schemas de sucesso e erro

**Observabilidade**

- [x] Logs estruturados com `correlationId` / `requestId` e `orderId` quando existir
- [x] Métricas: cache hit/miss, checkout, fila/worker
- [x] Trace/span ligando request, cache, repo fake e worker (OpenTelemetry in-process)
- [x] README com exemplo dashboard/alerta/runbook Datadog

**Concorrência, assíncrono e entrega**

- [x] Checkout evita overselling (mutex por produto + reserva atômica)
- [x] Idempotência via `Idempotency-Key` + worker simulando ERP
- [x] Testes automatizados: negócio, cache, concorrência
- [x] README: decisões, trade-offs, limitações, como rodar, uso de IA

**Stack:** Node.js, TypeScript, Fastify, Redis/BullMQ (opcional), Vitest — ver `package.json` e `README.md`.

---

## Overview

Backend simplificado focado em catálogo com cache, checkout assíncrono, status de pedido, observabilidade, concorrência, idempotência e testes.

## Tech Stack

- Node.js 20+
- TypeScript
- Fastify
- Redis (cache + idempotência + BullMQ)
- BullMQ
- OpenTelemetry (spans in-process)
- Prometheus (`prom-client`)
- Pino
- Vitest

## Project Structure

```text
src/
  app.ts, server.ts
  routes/       products, checkout, orders, health, metrics
  services/     products, checkout, orders, idempotency
  repositories/ product, order (in-memory)
  cache/        memory + redis
  queue/        bullmq + in-memory
  workers/      checkout ERP simulation
  observability/ logger, metrics, tracing, request-context
  locks/        product mutex
tests/
openapi.yaml
docker-compose.yml
README.md
```

## API Endpoints

### GET /products

- Cache key: `products:all`
- TTL: 60s (`CACHE_TTL_SECONDS`)
- Métricas: `cache_hit_total`, `cache_miss_total`

### POST /checkout

- Header opcional: `Idempotency-Key`
- Resposta: **202** `{ orderId, status: "processing" }`
- Erros: 400 validação, 409 sem estoque

### GET /orders/:orderId/status

- Status: `processing` | `completed` | `failed`

## Architecture Flow

### Products

```text
Request → cache.get → hit? return
         → miss → repository.findAll → cache.set(TTL) → return
```

### Checkout

```text
POST /checkout → idempotency? → mutex reserve stock → create order
              → queue.publish → 202
Worker → fake ERP → update status completed/failed
```

## Concurrency

`async-mutex` por `productId` — decremento de estoque dentro de `runExclusive`.

## Idempotency

`Idempotency-Key` → cache `idem:{key}` TTL 24h.

## Observability

- Logs Pino: `requestId`, `correlationId`, `orderId`
- Métricas em `/metrics`
- Spans: `products.list`, `checkout.start`, `worker.processCheckout`

## Run

```bash
npm install
USE_IN_MEMORY=true npm run dev   # sem Redis
docker compose up -d redis && npm run dev
npm test
```

## AI Usage

IA usada para estruturar repositório, boilerplate e documentação. Decisões revisadas manualmente.
