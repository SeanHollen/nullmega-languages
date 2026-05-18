import type { ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../utils/db";

interface Props {
  children: ReactNode;
}

// Gates the app until the Dexie database is open. The first call to any table triggers
// the underlying IDBOpenDBRequest; we await a cheap count() so subsequent useLiveQuery
// reads in children resolve from a connection that's already in place.
export function DbReady({ children }: Props) {
  const ready = useLiveQuery(async () => {
    await db().kv.count();
    return true;
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-green-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-green-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-green-600 animate-bounce" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
