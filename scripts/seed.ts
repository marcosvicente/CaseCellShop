#!/usr/bin/env npx tsx
/**
 * Gera / valida o catálogo seed e grava data/products.seed.json.
 * Uso: npm run seed
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogSeed, cloneCatalogSeed } from "../src/seed/index.js";

const outPath = join(process.cwd(), "data", "products.seed.json");

const products = cloneCatalogSeed();
writeFileSync(outPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");

console.log(`Seed: ${products.length} produtos → ${outPath}`);
for (const p of catalogSeed) {
  console.log(`  ${p.id}  ${p.name.padEnd(32)}  R$ ${p.price.toFixed(2)}  estoque ${p.stock}`);
}
