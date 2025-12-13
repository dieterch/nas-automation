import { loadConfig } from "~/server/utils/config"
import { writePlexCache } from "~/server/utils/plex-cache"
import { isNasOnlineByPort } from "~/server/utils/nas-utils"
import { fetchPlexSafely } from "~/server/utils/plex-utils"

export default defineEventHandler(async () => {
  const config = loadConfig()

  // Optional: später auch Plex-Status prüfen
  const nasOnline = await isNasOnlineByPort()
  if (!nasOnline) {
    return { updated: false, reason: "NAS offline" }
  }

  try {
    const data = await fetchPlexSafely(
      "/media/subscriptions/scheduled?includeElements=Metadata,Media"
    )

    const cached = await writePlexCache(data)

    return {
      updated: true,
      lastSuccessfulFetch: cached.lastSuccessfulFetch,
      interval: config.REC_SCHEDULE_INTERVALL
    }
  } catch {
    return { updated: false, reason: "Plex error" }
  }
})
