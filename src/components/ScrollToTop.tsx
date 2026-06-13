import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router doesn't reset scroll on SPA navigation: a Link click or navigate() call
// while scrolled down leaves the next page rendered at the same offset. Browser back/forward
// produce the same issue and can't be solved from a click handler, so syncing against the
// URL (the unified signal across clicks, programmatic navigation, and history events) is
// the right shape. useLayoutEffect runs before paint so the user never sees a flash of the
// new page at the old offset.
export function ScrollToTop(): null {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
