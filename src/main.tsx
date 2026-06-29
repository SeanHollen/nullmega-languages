import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import { App } from "./App";

// Ask the browser not to evict our IndexedDB under storage pressure. Chrome/Firefox
// grant silently for engaged sites; Safari ignores. No effect on Safari's separate
// 7-day inactivity eviction.
void navigator.storage?.persist?.();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
