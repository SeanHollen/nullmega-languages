import type { Page } from "@playwright/test";

const BACKEND_URL =
  process.env.E2E_BACKEND_URL ?? "https://lovely-ibex-771.convex.site";

interface TestSession {
  token: string;
  userId: string;
}

async function mintTestSession(): Promise<TestSession> {
  const res = await fetch(`${BACKEND_URL}/api/auth/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`test-login failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TestSession;
}

export async function seedAuthedSession(page: Page, baseURL: string): Promise<void> {
  const session = await mintTestSession();
  await page.goto(baseURL);
  await page.evaluate(async (s) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("language-lab");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("kv", "readwrite");
        const store = tx.objectStore("kv");
        store.put({ key: "authToken", value: s.token });
        store.put({ key: "authUserId", value: s.userId });
        store.put({ key: "onboardingComplete", value: true });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, session);
  await page.reload();
}
