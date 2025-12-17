import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

/* ------------------------------------------------------------------
   Paths
------------------------------------------------------------------ */
const CONFIG_FILE = resolve("data/configuration.json")
const BACKUP_FILE = resolve("data/configuration.json.bak")

/* ------------------------------------------------------------------
   Types (minimal, bewusst locker)
------------------------------------------------------------------ */
type ScheduledPeriod = {
  _uid?: string
  [key: string]: unknown
}

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */
function stripUiFields(cfg: any) {
  if (Array.isArray(cfg?.SCHEDULED_ON_PERIODS)) {
    cfg.SCHEDULED_ON_PERIODS = cfg.SCHEDULED_ON_PERIODS.map(
      ({ _uid, ...rest }: ScheduledPeriod) => rest
    )
  }
  return cfg
}

/* ------------------------------------------------------------------
   Validation
------------------------------------------------------------------ */
export function validateConfig(cfg: any) {
  const errors: string[] = []

  if (!Number.isInteger(cfg.TICK_INTERVAL_SEC) || cfg.TICK_INTERVAL_SEC < 5) {
    errors.push("TICK_INTERVAL_SEC invalid")
  }

  if (
    !Number.isInteger(cfg.REC_SCHEDULE_INTERVALL) ||
    cfg.REC_SCHEDULE_INTERVALL < 30
  ) {
    errors.push("REC_SCHEDULE_INTERVALL invalid")
  }

  if (!Array.isArray(cfg.SCHEDULED_ON_PERIODS)) {
    errors.push("SCHEDULED_ON_PERIODS missing or invalid")
  }

  if (cfg.NIGHT_PERIOD?.enabled) {
    if (!/^\d{2}:\d{2}$/.test(cfg.NIGHT_PERIOD.start)) {
      errors.push("NIGHT_PERIOD.start invalid")
    }
    if (!/^\d{2}:\d{2}$/.test(cfg.NIGHT_PERIOD.end)) {
      errors.push("NIGHT_PERIOD.end invalid")
    }
  }

  if (errors.length) {
    console.error("[CONFIG] invalid configuration", errors)
    throw new Error("Invalid configuration: " + errors.join(", "))
  }

  return cfg
}

/* ------------------------------------------------------------------
   Load
------------------------------------------------------------------ */
export function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))
  return validateConfig(raw)
}

/* ------------------------------------------------------------------
   Save (inkl. Backup + Strip UI Fields)
------------------------------------------------------------------ */
export function saveConfig(rawConfig: any) {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("Invalid config payload")
  }

  // Backup (best effort)
  try {
    const current = loadConfig()
    writeFileSync(BACKUP_FILE, JSON.stringify(current, null, 2), "utf-8")
  } catch {
    /* ignore backup errors */
  }

  // Clone → UI-Felder entfernen → validieren → schreiben
  const cleanConfig = validateConfig(
    stripUiFields(structuredClone(rawConfig))
  )

  writeFileSync(
    CONFIG_FILE,
    JSON.stringify(cleanConfig, null, 2),
    "utf-8"
  )
}
