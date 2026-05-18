import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export interface LoadingTask {
  update: (message: string) => void;
  done: () => void;
}

interface LoadingCtx {
  isLoading: boolean;
  messages: string[];
  beginLoading: (message?: string) => LoadingTask;
}

const Ctx = createContext<LoadingCtx | null>(null);

let nextTaskId = 0;

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<{ id: number; message: string }[]>([]);

  const value = useMemo<LoadingCtx>(
    () => ({
      isLoading: tasks.length > 0,
      messages: tasks.map((t) => t.message).filter((m) => m.length > 0),
      beginLoading: (message = "") => {
        const id = nextTaskId++;
        setTasks((prev) => [...prev, { id, message }]);
        let released = false;
        return {
          update: (newMessage: string) => {
            if (released) return;
            setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, message: newMessage } : t)));
          },
          done: () => {
            if (released) return;
            released = true;
            setTasks((prev) => prev.filter((t) => t.id !== id));
          },
        };
      },
    }),
    [tasks],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLoading(): LoadingCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`useLoading must be used within LoadingProvider`);
  return ctx;
}
