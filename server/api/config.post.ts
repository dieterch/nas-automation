import { writeFileSync } from "fs"
import { resolve } from "path"
import { loadConfig } from "../utils/config"

type ScheduledPeriod = {
  _uid?: string
  [key: string]: unknown
}

function stripUiFields(config: any) {
  if (Array.isArray(config.SCHEDULED_ON_PERIODS)) {
    config.SCHEDULED_ON_PERIODS = config.SCHEDULED_ON_PERIODS.map(
      ({ _uid, ...rest }: ScheduledPeriod) => rest
    )
  }
  return config
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid config payload",
    })
  }

  const configPath = resolve("data/configuration.json")
  const backupPath = resolve("data/configuration.json.bak")

  try {
    // Backup
    const current = loadConfig()
    writeFileSync(backupPath, JSON.stringify(current, null, 2), "utf-8")

    // 🔥 UI-Felder entfernen
    const cleanConfig = stripUiFields(body)

    // Write new config
    writeFileSync(
      configPath,
      JSON.stringify(cleanConfig, null, 2),
      "utf-8"
    )

    return { ok: true }
  } catch (err) {
    console.error("[CONFIG] save failed", err)
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save configuration",
    })
  }
})
