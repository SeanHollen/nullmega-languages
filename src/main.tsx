import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import { App } from "./App";
import { installSyncHooks, startSyncTriggers } from "./utils/sync";

// Ask the browser not to evict our IndexedDB under storage pressure. Chrome/Firefox
// grant silently for engaged sites; Safari ignores. No effect on Safari's separate
// 7-day inactivity eviction.
void navigator.storage?.persist?.();

// Stamp updatedAt on every write to synced tables, record tombstones on deletes.
// Must run BEFORE any other module touches Dexie so existing rows pick up the
// field on first write.
installSyncHooks();
startSyncTriggers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
