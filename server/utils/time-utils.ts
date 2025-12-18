export function isNowInScheduledPeriod(
  now: Date,
  periods: any[] = []
): { active: boolean; reason?: string } {
  for (const p of periods) {
    if (!p.active) continue;

    const [sh, sm] = p.start.split(":").map(Number);
    const [eh, em] = p.end.split(":").map(Number);

    const start = new Date(now);
    start.setHours(sh, sm, 0, 0);

    const end = new Date(now);
    end.setHours(eh, em, 0, 0);

    // über Mitternacht
    const inRange =
      end <= start ? now >= start || now <= end : now >= start && now <= end;

    if (p.type === "daily" && inRange) {
      return { active: true, reason: "daily window " + p.id };
    }

    if (p.type === "weekly") {
      if (now.getDay() === p.weekday && inRange) {
        return { active: true, reason: "weekly window " + p.id };
      }
    }

    if (p.type === "once") {
      const today = now.toISOString().slice(0, 10);
      if (today === p.date && inRange) {
        return { active: true, reason: "one-time window " + p.id };
      }
    }
  }

  return { active: false };
}

export type ScheduledPeriod =
  | {
      id: string;
      enabled?: boolean;
      type: "daily";
      start: string;
      end: string;
      label?: string;
    }
  | {
      id: string;
      enabled?: boolean;
      type: "weekly";
      days: number[]; // 0=So … 6=Sa
      start: string;
      end: string;
      label?: string;
    }
  | {
      id: string;  
      enabled?: boolean;
      type: "once";
      date: string; // YYYY-MM-DD
      start: string;
      end: string;
      label?: string;
    };

export function getActiveScheduledWindow(
  now: Date,
  periods: ScheduledPeriod[] = []
) {
  for (const p of periods) {
    if (!p || !p.id || !p.type || !p.start || !p.end) continue;
    if (p.enabled === false) continue;

    if (p.type === "daily") {
      if (isNowInTimeRange(now, p.start, p.end)) {
        return {
          id: p.id,
          type: "daily",
          start: p.start,
          end: p.end,
          label: p.label,
        };
      }
    }

    if (p.type === "weekly") {
      if (
        Array.isArray((p as any).days) &&
        (p as any).days.includes(now.getDay()) &&
        isNowInTimeRange(now, p.start, p.end)
      ) {
        return {
          id: p.id,
          type: "weekly",
          start: p.start,
          end: p.end,
          label: p.label,
        };
      }
    }

    if (p.type === "once") {
      const today = now.toISOString().slice(0, 10);
      if (today === p.date && isNowInTimeRange(now, p.start, p.end)) {
        return {
          id: p.id,
          type: "once",
          start: p.start,
          end: p.end,
          label: p.label,
        };
      }
    }
  }

  return null;
  // return {
  //   type: "none",
  //   start: null,
  //   end: null,
  //   label: "nix",
  // };  
}

/* -------------------------------------------------- */

function isNowInTimeRange(now: Date, startStr: string, endStr: string) {
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  // über Mitternacht
  if (end <= start) {
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}
