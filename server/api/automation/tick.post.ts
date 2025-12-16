/* ***************************
wird mit REC_SCHEDULE_INTERVAL von automation-ticks.ts
aufgerufen, stellt die Abarbeitung der Aufnahmen sicher
****************************** */
import { runAutomationDryRun } from "../../utils/automation"
import { readPlexCache } from "../../utils/plex-cache"

export default defineEventHandler(async () => {
  console.log("[AUTOMATION][TICK-POST] triggered")

  const schedule = await readPlexCache()

  if (!schedule) {
    return {
      ok: false,
      error: "no_schedule_cache",
    }
  }

  const result:any = await runAutomationDryRun(schedule)

  return {
    ok: true,
    decision: result.decision,
    reason: result.reason,
    time: result.time,
  }
})
