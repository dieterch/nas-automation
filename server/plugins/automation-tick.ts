import { loadConfig } from "../utils/config";

export default defineNitroPlugin(() => {
  
  const cfg = loadConfig();
  const INTERVAL_MS = 60 * 1000;
  // const INTERVAL_MS = (cfg.REC_SCHEDULE_INTERVALL ?? 300) * 1000;

  setInterval(async () => {
    try {
      await $fetch("/api/automation/tick", { method: "POST" });
    } catch (err) {
      console.error("[AUTOMATION][TICKS] tick failed", err);
    }
  }, INTERVAL_MS);

  console.log("[AUTOMATION][TICKS] periodic tick started");
});
