// Installs fake IndexedDB globals (indexedDB, IDBKeyRange, etc.) before any module load.
// Dexie reads these at construction time, so they must exist before the first import.
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { db } from "./utils/db";

// Clear every Dexie table. Used in the global beforeEach and exposed for tests that
// need to reset state mid-test. We don't use Dexie.delete because the production code
// holds a module-scope singleton — deleting the database would close it, leaving every
// test writing into a closed handle. Clearing rows leaves the singleton open.
export async function resetDb(): Promise<void> {
  await Promise.all(db().tables.map((t) => t.clear()));
}

beforeEach(resetDb);
