import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

interface LoadingCtx {
  isLoading: boolean;
  // Begins a loading task. Returns a "finish" callback to call when done.
  // Multiple concurrent tasks stack; the overlay shows while any are active.
  beginLoading: () => () => void;
}

const Ctx = createContext<LoadingCtx | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const value = useMemo<LoadingCtx>(
    () => ({
      isLoading: count > 0,
      beginLoading: () => {
        setCount((c) => c + 1);
        let released = false;
        return () => {
          if (released) return;
          released = true;
          setCount((c) => Math.max(0, c - 1));
        };
      },
    }),
    [count],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLoading(): LoadingCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`useLoading must be used within LoadingProvider`);
  return ctx;
}
