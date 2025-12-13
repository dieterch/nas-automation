// // import { getScheduledRecordings } from '~/utils/plex'

// // export default defineEventHandler(async () => {
// //   return await getScheduledRecordings()
// // })

// import { fetchPlexSafely } from "../../utils/plex-utils"

// export default defineEventHandler(async () => {
//   return await fetchPlexSafely(
//     "/media/subscriptions/scheduled?includeElements=Metadata,Media"
//   )
// })

import { readPlexCache, writePlexCache } from "../../utils/plex-cache"
import { fetchPlexSafely } from "../../utils/plex-utils"
import { loadConfig } from "../../utils/config"
import { isNasOnlineByPort } from "../../utils/nas-utils"

export default defineEventHandler(async () => {
  const config = loadConfig()
  const cache = await readPlexCache()

  const intervalSec = config.REC_SCHEDULE_INTERVALL ?? 300
  const now = Date.now()

  const lastFetch = cache.lastSuccessfulFetch
    ? new Date(cache.lastSuccessfulFetch).getTime()
    : 0

  const cacheValid = cache.data && (now - lastFetch < intervalSec * 1000)

  // 1️⃣ Cache frisch → sofort zurück
  if (cacheValid) {
    return cache
  }

  // 2️⃣ Cache alt, aber NAS oder Plex nicht verfügbar → alten Cache zurück
  const nasOnline = await isNasOnlineByPort()
  if (!nasOnline && cache.data) {
    return cache
  }

  // 3️⃣ Cache aktualisieren
  try {
    const data = await fetchPlexSafely(
      "/media/subscriptions/scheduled?includeElements=Metadata,Media"
    )

    return await writePlexCache(data)
  } catch {
    // 4️⃣ Plex Fehler → alten Cache zurück (falls vorhanden)
    if (cache.data) {
      return cache
    }
    throw createError({
      statusCode: 503,
      statusMessage: "Plex unavailable and no cache present"
    })
  }
})

