import { db } from "./db";
import { loadAuthInfo, loadSettings } from "./settings";

const DEFAULT_BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://127.0.0.1:3211";

async function postSync<T>(path: string, body: object): Promise<T> {
  const auth = await loadAuthInfo();
  if (!auth) throw new Error("not signed in");
  const settings = await loadSettings();
  const base = settings.backendUrl || DEFAULT_BACKEND_URL;
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sync ${path} ${res.status}`);
  return (await res.json()) as T;
}

// Whitelist of (Dexie table, key extractor). `kv` is excluded — its keys mix
// device-local secrets (authToken, backendUrl) with cross-device settings; if
// we want to sync individual kv keys later, add a separate whitelist there.
interface SyncedTable {
  name: string;
  primaryKey: (row: Record<string, unknown>) => string;
}

const SYNCED_TABLES: SyncedTable[] = [
  { name: "flashcards", primaryKey: (r) => String(r.id) },
  { name: "grammarCards", primaryKey: (r) => String(r.id) },
  { name: "abilities", primaryKey: (r) => String(r.id) },
  { name: "goals", primaryKey: (r) => String(r.language) },
  { name: "customLanguages", primaryKey: (r) => String(r.name) },
  { name: "streaksLang", primaryKey: (r) => `${String(r.language)}|${String(r.date)}` },
  { name: "assessments", primaryKey: (r) => String(r.id) },
];

const LAST_PULLED_AT_KEY = "sync_lastPulledAt";
const LAST_PUSHED_AT_KEY = "sync_lastPushedAt";
const HOOKS_INSTALLED = { value: false };

interface Delta {
  table: string;
  key: string;
  data: string;
  updatedAt: number;
  deleted: boolean;
}

interface PullResponse {
  rows: Delta[];
  lastUpdatedAt: number;
  hasMore: boolean;
}

interface PushResponse {
  applied: number;
  skipped: number;
}

function tableConfig(name: string): SyncedTable | undefined {
  return SYNCED_TABLES.find((t) => t.name === name);
}

// Dexie hooks: stamp updatedAt on writes; record tombstones on deletes. Must
// install once, BEFORE the first read/write, otherwise existing rows never
// pick up the field. Called from main.tsx pre-render.
export function installSyncHooks(): void {
  if (HOOKS_INSTALLED.value) return;
  HOOKS_INSTALLED.value = true;
  for (const { name } of SYNCED_TABLES) {
    const table = db().table(name);
    table.hook("creating", (_pk, obj) => {
      (obj as Record<string, unknown>).updatedAt = Date.now();
    });
    table.hook("updating", (mods) => ({ ...(mods as object), updatedAt: Date.now() }));
    table.hook("deleting", (pk, obj) => {
      const cfg = tableConfig(name);
      if (!cfg) return;
      const key = obj ? cfg.primaryKey(obj as Record<string, unknown>) : String(pk);
      void db().tombstones.put({
        id: `${name}|${key}`,
        table: name,
        key,
        updatedAt: Date.now(),
      });
    });
  }
}

async function getWatermark(key: string): Promise<number> {
  const row = await db().kv.get(key);
  return typeof row?.value === "number" ? row.value : 0;
}

async function setWatermark(key: string, value: number): Promise<void> {
  await db().kv.put({ key, value });
}

async function collectLocalDeltas(since: number): Promise<Delta[]> {
  const deltas: Delta[] = [];
  for (const cfg of SYNCED_TABLES) {
    const rows = await db().table(cfg.name).where("updatedAt").above(since).toArray();
    for (const row of rows as Record<string, unknown>[]) {
      const key = cfg.primaryKey(row);
      const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : Date.now();
      deltas.push({
        table: cfg.name,
        key,
        data: JSON.stringify(row),
        updatedAt,
        deleted: false,
      });
    }
  }
  const tombs = await db().tombstones.where("updatedAt").above(since).toArray();
  for (const t of tombs) {
    deltas.push({
      table: t.table,
      key: t.key,
      data: "",
      updatedAt: t.updatedAt,
      deleted: true,
    });
  }
  return deltas;
}

async function applyRemoteRows(rows: Delta[]): Promise<void> {
  for (const cfg of SYNCED_TABLES) {
    const forTable = rows.filter((r) => r.table === cfg.name);
    if (forTable.length === 0) continue;
    const table = db().table(cfg.name);
    for (const row of forTable) {
      const existing = (await table.get(row.key)) as Record<string, unknown> | undefined;
      const existingUpdatedAt =
        existing && typeof existing.updatedAt === "number" ? existing.updatedAt : 0;
      if (existingUpdatedAt >= row.updatedAt) continue;
      if (row.deleted) {
        await table.delete(row.key);
      } else {
        const parsed = JSON.parse(row.data) as Record<string, unknown>;
        await table.put(parsed);
      }
    }
  }
}

let syncInFlight = false;

async function runSync(): Promise<void> {
  const lastPushedAt = await getWatermark(LAST_PUSHED_AT_KEY);
  const deltas = await collectLocalDeltas(lastPushedAt);
  if (deltas.length > 0) {
    await postSync<PushResponse>("/api/sync/push", { deltas });
    const newWatermark = Math.max(...deltas.map((d) => d.updatedAt));
    await setWatermark(LAST_PUSHED_AT_KEY, newWatermark);
  }
  let since = await getWatermark(LAST_PULLED_AT_KEY);
  for (;;) {
    const resp = await postSync<PullResponse>("/api/sync/pull", { since, limit: 1000 });
    if (resp.rows.length > 0) await applyRemoteRows(resp.rows);
    since = resp.lastUpdatedAt;
    await setWatermark(LAST_PULLED_AT_KEY, since);
    if (!resp.hasMore) break;
  }
}

export async function syncOnce(): Promise<void> {
  if (syncInFlight) return;
  const auth = await loadAuthInfo();
  if (!auth) return;
  syncInFlight = true;
  try {
    await runSync();
  } catch (err) {
    console.warn("[sync] failed:", err);
  }
  syncInFlight = false;
}

let debounceHandle: ReturnType<typeof setTimeout> | null = null;

export function scheduleSync(delayMs = 2000): void {
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(() => {
    debounceHandle = null;
    void syncOnce();
  }, delayMs);
}

// Wire app-level triggers: initial sync after boot, on tab refocus, on network
// reconnect. Each Dexie write also schedules a debounced push via the hooks
// installed above (callers don't have to remember anything).
export function startSyncTriggers(): void {
  void syncOnce();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncOnce();
  });
  window.addEventListener("online", () => void syncOnce());
  for (const { name } of SYNCED_TABLES) {
    const table = db().table(name);
    table.hook("creating", () => scheduleSync());
    table.hook("updating", () => scheduleSync());
    table.hook("deleting", () => scheduleSync());
  }
}
