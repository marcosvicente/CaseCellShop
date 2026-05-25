import type { CacheStore } from "../cache/cache.interface.js";
import type { CheckoutResponse } from "../types/index.js";

const IDEM_PREFIX = "idem:";
const IDEM_TTL_SECONDS = 86400;

export class IdempotencyService {
  constructor(private readonly cache: CacheStore) {}

  private key(idempotencyKey: string): string {
    return `${IDEM_PREFIX}${idempotencyKey}`;
  }

  async get(idempotencyKey: string): Promise<CheckoutResponse | null> {
    return this.cache.getJson<CheckoutResponse>(this.key(idempotencyKey));
  }

  async save(
    idempotencyKey: string,
    response: CheckoutResponse,
  ): Promise<void> {
    await this.cache.setJson(
      this.key(idempotencyKey),
      response,
      IDEM_TTL_SECONDS,
    );
  }
}
