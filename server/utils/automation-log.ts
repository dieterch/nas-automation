import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"

const LOG_FILE = resolve("data/automation.log.jsonl")

type LogEntry = {
  firstTime: string
  lastTime: string
  count: number
  [key: string]: any
}

export function logAutomation(entry: Record<string, any>) {
  const now = new Date().toISOString()

  const last = readLastEntry()

  // Vergleich: alles außer Zeit & Zähler
  if (last && isSameLogicalEntry(last, entry)) {
    last.lastTime = now
    last.count += 1
    rewriteLastLine(last)
    return
  }

  const line: LogEntry = {
    firstTime: now,
    lastTime: now,
    count: 1,
    ...entry,
  }

  appendFileSync(LOG_FILE, JSON.stringify(line) + "\n")
}

function readLastEntry(): LogEntry | null {
  if (!existsSync(LOG_FILE)) return null

  const lines = readFileSync(LOG_FILE, "utf-8")
    .trimEnd()
    .split("\n")

  if (lines.length === 0) return null

  return JSON.parse(lines[lines.length - 1])
}

function rewriteLastLine(entry: LogEntry) {
  const lines = readFileSync(LOG_FILE, "utf-8")
    .trimEnd()
    .split("\n")

  lines[lines.length - 1] = JSON.stringify(entry)

  writeFileSync(LOG_FILE, lines.join("\n") + "\n")
}

function isSameLogicalEntry(last: LogEntry, next: Record<string, any>) {
  for (const key of Object.keys(next)) {
    if (last[key] !== next[key]) return false
  }
  return true
}
