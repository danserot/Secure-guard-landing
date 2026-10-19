import type { ProductDatabase } from "../domain/models";
import { createSeedDatabase } from "./seeds";

const STORAGE_KEY = "secureguard.product-data.v1";
let memoryDatabase: ProductDatabase | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function storageAvailable() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function readDatabase(): ProductDatabase {
  if (storageAvailable()) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProductDatabase;
        if (
          parsed.version === 1 &&
          Array.isArray(parsed.cameras) &&
          Array.isArray(parsed.incidents) &&
          Array.isArray(parsed.posEvents)
        )
          return clone(parsed);
      }
    } catch {
      // A corrupt or unavailable browser store is replaced with a safe seed below.
    }
  }

  if (!memoryDatabase) memoryDatabase = createSeedDatabase();
  const seeded = clone(memoryDatabase);
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      /* Keep the in-memory fallback. */
    }
  }
  return seeded;
}

export function writeDatabase(database: ProductDatabase) {
  memoryDatabase = clone(database);
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
    } catch {
      /* Keep the in-memory fallback. */
    }
  }
  return clone(database);
}

export function updateDatabase(
  updater: (database: ProductDatabase) => ProductDatabase,
) {
  return writeDatabase(updater(readDatabase()));
}

export function resetDatabase() {
  memoryDatabase = null;
  if (storageAvailable()) window.localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY as PRODUCT_DATABASE_KEY };
