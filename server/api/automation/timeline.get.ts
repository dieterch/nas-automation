import { loadConfig } from "~/server/utils/config"
import { readPlexCache } from "~/server/utils/plex-cache"
import { parseRecording } from "~/utils/plex-recording"
import { ScheduledPeriod } from "~/server/utils/time-utils"

export default defineEventHandler(async () => {
  const now = new Date()
  const config = loadConfig()

  const windows: any[] = []

  /* ------------------------------------------------------------
     Recordings (aus Plex-Cache)
  ------------------------------------------------------------ */

  const plexCache = await readPlexCache()
  const ops =
    plexCache?.data?.MediaContainer?.MediaGrabOperation ?? []

  for (const op of ops) {
    const rec = parseRecording(op, config)
    if (!rec) continue

    windows.push({
      id: `rec-${rec.displayTitle}`,
      type: "recording",
      label: rec.displayTitle,
      start: rec.einschaltZeit.toISOString(),
      end: rec.ausschaltZeit.toISOString(),
    })
  }

  /* ------------------------------------------------------------
     Scheduled Windows (aus Config)
  ------------------------------------------------------------ */

  const periods: ScheduledPeriod[] =
    config.SCHEDULED_ON_PERIODS ?? []

  for (const p of periods) {
    if (p.enabled === false) continue

    const base = new Date(now)

    if (p.type === "daily") {
      const start = timeOnDate(base, p.start)
      const end = timeOnDate(base, p.end, start)

      windows.push({
        id: `sched-${p.id}`,
        type: "scheduled",
        label: p.label ?? p.id,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    }

    if (p.type === "weekly") {
      if (!p.days?.includes(base.getDay())) continue

      const start = timeOnDate(base, p.start)
      const end = timeOnDate(base, p.end, start)

      windows.push({
        id: `sched-${p.id}`,
        type: "scheduled",
        label: p.label ?? p.id,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    }

    if (p.type === "once") {
      const baseDate = new Date(p.date + "T00:00:00")

      const start = timeOnDate(baseDate, p.start)
      const end = timeOnDate(baseDate, p.end, start)

      windows.push({
        id: `sched-${p.id}`,
        type: "scheduled",
        label: p.label ?? p.id,
        start: start.toISOString(),
        end: end.toISOString(),
      })
    }
  }

  /* ------------------------------------------------------------
     Sortieren für Timeline
  ------------------------------------------------------------ */

  windows.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  )

  return {
    now: now.toISOString(),
    graceMin: config.GRACE_PERIOD_MIN,
    windows,
  }
})

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */

function timeOnDate(
  base: Date,
  hhmm: string,
  start?: Date
): Date {
  const [h, m] = hhmm.split(":").map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)

  // über Mitternacht
  if (start && d <= start) {
    d.setDate(d.getDate() + 1)
  }

  return d
}
