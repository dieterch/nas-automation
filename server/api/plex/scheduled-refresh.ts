import { loadConfig } from "~/server/utils/config"
import { readPlexCache, writePlexCache } from "~/server/utils/plex-cache"
import { isNasOnlineByPort } from "~/server/utils/nas-utils"
import { fetchPlexSafely } from "~/server/utils/plex-utils"

function extractSchedules(data: any): any[] {
  return (
    data?.MediaContainer?.MediaGrabOperation ??
    []
  )
}

function isValidPlexSchedulePayload(data: any): boolean {
  const mc = data?.MediaContainer
  if (!mc) return false

  // Plex antwortet, aber ist noch nicht "bereit"
  if (!Array.isArray(mc.MediaGrabOperation)) return false

  // explizit leer → potentiell Startup-Zustand
  if (mc.MediaGrabOperation.length === 0) return false

  // Optional: erste Aufnahme plausibel prüfen
  const first = mc.MediaGrabOperation[0]
  if (!first?.Metadata?.Media?.[0]?.beginsAt) return false

  return true
}

async function shouldUpdateCache(
  newData: any,
  existingCache: any
): Promise<boolean> {
  const newSchedules = extractSchedules(newData)
  const oldSchedules = extractSchedules(existingCache?.data)

  // neue Daten leer, alte nicht → NICHT überschreiben
  if (newSchedules.length === 0 && oldSchedules.length > 0) {
    return false
  }

  // neue Daten enthalten weniger Einträge als alte → verdächtig
  if (
    oldSchedules.length > 0 &&
    newSchedules.length < oldSchedules.length
  ) {
    return false
  }

  return true
}

export default defineEventHandler(async () => {
  const config = loadConfig()

  const nasOnline = await isNasOnlineByPort()
  if (!nasOnline) {
    return { updated: false, reason: "NAS offline" }
  }

  try {
    const data: any = await fetchPlexSafely(
      "/media/subscriptions/scheduled?includeElements=Metadata,Media"
    )

    if (!isValidPlexSchedulePayload(data)) {
      return {
        updated: false,
        reason: "Plex payload not valid yet",
      }
    }

    const existing = await readPlexCache()

    const ok = await shouldUpdateCache(data, existing)
    if (!ok) {
      return {
        updated: false,
        reason: "Refusing to overwrite cache with weaker data",
      }
    }

    const cached = await writePlexCache(data)
    console.log("[AUTOMATION][SCHEDULED-REFRESH] cache updated")

    return {
      updated: true,
      lastSuccessfulFetch: cached.lastSuccessfulFetch,
      interval: config.REC_SCHEDULE_INTERVALL,
    }
  } catch (err) {
    return { updated: false, reason: "Plex error" }
  }
})

// export default defineEventHandler(async () => {
//   const config = loadConfig()

//   // Optional: später auch Plex-Status prüfen
//   const nasOnline = await isNasOnlineByPort()
//   if (!nasOnline) {
//     return { updated: false, reason: "NAS offline" }
//   }

//   try {
//     const data:any = await fetchPlexSafely(
//       "/media/subscriptions/scheduled?includeElements=Metadata,Media"
//     )

//     const cached = await writePlexCache(data)
//     console.log("[AUTOMATION][SCHEDULED-REFRESH] cache update.")
//     return {
//       updated: true,
//       lastSuccessfulFetch: cached.lastSuccessfulFetch,
//       interval: config.REC_SCHEDULE_INTERVALL
//     }
//   } catch {
//     return { updated: false, reason: "Plex error" }
//   }
// })
