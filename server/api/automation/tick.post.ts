// server/api/automation/tick.post.ts

import { loadConfig } from "../../utils/config"
import { loadState, saveState } from "../../utils/automation-state"
import { readPlexCache } from "../../utils/plex-cache"
import { runAutomationDryRun } from "../../utils/automation"

export default defineEventHandler(async () => {
  const cfg = loadConfig()
  const state = loadState()

  const now = Date.now()
  const lastTick = state.lastTickAt
    ? Date.parse(state.lastTickAt)
    : 0

  const intervalMs = (cfg.TICK_INTERVAL_SEC ?? 60) * 1000

  if (now - lastTick < intervalMs) {
    return {
      ok: true,
      skipped: true,
      reason: "tick throttled",
      nextInSec: Math.ceil((intervalMs - (now - lastTick)) / 1000),
    }
  }

  const schedule = await readPlexCache()

  if (!schedule?.data) {
    saveState(state.state, "NO_ACTION", "no plex cache")
    return {
      ok: false,
      error: "no_schedule_cache",
    }
  }

  const result:any = await runAutomationDryRun(schedule)

  saveState(
    state.state,
    result.decision,
    result.reason
  )

  return {
    ok: true,
    decision: result.decision,
    reason: result.reason,
    time: result.time,
  }
})
