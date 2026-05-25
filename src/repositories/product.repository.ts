import { cloneCatalogSeed } from "../seed/index.js";
import type { Product } from "../types/index.js";

export class ProductRepository {
  private readonly products = new Map<string, Product>();

  constructor(seed: Product[] = cloneCatalogSeed()) {
    for (const product of seed) {
      this.products.set(product.id, { ...product });
    }
  }

  findAll(): Product[] {
    return Array.from(this.products.values()).map((p) => ({ ...p }));
  }

  findById(id: string): Product | undefined {
    const product = this.products.get(id);
    return product ? { ...product } : undefined;
  }

  save(product: Product): void {
    this.products.set(product.id, { ...product });
  }

  /** Test helper: reset catalog to seed state */
  reset(seed: Product[] = cloneCatalogSeed()): void {
    this.products.clear();
    for (const product of seed) {
      this.products.set(product.id, { ...product });
    }
  }
}
