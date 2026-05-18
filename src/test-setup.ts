// Installs fake IndexedDB globals (indexedDB, IDBKeyRange, etc.) before any module load.
// Dexie reads these at construction time, so they must exist before the first import.
import "fake-indexeddb/auto";
