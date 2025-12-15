import { appendFileSync } from "fs"
import { resolve } from "path"

const LOG_FILE = resolve("data/automation.log.jsonl")

export function logAutomation(entry: Record<string, any>) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    // time: new Date().toLocaleString(),
    ...entry,
  })

  appendFileSync(LOG_FILE, line + "\n")
}
