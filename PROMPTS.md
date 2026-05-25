# Backend service implementation for CaseCellShop
_Exported on 25/05/2026 at 13:52:24 BRT from Cursor (3.5.33)_

---

**User**

Escopo da mini-tarefa
Implemente um pequeno serviço backend para a CaseCellShop que exponha catálogo de produtos com
cache, inicie um checkout assíncrono e permita consultar o status do pedido.
Use dados em memória ou serviços locais/simulados se preferir. O objetivo é demonstrar raciocínio sênior
de backend, cache, observabilidade e consistência, não construir um e-commerce completo.
Não é necessário implementar autenticação, pagamento real, deploy, front-end ou integração real com ERP.
Explique qualquer simplificação feita por se tratar de desafio técnico.
O que esperamos observar na entrega
Back-end — API, cache e contrato
☐ GET /products retorna produtos e usa cache com TTL ou estratégia equivalente.
☐ POST /checkout inicia uma compra e retorna 202 Accepted com orderId/status.
☐ GET /orders/{orderId}/status permite acompanhar o processamento.
☐ Há OpenAPI ou contrato equivalente com schemas de sucesso e erro.
Observabilidade
☐ Logs estruturados incluem correlationId/requestId e orderId quando existir.
☐ Há métricas relevantes, incluindo cache hit/miss e processamento de checkout/fila.
☐ Há trace/span real ou stub justificado ligando request, cache, repo fake e worker.
☐ README inclui exemplo de dashboard, alerta ou runbook para Datadog ou equivalente.
Concorrência, assíncrono e entrega
☐ Checkout evita venda além do estoque usando atomic update, lock, reserva ou simulação coerente.
☐ Há idempotência simples para retries ou duplo clique e worker simulando envio ao ERP.
☐ Testes automatizados cobrem regra de negócio, cache e concorrência.
☐ README documenta decisões, trade-offs, limitações, instruções para rodar e prompts de IA. - gerar base do codigo em nodejs e tudo que eu colocar no agent add no  @pronpt.md 

---

**Cursor**

Vou implementar o backend Node.js conforme o escopo e ler o que já existe no projeto e em `pronpt.md`.


O `pronpt.md` já traz a especificação; o repositório está vazio. Vou gerar a base Node.js completa conforme o escopo.


Implementei a base completa do backend **CaseCellShop** em Node.js/TypeScript e consolidei o escopo do desafio em `pronpt.md`.

## O que foi entregue

### API
| Endpoint | Comportamento |
|----------|----------------|
| `GET /products` | Catálogo com cache TTL 60s (`products:all`) |
| `POST /checkout` | Reserva estoque → fila → **202** `{ orderId, status: "processing" }` |
| `GET /orders/:orderId/status` | `processing` → `completed` / `failed` |

Contrato: `openapi.yaml`, Swagger em `/docs`, YAML em `/openapi.yaml`.

### Observabilidade
- **Logs** Pino JSON: `requestId`, `correlationId`, `orderId`
- **Métricas** Prometheus em `/metrics`: cache hit/miss, checkout, worker, HTTP
- **Tracing** OpenTelemetry (spans request → cache → repo → queue → worker)

### Concorrência e assíncrono
- **Mutex** por produto (`async-mutex`) para evitar overselling
- **Idempotência** via header `Idempotency-Key`
- **Worker** simula ERP (BullMQ + Redis, ou fila in-memory nos testes)

### Testes
**11 testes** passando: cache hit/miss, checkout, idempotência, concorrência (10 requests → 5 aceitos para estoque 5).

## Como rodar

```bash
cd /Users/marcosvicente/Personal/CaseCellShop
npm install

# Sem Docker (modo memória)
USE_IN_MEMORY=true npm run dev

# Com Redis + BullMQ
docker compose up -d redis
npm run dev

npm test
```

## Arquivos principais

- `src/app.ts` — composição da aplicação
- `src/services/checkout.service.ts` — reserva de estoque + fila
- `src/workers/checkout.worker.ts` — ERP fake
- `README.md` — decisões, trade-offs, runbook Datadog
- `pronpt.md` — escopo do agent + checklist + referência técnica

## Simplificações (desafio)

Documentadas no README: sem auth/pagamento/ERP real, repositório em memória, lock local (não distribuído), tracing in-process sem export OTLP.

Se quiser, no próximo passo posso subir o Redis via Docker e validar o fluxo BullMQ end-to-end, ou preparar o commit/PR.

---

**User**

generate swagger-ui to test ap=p=

---

**Cursor**

Vou verificar a configuração atual do Swagger UI e garantir que funcione para testar a API.


Vou configurar o Swagger UI para carregar o `openapi.yaml` completo e permitir testar a API com "Try it out".


Swagger UI está configurado para testar a API no browser.

## Como usar

```bash
npm run dev
```

Abra: **http://localhost:3000/docs**  
(ou http://localhost:3000 — redireciona para `/docs`)

## Fluxo no Swagger UI

1. **GET /products** → *Try it out* → *Execute*
2. **POST /checkout** → *Try it out* → use o body de exemplo → *Execute* → copie o `orderId`
3. **GET /orders/{orderId}/status** → cole o `orderId` → *Execute* (status passa a `completed` em ~200ms)

Opcional: header `Idempotency-Key` no checkout para testar retry.

## Endpoints úteis

| URL | Uso |
|-----|-----|
| `/docs` | Swagger UI interativo |
| `/docs/json` | Spec OpenAPI em JSON |
| `/openapi.yaml` | Spec em YAML |

A spec vem do `openapi.yaml` (modo estático), com exemplos no checkout e *Try it out* habilitado por padrão.

---

**User**

For the code present, we get this error:
```
A propriedade 'statusCode' não existe no tipo 'void & Promise<Response> & Chain'.
```
Fix it, verify, and then give a concise explanation. @tests/products.test.ts:17-20 

---

**Cursor**

Conflito de nome: `inject` colide com o helper global do Vitest. Renomeando o helper da API.


---

**User**

generate seed

---

**Cursor**

Vou extrair os dados iniciais para um módulo de seed dedicado e adicionar um script para carregá-los.


---

**User**

@README.md:171-172 add desc

---

**Cursor**

Atualizei a seção **Estrutura** no README:

- **`seed/`** — catálogo inicial (produtos/estoque); `npm run seed` gera `data/products.seed.json`
- **`observability/`** — logs Pino, métricas Prometheus, tracing OpenTelemetry e request context

Também incluí **`data/`** e **`scripts/`**, ligados ao fluxo de seed.

