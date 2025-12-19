// server/api/automation/tick.post.ts

import { loadConfig } from "../../utils/config";
import { loadState, saveState } from "../../utils/automation-state";
import { readPlexCache } from "../../utils/plex-cache";
import { runAutomationDryRun } from "../../utils/automation";
import { consoleError } from "vuetify/lib/util/console.mjs";

import { writeFileSync } from "fs";
import { resolve } from "path";

const STATE_FILE = resolve("data/automation-state.json");

function updateLastTick() {
  const state = loadState();
  state.lastTickAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export default defineEventHandler(async () => {
  const cfg = loadConfig();
  const state = loadState();

  const now = Date.now();
  const lastTick = state.lastTickAt ? Date.parse(state.lastTickAt) : 0;

  const intervalMs = (cfg.TICK_INTERVAL_SEC ?? 60) * 1000;
  // console.log(
  //   "tick.post.ts: intervalMs:",
  //   intervalMs,
  //   "(now - lastTick):",
  //   now - lastTick,
  //   "(now - lastTick < intervalMs):",
  //   now - lastTick < intervalMs
  // );
  // console.log(
  //   "tick.post.ts: intervalMs:",
  //   intervalMs,
  //   "now:",
  //   now,
  //   "lastTick:",
  //   lastTick
  // );

  if (now - lastTick < intervalMs) {
    return {
      ok: true,
      skipped: true,
      reason: "tick throttled",
      nextInSec: Math.ceil((intervalMs - (now - lastTick)) / 1000),
    };
  }

  // ✅ Tick akzeptiert
  updateLastTick();

  //console.log("tick.post.ts: throttlin passed");
  //console.log("tick.post.ts: cfg:", JSON.stringify(cfg))
  //console.log()
  //console.log("tick.post.ts: state:", JSON.stringify(state))

  const schedule = await readPlexCache();

  if (!schedule?.data) {
    saveState(state.state, "NO_ACTION", "no plex cache");
    return {
      ok: false,
      error: "no_schedule_cache",
    };
  }


  const result: any = await runAutomationDryRun(schedule);

  //console.log(
  //  "tick.post.ts: runAutomationDryRun passed.",
  //  JSON.stringify(result)
  //);

  saveState(state.state, result.decision, result.reason);

  //console.log(`[AUTOMATION][TICK-POST] state=${JSON.stringify(state)}`)
  //console.log(`[AUTOMATION][TICK-POST] result=${JSON.stringify(result)}`)

  return {
    ok: true,
    decision: result.decision,
    reason: result.reason,
    time: result.time,
  };
});
