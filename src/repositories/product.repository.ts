import type { Product } from "../types/index.js";

const SEED_PRODUCTS: Product[] = [
  { id: "p1", name: "Capa iPhone 15 Pro", price: 99.9, stock: 10 },
  { id: "p2", name: "Capa Samsung S24", price: 79.9, stock: 5 },
  { id: "p3", name: "Película Vidro Temperado", price: 29.9, stock: 50 },
];

export class ProductRepository {
  private readonly products = new Map<string, Product>();

  constructor(seed = SEED_PRODUCTS) {
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
  reset(seed = SEED_PRODUCTS): void {
    this.products.clear();
    for (const product of seed) {
      this.products.set(product.id, { ...product });
    }
  }
}
