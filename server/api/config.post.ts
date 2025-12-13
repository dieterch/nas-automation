import { writeFileSync } from "fs"
import { resolve } from "path"
import { loadConfig } from "../utils/config"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid config payload",
    })
  }

  const configPath = resolve("server/configuration.json")
  const backupPath = resolve("server/configuration.json.bak")

  try {
    // 1️⃣ bestehende Config laden (Backup)
    const current = loadConfig()
    writeFileSync(
      backupPath,
      JSON.stringify(current, null, 2),
      "utf-8"
    )

    // 2️⃣ neue Config schreiben (formatiert)
    writeFileSync(
      configPath,
      JSON.stringify(body, null, 2),
      "utf-8"
    )

    return {
      ok: true,
      message: "Configuration saved",
    }
  } catch (err) {
    console.error("[CONFIG] save failed", err)

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save configuration",
    })
  }
})
