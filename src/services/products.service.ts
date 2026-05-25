import { config } from "../config.js";
import type { CacheStore } from "../cache/cache.interface.js";
import {
  cacheHitTotal,
  cacheMissTotal,
} from "../observability/metrics.js";
import { withSpan } from "../observability/tracing.js";
import type { ProductRepository } from "../repositories/product.repository.js";
import type { Product } from "../types/index.js";

const PRODUCTS_CACHE_KEY = "products:all";

export class ProductsService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly cache: CacheStore,
  ) {}

  async listProducts(): Promise<Product[]> {
    return withSpan("products.list", async (span) => {
      const cached = await withSpan("cache.get", async () =>
        this.cache.getJson<Product[]>(PRODUCTS_CACHE_KEY),
      );

      if (cached) {
        cacheHitTotal.inc();
        span.setAttribute("cache", "hit");
        return cached;
      }

      cacheMissTotal.inc();
      span.setAttribute("cache", "miss");

      const products = await withSpan(
        "repository.findAll",
        async () => this.productRepository.findAll(),
      );

      await withSpan("cache.set", async () =>
        this.cache.setJson(
          PRODUCTS_CACHE_KEY,
          products,
          config.cacheTtlSeconds,
        ),
      );

      return products;
    });
  }
}
