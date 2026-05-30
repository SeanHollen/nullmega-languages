import { useEffect, useState } from "react";

function localMidnightOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function nextMidnightDelay(): number {
  const now = Date.now();
  // +1ms past midnight so we're definitively in the new day when the timer fires.
  return localMidnightOf(now) + 24 * 60 * 60 * 1000 + 1 - now;
}

// Stable per-calendar-day key. Anything that filters by "today" should include it as a
// useLiveQuery dependency so the query re-runs when the date rolls over — either via the
// scheduled midnight tick, or because the user returned to a stale tab.
export function useDayKey(): number {
  const [day, setDay] = useState(() => localMidnightOf(Date.now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      setDay(localMidnightOf(Date.now()));
      timer = setTimeout(tick, nextMidnightDelay());
    }
    timer = setTimeout(tick, nextMidnightDelay());

    function onVisible() {
      if (document.visibilityState === `visible`) {
        const fresh = localMidnightOf(Date.now());
        setDay((prev) => (prev === fresh ? prev : fresh));
      }
    }
    document.addEventListener(`visibilitychange`, onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener(`visibilitychange`, onVisible);
    };
  }, []);

  return day;
}
